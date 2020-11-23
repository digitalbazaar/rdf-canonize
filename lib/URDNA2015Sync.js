/*
 * Copyright (c) 2016-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const IdentifierIssuer = require('./IdentifierIssuer');
const MessageDigest = require('./MessageDigest');
const Permuter = require('./Permuter');
const NQuads = require('./NQuads');

module.exports = class URDNA2015Sync {
  constructor() {
    this.name = 'URDNA2015';
    this.blankNodeInfo = new Map();
    this.canonicalIssuer = new IdentifierIssuer('_:c14n');
    this.hashAlgorithm = 'sha256';
    this.quads = null;
  }

  // 4.4) Normalization Algorithm
  main(dataset) {
    this.quads = dataset;

    // 1) Create the normalization state.
    // 2) For every quad in input dataset:
    for(const quad of dataset) {
      // 2.1) For each blank node that occurs in the quad, add a reference
      // to the quad using the blank node identifier in the blank node to
      // quads map, creating a new entry if necessary.
      this._addBlankNodeQuadInfo({quad, component: quad.subject});
      this._addBlankNodeQuadInfo({quad, component: quad.object});
      this._addBlankNodeQuadInfo({quad, component: quad.graph});
    }

    // 3) Create a list of non-normalized blank node identifiers
    // non-normalized identifiers and populate it using the keys from the
    // blank node to quads map.
    // Note: We use a map here and it was generated during step 2.

    // 4) `simple` flag is skipped -- loop is optimized away. This optimization
    // is permitted because there was a typo in the hash first degree quads
    // algorithm in the URDNA2015 spec that was implemented widely making it
    // such that it could not be fixed; the result was that the loop only
    // needs to be run once and the first degree quad hashes will never change.
    // 5.1-5.2 are skipped; first degree quad hashes are generated just once
    // for all non-normalized blank nodes.

    // 5.3) For each blank node identifier identifier in non-normalized
    // identifiers:
    const hashToBlankNodes = new Map();
    const nonNormalized = [...this.blankNodeInfo.keys()];
    for(const id of nonNormalized) {
      // steps 5.3.1 and 5.3.2:
      this._hashAndTrackBlankNode({id, hashToBlankNodes});
    }

    // 5.4) For each hash to identifier list mapping in hash to blank
    // nodes map, lexicographically-sorted by hash:
    const hashes = [...hashToBlankNodes.keys()].sort();
    // optimize away second sort, gather non-unique hashes in order as we go
    const nonUnique = [];
    for(const hash of hashes) {
      // 5.4.1) If the length of identifier list is greater than 1,
      // continue to the next mapping.
      const idList = hashToBlankNodes.get(hash);
      if(idList.length > 1) {
        nonUnique.push(idList);
        continue;
      }

      // 5.4.2) Use the Issue Identifier algorithm, passing canonical
      // issuer and the single blank node identifier in identifier
      // list, identifier, to issue a canonical replacement identifier
      // for identifier.
      const id = idList[0];
      this.canonicalIssuer.getId(id);

      // Note: These steps are skipped, optimized away since the loop
      // only needs to be run once.
      // 5.4.3) Remove identifier from non-normalized identifiers.
      // 5.4.4) Remove hash from the hash to blank nodes map.
      // 5.4.5) Set simple to true.
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
        if(this.canonicalIssuer.hasId(id)) {
          console.log('BBB canonical', id);
          continue;
        }

        // 6.2.2) Create temporary issuer, an identifier issuer
        // initialized with the prefix _:b.
        const issuer = new IdentifierIssuer('_:b');

        // 6.2.3) Use the Issue Identifier algorithm, passing temporary
        // issuer and identifier, to issue a new temporary blank node
        // identifier for identifier.
        issuer.getId(id);
        console.log('BBB top level issuer', id, issuer);

        // 6.2.4) Run the Hash N-Degree Quads algorithm, passing
        // temporary issuer, and append the result to the hash path list.
        console.log('BBB top level', id);
        const result = this.hashNDegreeQuads(id, issuer);
        hashPathList.push(result);
      }

      // 6.3) For each result in the hash path list,
      // lexicographically-sorted by the hash in result:
      hashPathList.sort(_stringHashCompare);
      for(const result of hashPathList) {
        // 6.3.1) For each blank node identifier, existing identifier,
        // that was issued a temporary identifier by identifier issuer
        // in result, issue a canonical identifier, in the same order,
        // using the Issue Identifier algorithm, passing canonical
        // issuer and existing identifier.
        const oldIds = result.issuer.getOldIds();
        for(const id of oldIds) {
          console.log('BBB assigning', id);
          this.canonicalIssuer.getId(id);
        }
      }
    }

    /* Note: At this point all blank nodes in the set of RDF quads have been
    assigned canonical identifiers, which have been stored in the canonical
    issuer. Here each quad is updated by assigning each of its blank nodes
    its new identifier. */

    // 7) For each quad, quad, in input dataset:
    const normalized = [];
    for(const quad of this.quads) {
      // 7.1) Create a copy, quad copy, of quad and replace any existing
      // blank node identifiers using the canonical identifiers
      // previously issued by canonical issuer.
      // Note: We optimize away the copy here.
      this._useCanonicalId({component: quad.subject});
      this._useCanonicalId({component: quad.object});
      this._useCanonicalId({component: quad.graph});
      // 7.2) Add quad copy to the normalized dataset.
      normalized.push(NQuads.serializeQuad(quad));
    }

    // sort normalized output
    normalized.sort();

    // 8) Return the normalized dataset.
    return normalized.join('');
  }

  // 4.6) Hash First Degree Quads
  hashFirstDegreeQuads(id) {
    // 1) Initialize nquads to an empty list. It will be used to store quads in
    // N-Quads format.
    const nquads = [];

    // 2) Get the list of quads `quads` associated with the reference blank node
    // identifier in the blank node to quads map.
    const info = this.blankNodeInfo.get(id);
    const quads = info.quads;

    // 3) For each quad `quad` in `quads`:
    for(const quad of quads) {
      // 3.1) Serialize the quad in N-Quads format with the following special
      // rule:

      // 3.1.1) If any component in quad is an blank node, then serialize it
      // using a special identifier as follows:
      const copy = {
        subject: null, predicate: quad.predicate, object: null, graph: null
      };
      // 3.1.2) If the blank node's existing blank node identifier matches
      // the reference blank node identifier then use the blank node
      // identifier _:a, otherwise, use the blank node identifier _:z.
      copy.subject = this.modifyFirstDegreeComponent(
        id, quad.subject, 'subject');
      copy.object = this.modifyFirstDegreeComponent(
        id, quad.object, 'object');
      copy.graph = this.modifyFirstDegreeComponent(
        id, quad.graph, 'graph');
      nquads.push(NQuads.serializeQuad(copy));
    }

    // 4) Sort nquads in lexicographical order.
    nquads.sort();

    // 5) Return the hash that results from passing the sorted, joined nquads
    // through the hash algorithm.
    const md = new MessageDigest(this.hashAlgorithm);
    for(const nquad of nquads) {
      md.update(nquad);
    }
    info.hash = md.digest();
    return info.hash;
  }

  // 4.7) Hash Related Blank Node
  hashRelatedBlankNode(related, quad, issuer, position) {
    // 1) Set the identifier to use for related, preferring first the canonical
    // identifier for related if issued, second the identifier issued by issuer
    // if issued, and last, if necessary, the result of the Hash First Degree
    // Quads algorithm, passing related.
    let id;
    if(this.canonicalIssuer.hasId(related)) {
      id = this.canonicalIssuer.getId(related);
    } else if(issuer.hasId(related)) {
      id = issuer.getId(related);
      console.log('BBB hrbn issuer', related, issuer);
    } else {
      id = this.blankNodeInfo.get(related).hash;
    }

    // 2) Initialize a string input to the value of position.
    // Note: We use a hash object instead.
    const md = new MessageDigest(this.hashAlgorithm);
    md.update(position);

    // 3) If position is not g, append <, the value of the predicate in quad,
    // and > to input.
    if(position !== 'g') {
      md.update(this.getRelatedPredicate(quad));
    }

    // 4) Append identifier to input.
    md.update(id);

    // 5) Return the hash that results from passing input through the hash
    // algorithm.
    return md.digest();
  }

  // 4.8) Hash N-Degree Quads
  hashNDegreeQuads(id, issuer) {
    // FIXME: break up into individual helper functions

    /* Note: This is a non-recursive implementation of the Hash N-Degree
    Quads algorithm from the spec. It produces the same output, but does
    so without calling functions recursively, instead pushing state onto
    arrays that are processed in a loop. Where this implementation needs to
    deviate from the steps in the spec in order to support this alternative
    flow, a `NRI Note:` comment is left; NRI = Non-recursive implementation. */
    const baseState = {
      id, issuer,
      md: null, hashToRelated: null,
      relatedQueue: [], cursor: 0, recursionsLeft: -1,
      parent: null,
      hash: null
    };
    // NRI Note: Here we loop over a work queue containing state information;
    // when a "recursion" occurs, it is pushed onto the work queue.
    let next = [baseState];
    while(next.length > 0) {
      const current = next;
      next = [];
      for(const state of current) {
        // create initial state, including queue of related hashes that must
        // be processed in sorted order
        if(!state.md) {
          // 1) Create a hash to related blank nodes map for storing hashes
          // that identify related blank nodes.
          // Note: 2) and 3) handled within `createHashToRelated`.
          state.md = new MessageDigest(this.hashAlgorithm);
          const hashToRelated = this.createHashToRelated(
            state.id, state.issuer);

          // 4) Create an empty string, data to hash.
          // NRI Note: We created an `md` interface for this above.

          // 5) For each related hash to blank node list mapping in hash to
          // related blank nodes map, sorted lexicographically by related hash:
          // NRI Note: Here we build a queue for storing the chosen path
          // for each related hash; to be determined in order.
          const relatedHashes = [...hashToRelated.keys()].sort();
          for(const hash of relatedHashes) {
            // 5.2) Create a string chosen path.
            // 5.3) Create an unset chosen issuer variable.
            // NRI Note: This data is stored in `state` instead of as a
            // variable in a recursive function. Since we still need to
            // "recurse" through the graph, we track the "recursionsLeft"
            // via a counter on `state` so we know when the final path has been
            // chosen.
            const relatedIds = hashToRelated.get(hash);
            state.relatedQueue.push({
              hash,
              relatedIds,
              permuter: new Permuter(relatedIds),
              chosenPath: '',
              chosenIssuer: null,
              candidates: []
            });
          }
          console.log('BBB queue size', state.id, state.relatedQueue.length);
        }

        // FIXME: should be able to remove this check
        // check if there are more recursions to process, if so, defer
        let relatedResult = state.relatedQueue[state.cursor];
        if(relatedResult && state.recursionsLeft > 0) {
          // FIXME: this should not be possible
          console.log('deferring');
          next.push(state);
          continue;
        }

        // check if current related hash has had its chosen path determined
        if(relatedResult && state.recursionsLeft === 0 &&
          !relatedResult.permuter.hasNext()) {
          // 5.1) Append the related hash to the data to hash.
          state.md.update(relatedResult.hash);

          // NRI Note: At this point all candidates have the same initial path,
          // stored under `relatedResult.chosenPath`; now determine which
          // candidate's recursions would produce the best path segment.
          let bestSegment = '';
          for(const candidate of relatedResult.candidates) {
            let {issuerCopy} = candidate;
            let segment = '';
            let nextCandidate = false;
            for(const recursionResult of candidate.recursions) {
              // 5.4.5.1) Set result to the result of recursively executing
              // the Hash N-Degree Quads algorithm, passing related for
              // identifier and issuer copy for path identifier issuer.
              const {id: related, issuer, hash} = recursionResult;

              // 5.4.5.2) Use the Issue Identifier algorithm, passing issuer
              // copy and related and append the result to path.
              // Note: Here we're working on a path segment.
              console.log('BBB issuing 2', related);
              console.log('BBB issuerCopy 2', issuerCopy);
              segment += issuerCopy.getId(related);

              // 5.4.5.3) Append <, the hash in result, and > to path.
              segment += `<${hash}>`;

              // 5.4.5.4) Set issuer copy to the identifier issuer in
              // result.
              console.log('BBB issuer 2', issuer);
              issuerCopy = issuer;

              // 5.4.5.5) If chosen path is not empty and the length of path
              // is greater than or equal to the length of chosen path and
              // path is lexicographically greater than chosen path, then
              // skip to the next permutation.
              // Note: Comparing path length to chosen path length can be
              // optimized away; only compare lexicographically.
              // Note: Since this is a non-recursive implementation, we're
              // comparing only path segments.
              if(bestSegment.length !== 0 && segment > bestSegment) {
                nextCandidate = true;
                break;
              }
            } // end processing candidate recursion results

            if(nextCandidate) {
              continue;
            }

            // 5.4.6) If chosen path is empty or path is lexicographically
            // less than chosen path, set chosen path to path and chosen
            // issuer to issuer copy.
            // Note: Since this is a non-recursive implementation, here
            // we set the best path segment.
            if(bestSegment.length === 0 || segment < bestSegment) {
              bestSegment = segment;
              relatedResult.chosenIssuer = issuerCopy;
            }
          } // end processing candidates

          // best candidate chosen, append best path segment
          relatedResult.chosenPath += bestSegment;

          // 5.5) Append chosen path to data to hash.
          console.log('BBB chosenPath', state.id, relatedResult.chosenPath);
          state.md.update(relatedResult.chosenPath);
          // 5.6) Replace issuer, by reference, with chosen issuer.
          state.issuer = relatedResult.chosenIssuer;
          console.log('BBB chosenIssuer', state.id, state.issuer);
          // process the next related hash
          relatedResult = state.relatedQueue[++state.cursor];
        }

        // see if there are no more related hashes to process
        if(!relatedResult) {
          // FIXME: remove me
          //console.log('step6', state.id);
          //process.exit(1);
          // 6) Return issuer and the hash that results from passing data to
          // hash through the hash algorithm.
          // NRI Note: We set `state.hash` here and then only return if
          // this is the base state, otherwise we must loop.
          state.hash = state.md.digest();
          if(!state.parent) {
            return {hash: state.hash, issuer: state.issuer};
          }

          // decrement recursions left
          if(--state.parent.recursionsLeft === 0) {
            // no recursions left, parent must be processed
            next.push(state.parent);
          }
          continue;
        }

        // Note NRI: Here we initialize processing the next related hash,
        // which is the main work inside of the loop of step 5, starting
        // at 5.4. Steps 5.1-5.3 are handled differently due to how state
        // is tracked differently. Similarly, the steps in 5.4.5 that
        // involve recursion are changed here to store the recursion state
        // to be processed in the loop and to perform the steps after the
        // recursion once the loop has updated that state.
        state.recursionsLeft = 0;

        // 5.4) For each permutation of blank node list:
        // NRI Note: Here we work only on the next permutation and keep track
        // of `candidates` for tracking the choice that will result in the
        // shortest path for the current related hash.
        const permutation = relatedResult.permuter.next();

        // 5.4.1) Create a copy of issuer, issuer copy.
        console.log('BBB copying issuer', state.issuer);
        const issuerCopy = state.issuer.clone();
        console.log('BBB result issuer', issuerCopy);

        // 5.4.2) Create a string path.
        let path = '';

        // 5.4.3) Create a recursion list, to store blank node identifiers
        // that must be recursively processed by this algorithm.
        // NRI Note: This list will be processed after each permutation has
        // built the first part of its path, which also allows for more
        // aggressive culling of paths that will not be chosen.
        const recursionList = [];

        // 5.4.4) For each related in permutation:
        let nextPermutation = false;
        for(const related of permutation) {
          // 5.4.4.1) If a canonical identifier has been issued for
          // related, append it to path.
          if(this.canonicalIssuer.hasId(related)) {
            path += this.canonicalIssuer.getId(related);
          } else {
            // 5.4.4.2) Otherwise:
            // 5.4.4.2.1) If issuer copy has not issued an identifier for
            // related, append related to recursion list.
            if(!issuerCopy.hasId(related)) {
              console.log('BBB recursionList', related);
              recursionList.push(related);
            }
            // 5.4.4.2.2) Use the Issue Identifier algorithm, passing
            // issuer copy and related and append the result to path.
            console.log('BBB issuing 1', related);
            path += issuerCopy.getId(related);
          }

          // 5.4.4.3) If chosen path is not empty and the length of path
          // is greater than or equal to the length of chosen path and
          // path is lexicographically greater than chosen path, then
          // skip to the next permutation.
          // Note: Comparing path length to chosen path length can be
          // optimized away; only compare lexicographically.
          if(relatedResult.chosenPath.length > 0 &&
            path > relatedResult.chosenPath) {
            console.log('BBB skip permutation', related);
            nextPermutation = true;
            break;
          }
        } // end loop iterating within a permutation

        if(nextPermutation) {
          // push state for further processing
          next.push(state);
          continue;
        }

        // NRI Note: We can set the chosen path here as every permutation
        // builds its first segment of the path concurrently. The chosen
        // path will just hold the first chosen segment of the path.
        if(relatedResult.chosenPath.length === 0 ||
          path < relatedResult.chosenPath) {
          relatedResult.chosenPath = path;
          // clear any candidates that were previously added as they
          // do not have the shortest path
          console.log('BBB reset candidates');
          relatedResult.candidates = [];
        }

        // process viable candidate
        console.log('BBB viable candidate');
        const recursions = [];
        const candidate = {issuerCopy, path, recursionList, recursions};
        relatedResult.candidates.push(candidate);

        if(recursionList.length === 0) {
          // since paths up to this point are the same for all candidates,
          // a candidate with no recursions means all candidates will
          // have no recursions and the candidates are equivalent; push state
          // to continue processing
          next.push(state);
          continue;
        }

        // FIXME: must process recursions in order as well; this means
        // we cannot simply push them onto the work queue, we must do
        // each one serially and have a "next recursion" cursor instead
        // of a recursionsLeft counter

        // 5.4.5) For each related in recursion list:
        for(const related of recursionList) {
          // 5.4.5.1) Set result to the result of recursively executing
          // the Hash N-Degree Quads algorithm, passing related for
          // identifier and issuer copy for path identifier issuer.
          // NRI Note: Instead we push state to an array to be processed and
          // increment the recursions left.
          const recursionResult = {
            id: related, issuer: issuerCopy,
            md: null, hashToRelated: null,
            relatedQueue: [], cursor: 0, recursionsLeft: -1,
            parent: state,
            hash: null
          };
          next.push(recursionResult);
          // increment recursions left that must be processed before
          // using the chosen path/knowing it is the final choice
          recursions.push(recursionResult);
          console.log('BBB recursing into', related);
          state.recursionsLeft++;
        } // end process remaining candidates
      } // end current work queue loop
    } // end next work queue loop
    // FIXME: should never happen
    console.log('should not happen');
    process.exit(1);
    return {hash: baseState.hash, issuer: baseState.issuer};
  }

  // helper for modifying component during Hash First Degree Quads
  modifyFirstDegreeComponent(id, component) {
    if(component.termType !== 'BlankNode') {
      return component;
    }
    /* Note: A mistake in the URDNA2015 spec that made its way into
    implementations (and therefore must stay to avoid interop breakage)
    resulted in an assigned canonical ID, if available for
    `component.value`, not being used in place of `_:a`/`_:z`, so
    we don't use it here. */
    return {
      termType: 'BlankNode',
      value: component.value === id ? '_:a' : '_:z'
    };
  }

  // helper for getting a related predicate
  getRelatedPredicate(quad) {
    return `<${quad.predicate.value}>`;
  }

  // helper for creating hash to related blank nodes map
  createHashToRelated(id, issuer) {
    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    const hashToRelated = new Map();

    // 2) Get a reference, quads, to the list of quads in the blank node to
    // quads map for the key identifier.
    const quads = this.blankNodeInfo.get(id).quads;

    // 3) For each quad in quads:
    for(const quad of quads) {
      // 3.1) For each component in quad, if component is the subject, object,
      // or graph name and it is a blank node that is not identified by
      // identifier:
      // steps 3.1.1 and 3.1.2 occur in helpers:
      this._addRelatedBlankNodeHash({
        quad, component: quad.subject, position: 's',
        id, issuer, hashToRelated
      });
      this._addRelatedBlankNodeHash({
        quad, component: quad.object, position: 'o',
        id, issuer, hashToRelated
      });
      this._addRelatedBlankNodeHash({
        quad, component: quad.graph, position: 'g',
        id, issuer, hashToRelated
      });
    }

    return hashToRelated;
  }

  _hashAndTrackBlankNode({id, hashToBlankNodes}) {
    // 5.3.1) Create a hash, hash, according to the Hash First Degree
    // Quads algorithm.
    const hash = this.hashFirstDegreeQuads(id);

    // 5.3.2) Add hash and identifier to hash to blank nodes map,
    // creating a new entry if necessary.
    const idList = hashToBlankNodes.get(hash);
    if(!idList) {
      hashToBlankNodes.set(hash, [id]);
    } else {
      idList.push(id);
    }
  }

  _addBlankNodeQuadInfo({quad, component}) {
    if(component.termType !== 'BlankNode') {
      return;
    }
    const id = component.value;
    const info = this.blankNodeInfo.get(id);
    if(info) {
      info.quads.push(quad);
    } else {
      this.blankNodeInfo.set(id, {quads: [quad], hash: null});
    }
  }

  _addRelatedBlankNodeHash(
    {quad, component, position, id, issuer, hashToRelated}) {
    if(!(component.termType === 'BlankNode' && component.value !== id)) {
      return;
    }
    // 3.1.1) Set hash to the result of the Hash Related Blank Node
    // algorithm, passing the blank node identifier for component as
    // related, quad, path identifier issuer as issuer, and position as
    // either s, o, or g based on whether component is a subject, object,
    // graph name, respectively.
    const related = component.value;
    const hash = this.hashRelatedBlankNode(related, quad, issuer, position);

    // 3.1.2) Add a mapping of hash to the blank node identifier for
    // component to hash to related blank nodes map, adding an entry as
    // necessary.
    const entries = hashToRelated.get(hash);
    if(entries) {
      entries.push(related);
    } else {
      hashToRelated.set(hash, [related]);
    }
  }

  _useCanonicalId({component}) {
    if(component.termType === 'BlankNode' &&
      !component.value.startsWith(this.canonicalIssuer.prefix)) {
      component.value = this.canonicalIssuer.getId(component.value);
    }
  }
};

function _stringHashCompare(a, b) {
  return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0;
}
