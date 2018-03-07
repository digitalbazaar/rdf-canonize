/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const IdentifierIssuer = require('./IdentifierIssuer');
const MessageDigest = require('./MessageDigest');
const NQuads = require('./NQuads');
const util = require('./util');

const POSITIONS = {'subject': 's', 'object': 'o', 'graph': 'g'};

module.exports = class URDNA2018Sync {
  constructor() {
    this.name = 'URDNA2018';
    this.blankNodeInfo = {};
    this.canonicalIssuer = new IdentifierIssuer('_:c14n');
    this.hashAlgorithm = 'sha256';
    this.quads;
  }

  // 4.4) Normalization Algorithm
  main(dataset) {
    this.quads = dataset;

    // 1) Create the normalization state.

    const unlabeled = new Set();

    // 2) For every quad in input dataset:
    for(const quad of dataset) {
      // 2.1) For each blank node that occurs in the quad, add a reference
      // to the quad using the blank node identifier in the blank node to
      // quads map, creating a new entry if necessary.
      this.forEachComponent(quad, component => {
        if(component.termType !== 'BlankNode') {
          return;
        }
        const id = component.value;
        if(id in this.blankNodeInfo) {
          this.blankNodeInfo[id].quads.push(quad);
        } else {
          unlabeled.add(this.blankNodeInfo[id] = {id, quads: [quad]});
        }
      });
    }

    // 3) Create a list of non-normalized blank node identifiers
    // non-normalized identifiers and populate it using the keys from the
    // blank node to quads map.
    // Note: We use a map here and it was generated during step 2.

    // TODO: ALL NEW STUFF HERE

    for(let orbit = 1; unlabeled.size > 0; ++orbit) {
      let complete = 0;
      const hashGroups = {};
      for(const info of unlabeled) {
        this.computeOrbitHash(info, orbit);
        if(info.orbitHashComplete) {
          complete++;
        }
        const group = hashGroups[info.orbitHash];
        if(group) {
          hashGroups[info.orbitHash].push(info);
        } else {
          hashGroups[info.orbitHash] = [info];
        }
      }

      // filter out unique hashes and assign labels to any unique bnodes
      const uniqueHash = Object.keys(hashGroups)
        .filter(h => hashGroups[h].length === 1);
      if(uniqueHash.length > 0) {
        const uniqueInfo = uniqueHash.sort().map(h => hashGroups[h][0]);
        this.assignLabels(uniqueInfo, unlabeled);
        complete = orbit = 0;
        continue;
      }

      // if every bnode had been completely orbit-hashed...
      if(complete === unlabeled.size) {
        // sort hashes and label the first bnode in the first group, picking
        // any bnode from that group, at this point, should yield the same
        // labeling because they are all isomorphic
        const firstHash = Object.keys(hashGroups).sort()[0];
        this.assignLabels([hashGroups[firstHash][0]], unlabeled);
        complete = orbit = 0;
      }
    }

    /* Main loop
    1. for(orbit = 1; orbit++)
    2. For each bnode in nonNormalized
    2.1. compute orbit hash
    2.2. if orbit hash is complete, increment completeCount
    3. Filter out unique hashes
    4. if any orbit N hash is unique, sort them and call assignLabel on the
       first one then set orbit = 1 and continue to start orbit hashing again
    5. if completeCount === nonNormalized.length sort the hash groups and
       call assignLabel on any node in the first hash group

    Orbit Hash(bnode, level)
    Get quads for bnode
    Make a copy of each quad.
    Update the quad copy, using the `level-1` hash for each non-c14n bnode,
      where level==0 uses `_:a` for self bnode and `_:z` for other bnode.
    serialize the quads
    hash the quads to create orbit `level` hash and return it

    Assign Label(firstBnode)
    1. Push firstBnode onto queue
    2. For every bnode in the queue:
    2.1. Assign c14n label to bnode
    2.2. For every orbit 1 related unnamed bnode, if its hash is unique, push
         it onto the queue to be named (NOTE: revisit to make recursive easy)

    /* Note: At this point all blank nodes in the set of RDF quads have been
    assigned canonical identifiers, which have been stored in the canonical
    issuer. Here each quad is updated by assigning each of its blank nodes
    its new identifier. */

    // 7) For each quad, quad, in input dataset:
    const canonized = [];
    for(let i = 0; i < this.quads.length; ++i) {
      // 7.1) Create a copy, quad copy, of quad and replace any existing
      // blank node identifiers using the canonical identifiers
      // previously issued by canonical issuer.
      // Note: We optimize away the copy here.
      const quad = this.quads[i];
      this.forEachComponent(quad, component => {
        if(component.termType === 'BlankNode' &&
          !component.value.startsWith(this.canonicalIssuer.prefix)) {
          component.value = this.canonicalIssuer.getId(component.value);
        }
      });
      // 7.2) Add quad copy to the canonized dataset.
      canonized.push(NQuads.serializeQuad(quad));
    }

    // sort canonized output
    canonized.sort();

    // 8) Return the canonized dataset.
    return canonized.join('');
  }

  computeOrbitHash(info, orbit) {
    if(orbit === 1) {
      info.orbiting = new Set();
      info.nextOrbiting = new Set();
      info.previousOrbitHash = null;
      info.orbitHashComplete = false;
    } else {
      if(info.orbitHashComplete) {
        // done, can't modify hash further
        return info.orbitHash;
      }
      // save previous orbit hash
      info.previousOrbitHash = info.orbitHash;
    }

    const orbitQuads = this.serializeOrbitQuads(info, orbit);
    const md = new MessageDigest(this.hashAlgorithm);
    md.update(orbitQuads);
    // TODO: represent as byte buffer instead to cut memory usage in half
    info.orbitHash = md.digest();

    // compute the next orbiting set.
    let nextSet = info.nextOrbiting || info.orbiting;
    info.nextOrbiting = new Set();
    for(const orbitInfo of nextSet) {
      const quads = orbitInfo.quads;
      for(const quad of quads) {
        this.forEachComponent(quad, component => {
          if(component.termType === 'BlankNode' &&
            !this.canonicalIssuer.hasId(component.value &&
            !info.orbiting.has(this.blankNodeInfo[component.value]))) {
            info.nextOrbiting.add(this.blankNodeInfo[component.value]);
          }
        });
      }
    }

    if(info.nextOrbiting.size === 0) {
      info.orbitHashComplete = true;
      // TODO: is this addition to the hash necessary?
      // append `.` to signify that the orbit hash is complete
      info.orbitHash += '.';
    }

    return info.orbitHash;
  }

  serializeOrbitQuads(info, orbit) {
    // 1) Initialize nquads to an empty list. It will be used to store quads in
    // N-Quads format.
    const nquads = [];

    // 2) Get the list of quads `quads` associated with the reference blank
    // node identifier in the blank node to quads map.
    const quads = info.quads;

    // 3) For each quad `quad` in `quads`:
    for(const quad of quads) {
      // 3.1) Serialize the quad in N-Quads format with the following special
      // rule:

      // 3.1.1) If any component in quad is an blank node, then serialize it
      // using a special identifier as follows:
      const copy = {predicate: quad.predicate};
      this.forEachComponent(quad, (component, key) => {
        // 3.1.2) If orbit is 1, then if the blank node's existing blank node
        // identifier matches the reference blank node identifier then use the
        // blank node identifier _:a, otherwise, use the blank node
        // identifier _:z.
        // 3.1.3) Orbit must be greater than 1, so use the blank node's
        // previous orbit hash appended to `_:` as its identifier.
        // 3.1.4) If orbit is 1 and the component is a non-c14n blank node,
        // add it to the blank node's orbiting set.
        copy[key] = this.modifyFirstDegreeComponent(
          info.id, component, key, orbit);
      });
      nquads.push(NQuads.serializeQuad(copy));
    }

    // 4) Sort nquads in lexicographical order.
    nquads.sort();

    // 5) Join the serialized n-quads.
    const orbitQuads = nquads.join('');

    // 6) Return the serialized n-quads.
    return orbitQuads;
  }

  assignLabels(toLabel, unlabeled) {
    while(toLabel.length > 0) {
      const info = toLabel.shift();
      this.canonicalIssuer.getId(info.id);
      unlabeled.delete(info);

      // get all adjacent non-c14n blank nodes
      const adjacent = [];
      for(const quad of info.quads) {
        this.forEachComponent(quad, component => {
          if(component.termType === 'BlankNode' &&
            !this.canonicalIssuer.hasId(component.value)) {
            adjacent.push(this.blankNodeInfo[component.value]);
          }
        });
      }

      // group adjacent nodes by hash, preserving unique groups only
      const groups = {};
      for(const info of adjacent) {
        if(info.orbitHash in groups) {
          groups[info.orbitHash] = false;
        } else {
          groups[info.orbitHash] = info;
        }
      }

      // filter and sort unique adjacent nodes and push them to be labeled
      toLabel.push(...adjacent.filter(info => info === groups[info.orbitHash])
        .sort((a, b) => a.orbitHash.localeCompare(b.orbitHash)));
    }
  }

  // helper for modifying component during Serialize Orbit Quads
  modifyFirstDegreeComponent(id, component, key, orbit) {
    // do not modify if component is not a non-c14n blank node
    if(component.termType !== 'BlankNode' ||
      this.canonicalIssuer.hasId(component.value)) {
      return component;
    }
    component = util.clone(component);
    if(orbit === 1) {
      this.blankNodeInfo[id].orbiting.add(
        this.blankNodeInfo[component.value]);
      component.value = (component.value === id ? '_:a' : '_:z');
    } else {
      component.value = '_:' +
        this.blankNodeInfo[component.value].previousOrbitHash;
    }
    return component;
  }

  // helper for getting a related predicate
  getRelatedPredicate(quad) {
    return '<' + quad.predicate.value + '>';
  }

  // helper that iterates over quad components (skips predicate)
  forEachComponent(quad, op) {
    for(let key in quad) {
      // skip `predicate`
      if(key === 'predicate') {
        continue;
      }
      op(quad[key], key, quad);
    }
  }
};
