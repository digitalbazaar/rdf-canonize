/*
 * Copyright (c) 2016-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const IdentifierIssuer = require('./IdentifierIssuer');
const MessageDigest = require('./MessageDigest');
const Permutator = require('./Permutator');
const NQuads = require('./NQuads');
const util = require('./util');

const POSITIONS = {'subject': 's', 'object': 'o', 'graph': 'g'};

module.exports = class URDNA2015Sync {
  constructor() {
    this.name = 'URDNA2015';
    this.blankNodeInfo = {};
    this.canonicalIssuer = new IdentifierIssuer('_:c14n');
    this.hashAlgorithm = 'sha256';
    this.quads;
  }

  // 4.4) Normalization Algorithm
  main(dataset) {
    const self = this;
    self.quads = dataset;

    // 1) Create the normalization state.

    // Note: Optimize by generating non-normalized blank node map concurrently.
    const nonNormalized = {};

    // 2) For every quad in input dataset:
    for(const quad of dataset) {
      // 2.1) For each blank node that occurs in the quad, add a reference
      // to the quad using the blank node identifier in the blank node to
      // quads map, creating a new entry if necessary.
      self.forEachComponent(quad, component => {
        if(component.termType !== 'BlankNode') {
          return;
        }
        const id = component.value;
        if(id in self.blankNodeInfo) {
          self.blankNodeInfo[id].quads.push(quad);
        } else {
          nonNormalized[id] = true;
          self.blankNodeInfo[id] = {quads: [quad]};
        }
      });
    }

    // 3) Create a list of non-normalized blank node identifiers
    // non-normalized identifiers and populate it using the keys from the
    // blank node to quads map.
    // Note: We use a map here and it was generated during step 2.

    // 4) `simple` flag is skipped -- loop is optimized away.
    // 5.1 is skipped; first degree quad hashes are generated
    // just once for all non-normalized blank nodes.

    // 5.3) For each blank node identifier identifier in non-normalized
    // identifiers:
    const fdQuadsToBlankNodes = {};
    for(const id in nonNormalized) {
      // 5.3.1) Create a hash, hash, according to the Hash First Degree
      // Quads algorithm.
      const fdQuads = self.serializeFirstDegreeQuads(id);

      // 5.3.2) Add hash and identifier to hash to blank nodes map,
      // creating a new entry if necessary.
      // Note: Optimized to add serialized n-quads instead of hash.
      if(fdQuads in fdQuadsToBlankNodes) {
        fdQuadsToBlankNodes[fdQuads].push(id);
      } else {
        fdQuadsToBlankNodes[fdQuads] = [id];
      }
    }

    // build hashToBlankNodes map by hashing fdQuads
    const hashToBlankNodes = {};
    for(const fdQuads in fdQuadsToBlankNodes) {
      const md = new MessageDigest(self.hashAlgorithm);
      md.update(fdQuads);
      const hash = md.digest();
      const idList = fdQuadsToBlankNodes[fdQuads];
      hashToBlankNodes[hash] = idList;
      for(const id of idList) {
        self.blankNodeInfo[id].hash = hash;
      }
    }

    // 5.4) For each hash to identifier list mapping in hash to blank
    // nodes map, lexicographically-sorted by hash:
    const hashes = Object.keys(hashToBlankNodes).sort();
    // optimize away second sort, gather non-unique hashes as we go
    const nonUnique = [];
    for(const hash of hashes) {
      // 5.4.1) If the length of identifier list is greater than 1,
      // continue to the next mapping.
      const idList = hashToBlankNodes[hash];
      if(idList.length > 1) {
        nonUnique.push(idList);
        continue;
      }

      // 5.4.2) Use the Issue Identifier algorithm, passing canonical
      // issuer and the single blank node identifier in identifier
      // list, identifier, to issue a canonical replacement identifier
      // for identifier.
      // TODO: consider changing `getId` to `issue`
      const id = idList[0];
      self.canonicalIssuer.getId(id);

      // 5.4.3-5.4.5) Skipped, optimized away.
    }

    // 6) For each hash to identifier list mapping in hash to blank nodes map,
    // lexicographically-sorted by hash:
    // Note: sort optimized away, use `nonUnique`.
    for(const idList of nonUnique) {
      // 6.1) Create hash path list where each item will be a result of
      // running the Hash N-Degree Quads algorithm.
      const hashPathList = [];

      // 6.2) For each blank node identifier identifier in identifier list:
      for(const id of idList) {
        // 6.2.1) If a canonical identifier has already been issued for
        // identifier, continue to the next identifier.
        if(self.canonicalIssuer.hasId(id)) {
          continue;
        }

        // 6.2.2) Create temporary issuer, an identifier issuer
        // initialized with the prefix _:b.
        const issuer = new IdentifierIssuer('_:b');

        // 6.2.3) Use the Issue Identifier algorithm, passing temporary
        // issuer and identifier, to issue a new temporary blank node
        // identifier for identifier.
        issuer.getId(id);

        // 6.2.4) Run the Hash N-Degree Quads algorithm, passing
        // temporary issuer, and append the result to the hash path list.
        const result = self.hashNDegreeQuads(id, issuer);
        hashPathList.push(result);
      }

      // 6.3) For each result in the hash path list,
      // lexicographically-sorted by the hash in result:
      hashPathList.sort((a, b) => a.hash.localeCompare(b.hash));
      for(const result of hashPathList) {
        // 6.3.1) For each blank node identifier, existing identifier,
        // that was issued a temporary identifier by identifier issuer
        // in result, issue a canonical identifier, in the same order,
        // using the Issue Identifier algorithm, passing canonical
        // issuer and existing identifier.
        for(const existing in result.issuer.existing) {
          self.canonicalIssuer.getId(existing);
        }
      }
    }

    /* Note: At this point all blank nodes in the set of RDF quads have been
    assigned canonical identifiers, which have been stored in the canonical
    issuer. Here each quad is updated by assigning each of its blank nodes
    its new identifier. */

    // 7) For each quad, quad, in input dataset:
    const normalized = [];
    for(const quad of self.quads) {
      // 7.1) Create a copy, quad copy, of quad and replace any existing
      // blank node identifiers using the canonical identifiers
      // previously issued by canonical issuer.
      // Note: We optimize away the copy here.
      self.forEachComponent(quad, component => {
        if(component.termType === 'BlankNode' &&
          !component.value.startsWith(self.canonicalIssuer.prefix)) {
          component.value = self.canonicalIssuer.getId(component.value);
        }
      });
      // 7.2) Add quad copy to the normalized dataset.
      normalized.push(NQuads.serializeQuad(quad));
    }

    // sort normalized output
    normalized.sort();

    // 8) Return the normalized dataset.
    return normalized.join('');
  }

  serializeFirstDegreeQuads(id) {
    const self = this;

    // return cached serialization
    const info = self.blankNodeInfo[id];
    if('fdQuads' in info) {
      return info.fdQuads;
    }

    // 1) Initialize nquads to an empty list. It will be used to store quads in
    // N-Quads format.
    const nquads = [];

    // 2) Get the list of quads `quads` associated with the reference blank node
    // identifier in the blank node to quads map.
    const quads = info.quads;

    // 3) For each quad `quad` in `quads`:
    for(const quad of quads) {
      // 3.1) Serialize the quad in N-Quads format with the following special
      // rule:

      // 3.1.1) If any component in quad is an blank node, then serialize it
      // using a special identifier as follows:
      const copy = {predicate: quad.predicate};
      self.forEachComponent(quad, (component, key) => {
        // TODO: optimize this step by using canonical labeling for a node
        // if it has it -- this also requires clearing precomputed hashes

        // 3.1.2) If the blank node's existing blank node identifier matches
        // the reference blank node identifier then use the blank node
        // identifier _:a, otherwise, use the blank node identifier _:z.
        copy[key] = self.modifyFirstDegreeComponent(id, component, key);
      });
      nquads.push(NQuads.serializeQuad(copy));
    }

    // 4) Sort nquads in lexicographical order.
    nquads.sort();

    // 5) Return the sorted, joined, and serialized n-quads.
    info.fdQuads = nquads.join('');
    return info.fdQuads;
  }

  // 4.6) Hash First Degree Quads
  hashFirstDegreeQuads(id) {
    const self = this;

    // return cached hash
    const info = self.blankNodeInfo[id];
    if('hash' in info) {
      return info.hash;
    }

    const fdQuads = this.serializeFirstDegreeQuads(id);
    const md = new MessageDigest(self.hashAlgorithm);
    md.update(fdQuads);
    // TODO: represent as byte buffer instead to cut memory usage in half
    info.hash = md.digest();
    return info.hash;
  }

  // 4.7) Hash Related Blank Node
  hashRelatedBlankNode(related, quad, issuer, position) {
    const self = this;

    // 1) Set the identifier to use for related, preferring first the canonical
    // identifier for related if issued, second the identifier issued by issuer
    // if issued, and last, if necessary, the result of the Hash First Degree
    // Quads algorithm, passing related.
    let id;
    if(self.canonicalIssuer.hasId(related)) {
      id = self.canonicalIssuer.getId(related);
    } else if(issuer.hasId(related)) {
      id = issuer.getId(related);
    } else {
      id = self.hashFirstDegreeQuads(related);
    }

    // 2) Initialize a string input to the value of position.
    // Note: We use a hash object instead.
    const md = new MessageDigest(self.hashAlgorithm);
    md.update(position);

    // 3) If position is not g, append <, the value of the predicate in quad,
    // and > to input.
    if(position !== 'g') {
      md.update(self.getRelatedPredicate(quad));
    }

    // 4) Append identifier to input.
    md.update(id);

    // 5) Return the hash that results from passing input through the hash
    // algorithm.
    // TODO: represent as byte buffer instead to cut memory usage in half
    return md.digest();
  }

  // 4.8) Hash N-Degree Quads
  hashNDegreeQuads(id, issuer) {
    const self = this;

    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    // Note: 2) and 3) handled within `createHashToRelated`
    const md = new MessageDigest(self.hashAlgorithm);
    const hashToRelated = self.createHashToRelated(id, issuer);

    // 4) Create an empty string, data to hash.
    // Note: We created a hash object `md` above instead.

    // 5) For each related hash to blank node list mapping in hash to related
    // blank nodes map, sorted lexicographically by related hash:
    const hashes = Object.keys(hashToRelated).sort();
    for(const hash of hashes) {
      // 5.1) Append the related hash to the data to hash.
      md.update(hash);

      // 5.2) Create a string chosen path.
      let chosenPath = '';

      // 5.3) Create an unset chosen issuer variable.
      let chosenIssuer;

      // 5.4) For each permutation of blank node list:
      const permutator = new Permutator(hashToRelated[hash]);
      while(permutator.hasNext()) {
        const permutation = permutator.next();

        // 5.4.1) Create a copy of issuer, issuer copy.
        let issuerCopy = issuer.clone();

        // 5.4.2) Create a string path.
        let path = '';

        // 5.4.3) Create a recursion list, to store blank node identifiers
        // that must be recursively processed by this algorithm.
        const recursionList = [];

        // 5.4.4) For each related in permutation:
        let nextPermutation = false;
        for(const related of permutation) {
          // 5.4.4.1) If a canonical identifier has been issued for
          // related, append it to path.
          if(self.canonicalIssuer.hasId(related)) {
            path += self.canonicalIssuer.getId(related);
          } else {
            // 5.4.4.2) Otherwise:
            // 5.4.4.2.1) If issuer copy has not issued an identifier for
            // related, append related to recursion list.
            if(!issuerCopy.hasId(related)) {
              recursionList.push(related);
            }
            // 5.4.4.2.2) Use the Issue Identifier algorithm, passing
            // issuer copy and related and append the result to path.
            path += issuerCopy.getId(related);
          }

          // 5.4.4.3) If chosen path is not empty and the length of path
          // is greater than or equal to the length of chosen path and
          // path is lexicographically greater than chosen path, then
          // skip to the next permutation.
          if(chosenPath.length !== 0 &&
            path.length >= chosenPath.length && path > chosenPath) {
            nextPermutation = true;
            break;
          }
        }

        if(nextPermutation) {
          continue;
        }

        // 5.4.5) For each related in recursion list:
        for(const related of recursionList) {
          // 5.4.5.1) Set result to the result of recursively executing
          // the Hash N-Degree Quads algorithm, passing related for
          // identifier and issuer copy for path identifier issuer.
          const result = self.hashNDegreeQuads(related, issuerCopy);

          // 5.4.5.2) Use the Issue Identifier algorithm, passing issuer
          // copy and related and append the result to path.
          path += issuerCopy.getId(related);

          // 5.4.5.3) Append <, the hash in result, and > to path.
          path += '<' + result.hash + '>';

          // 5.4.5.4) Set issuer copy to the identifier issuer in
          // result.
          issuerCopy = result.issuer;

          // 5.4.5.5) If chosen path is not empty and the length of path
          // is greater than or equal to the length of chosen path and
          // path is lexicographically greater than chosen path, then
          // skip to the next permutation.
          if(chosenPath.length !== 0 &&
            path.length >= chosenPath.length && path > chosenPath) {
            nextPermutation = true;
            break;
          }
        }

        if(nextPermutation) {
          continue;
        }

        // 5.4.6) If chosen path is empty or path is lexicographically
        // less than chosen path, set chosen path to path and chosen
        // issuer to issuer copy.
        if(chosenPath.length === 0 || path < chosenPath) {
          chosenPath = path;
          chosenIssuer = issuerCopy;
        }
      }

      // 5.5) Append chosen path to data to hash.
      md.update(chosenPath);

      // 5.6) Replace issuer, by reference, with chosen issuer.
      issuer = chosenIssuer;
    }

    // 6) Return issuer and the hash that results from passing data to hash
    // through the hash algorithm.
    return {hash: md.digest(), issuer: issuer};
  }

  // helper for modifying component during Hash First Degree Quads
  modifyFirstDegreeComponent(id, component) {
    if(component.termType !== 'BlankNode') {
      return component;
    }
    component = util.clone(component);
    component.value = (component.value === id ? '_:a' : '_:z');
    return component;
  }

  // helper for getting a related predicate
  getRelatedPredicate(quad) {
    return '<' + quad.predicate.value + '>';
  }

  // helper for creating hash to related blank nodes map
  createHashToRelated(id, issuer) {
    const self = this;

    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    const hashToRelated = {};

    // 2) Get a reference, quads, to the list of quads in the blank node to
    // quads map for the key identifier.
    const quads = self.blankNodeInfo[id].quads;

    // 3) For each quad in quads:
    for(const quad of quads) {
      // 3.1) For each component in quad, if component is the subject, object,
      // and graph name and it is a blank node that is not identified by
      // identifier:
      for(const key in quad) {
        const component = quad[key];
        if(key === 'predicate' ||
          !(component.termType === 'BlankNode' && component.value !== id)) {
          continue;
        }
        // 3.1.1) Set hash to the result of the Hash Related Blank Node
        // algorithm, passing the blank node identifier for component as
        // related, quad, path identifier issuer as issuer, and position as
        // either s, o, or g based on whether component is a subject, object,
        // graph name, respectively.
        const related = component.value;
        const position = POSITIONS[key];
        const hash = self.hashRelatedBlankNode(related, quad, issuer, position);

        // 3.1.2) Add a mapping of hash to the blank node identifier for
        // component to hash to related blank nodes map, adding an entry as
        // necessary.
        if(hash in hashToRelated) {
          hashToRelated[hash].push(related);
        } else {
          hashToRelated[hash] = [related];
        }
      }
    }

    return hashToRelated;
  }

  // helper that iterates over quad components (skips predicate)
  forEachComponent(quad, op) {
    for(const key in quad) {
      // skip `predicate`
      if(key === 'predicate') {
        continue;
      }
      op(quad[key], key, quad);
    }
  }
};
