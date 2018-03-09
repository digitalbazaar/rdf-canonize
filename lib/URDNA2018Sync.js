/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const IdentifierIssuer = require('./IdentifierIssuer');
const MessageDigest = require('./MessageDigest');
const NQuads = require('./NQuads');
const util = require('./util');

module.exports = class URDNA2018Sync {
  constructor() {
    this.name = 'URDNA2018';
    this.blankNodeInfo = {};
    this.canonicalIssuer = new IdentifierIssuer('_:c14n');
    this.hashAlgorithm = 'sha256';
    this.quads;
    this.hashCache = {};
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

    // TODO: could potentially optimize by doing this earlier
    // get and sort all bnodes with a unique number of quads by cardinality
    const uniqueCardinality = {};
    for(const info of unlabeled) {
      const key = String(info.quads.length);
      if(key in uniqueCardinality) {
        uniqueCardinality[key] = false;
      } else {
        uniqueCardinality[key] = info;
      }
    }
    const sortedCardinality = Object.keys(uniqueCardinality)
      .map(key => uniqueCardinality[key])
      .filter(info => info)
      .sort((a, b) => a.quads.length - b.quads.length);

    // assign labels to all bnodes with unique cardinality in sorted order
    this.assignLabels(sortedCardinality, unlabeled);

    // TODO: ALL NEW STUFF HERE

    this.computeOrbitalHashes({
      unlabeled,
      orbitAction: ({hashGroups, uniqueHashes, issuer, complete}) => {
        // assign labels to any unique bnodes
        if(uniqueHashes.length > 0) {
          const uniqueInfo = uniqueHashes.sort().map(h => hashGroups[h][0]);
          //console.log('unique hashes', uniqueHashes);
          this.assignLabels(uniqueInfo, unlabeled);
          // TODO: should we both restarting the orbit loop here? what is
          // more efficient... just let it keep going or restart it? can we
          // easily tell -- is it always one or the other or more likely to
          // be one or the other... or should we protect against the less
          // likely slow case by making that case more efficient?

          // return true to restart orbit loop
          return true;
        }

        // TODO: consider how not returning early here could affect performance

        // if every bnode has not yet been completely orbit-hashed, so continue
        // with the hope of finding unique hashes
        if(complete < unlabeled.size) {
          return;
        }

        // every bnode has been completely orbit-hashed at this point and no
        // unique hashes turned up, so pick a bnode to label in a
        // consistent way...
        const hashGroupType = this.bestHashGroupType({hashGroups});
        const hashGroup = hashGroups[hashGroupType.hash];
        //console.log('hashes', Object.keys(hashGroups));
        //console.log('best hashGroup hash', hashGroupType.hash);
        //console.log('best hashGroup', hashGroup);

        // if the hash group has a bnode with nothing else in its orbit to
        // name but itself and its orbit hash is complete, name every bnode
        // in the group because they cannot influence any other bnodes and
        // they must be all isomorphic
        const firstInfo = hashGroup[0];
        const remaining = [...firstInfo.orbiting]
          .filter(info => !issuer.hasId(info));
        if(remaining.length === 1) {
          this.assignLabels(hashGroup, unlabeled);
          return true;
        }

        // TODO: degenerate case below...
        // TODO: add optimization to prevent reprocessing of orbit hashing
        //   every time a new orbit is added (i.e. maintain state on each
        //   iteration of the loop below)

        // speculatively name each member in the "best" hash group and pick
        // the one that produces the best hash group type at the lowest orbit
        const group = hashGroup.map(
          info => ({info, unlabeled: info.orbiting}));
        let winner;
        for(let orbit = 1; !winner; ++orbit) {
          //console.log('speculative orbit', orbit);
          const candidates = [];
          for(const {info, unlabeled} of group) {
            //console.log('best orbit at', orbit);
            const hashGroupType = this.bestHashGroupTypeAtOrbit(
              {info, orbit, unlabeled: new Set(unlabeled)});
            hashGroupType.info = info;
            candidates.push(hashGroupType);
          }
          // TODO: need to aggregate candidates by hash

          // sort candidates
          this.sortHashGroupTypes({hashGroupTypes: candidates});
          /*console.log('candidates', JSON.stringify(candidates.map(hg=>(
            {hash: hg.hash, id: hg.info.id, orbit: hg.orbit, length: hg.length})),
            null, 2));*/
          // truncate any candidates that did not tie with the leader
          const leader = candidates[0];
          for(let i = 1; i < candidates.length; ++i) {
            if(this.compareHashGroupTypes(candidates[i], leader) !== 0) {
              candidates.length = i;
              break;
            }
          }
          // pick a winner if only the leader remains or orbits are complete
          if(candidates.length === 1 || leader.complete) {
            winner = leader.info;
            //console.log('winner', leader.hash, winner.id);
          }
        }
        this.assignLabels([winner], unlabeled);
        //console.log('unlabeled', unlabeled.size);
        // return true to restart orbit loop
        return true;
      }
    });

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

    // FIXME: remove me
    //console.log(canonized.join(''));
    //process.exit(1);

    // 8) Return the canonized dataset.
    return canonized.join('');
  }

  bestHashGroupTypeAtOrbit({info, orbit: stopOrbit, unlabeled}) {
    // TODO: could cache orbit hashes per `info` to improve performance
    const issuer = this.canonicalIssuer.clone();
    issuer.getId(info.id);
    // FIXME: remove if unnecessary
    for(const info of unlabeled) {
      if(issuer.hasId(info.id)) {
        unlabeled.delete(info);
      }
    }
    let result;
    this.computeOrbitalHashes({
      unlabeled,
      issuer,
      orbitAction: ({hashGroups, uniqueHashes, orbit, complete}) => {
        // FIXME: ... can't use uniqueness here because it may not be
        //   unique once combined with other results and we need to keep
        //   orbiting... (so remove `uniqueHashes` from being computed)?
        // if(uniqueHashes.length > 0 || orbit == stopOrbit ||
        //   complete === unlabeled.size) {
        if(orbit === stopOrbit || complete === unlabeled.size) {
          //console.log('info.id', info.id);
          //console.log('hashgroups', hashGroups);
          result = this.bestHashGroupType({hashGroups});
          //console.log('complete', complete, 'size', unlabeled.size, 'max', stopOrbit);
          result.orbit = orbit;
          result.complete = hashGroups[result.hash][0].orbitHashComplete;
          return false;
        }
      }
    });
    return result;
  }

  bestHashGroupType({hashGroups}) {
    // return smallest and lexicographical least hash group
    return this.sortHashGroupTypes({
      hashGroupTypes: Object.keys(hashGroups).map(hash => ({
        hash,
        length: hashGroups[hash].length
      }))
    })[0];
  }

  sortHashGroupTypes({hashGroupTypes}) {
    return hashGroupTypes.sort(this.compareHashGroupTypes.bind(this));
  }

  compareHashGroupTypes(a, b) {
    // TODO: do these features need to be incorporated into the hash, rather
    // than breaking them out like this?

    if(a.orbit !== b.orbit) {
      // whichever has the lowest orbit comes first
      return a.orbit - b.orbit;
    }
    if(a.complete !== b.complete) {
      // whichever is `complete` comes first
      return !a.complete - !b.complete;
    }
    if(a.length !== b.length) {
      // whichever is smaller comes first
      return a.length - b.length;
    }
    // whichever hash is lexicographically least comes first
    return a.hash.localeCompare(b.hash);
  }

  computeOrbitalHashes(
    {unlabeled, issuer = this.canonicalIssuer, orbitAction}) {
    let complete = 0;
    for(let orbit = 1; unlabeled.size > 0; ++orbit) {
      //console.log('orbit', orbit);
      const hashGroups = {};
      for(const info of unlabeled) {
        const orbitHash = this.computeOrbitHash({info, orbit, issuer});
        if(info.orbitHashComplete) {
          complete++;
        }
        const group = hashGroups[orbitHash];
        if(group) {
          hashGroups[orbitHash].push(info);
        } else {
          hashGroups[orbitHash] = [info];
        }
      }

      // TODO: optimize to compare quads for uniqueness, not hashes ... then
      // only hash when it's time to create a new orbit

      // filter out unique hashes and assign labels to any unique bnodes
      const uniqueHashes = Object.keys(hashGroups)
        .filter(h => hashGroups[h].length === 1);

      // call custom orbital action and restart loop or quit if requested
      const rval = orbitAction(
        {unlabeled, hashGroups, uniqueHashes, orbit, issuer, complete});
      if(rval === true) {
        complete = orbit = 0;
      } else if(rval === false) {
        break;
      }
    }
  }

  computeOrbitHash({info, orbit, issuer = this.canonicalIssuer}) {
    if(orbit === 1) {
      info.orbiting = new Set();
      info.nextOrbiting = null;
      info.orbitHashes = [];
      info.orbitHashComplete = false;
    } else {
      if(info.orbitHashComplete) {
        // done, can't modify hash further
        return info.orbitHashes[info.orbitHashes.length - 1];
      }
      // FIXME: can clear previous orbits from memory?
    }

    const orbitQuads = this.serializeOrbitQuads({info, orbit, issuer});
    let orbitHash;
    if(orbitQuads in this.hashCache) {
      orbitHash = this.hashCache[orbitQuads];
    } else {
      const md = new MessageDigest(this.hashAlgorithm);
      //console.log('quads for ' + info.id +':\n' + orbitQuads);
      md.update(orbitQuads);
      // // FIXME: remove me
      // if(!this._hashes) {
      //   this._hashes = 1;
      // } else {
      //   this._hashes++;
      // }
      // console.log('HASHES', this._hashes);
      // // // FIXME: remove above
      // TODO: represent as byte buffer instead to cut memory usage in half
      orbitHash = this.hashCache[orbitQuads] = md.digest();
    }
    info.orbitHashes[orbit] = orbitHash;

    // compute the next orbiting set
    let nextSet = info.nextOrbiting || info.orbiting;
    info.nextOrbiting = new Set();

    // for every bnode X orbiting at the current level...
    for(const orbitInfo of nextSet) {
      const quads = orbitInfo.quads;
      for(const quad of quads) {
        this.forEachComponent(quad, component => {
          // add every orbiting non-c14n bnode that orbits X
          if(component.termType === 'BlankNode' &&
            !issuer.hasId(component.value)) {
            const candidate = this.blankNodeInfo[component.value];
            if(!info.orbiting.has(candidate)) {
              info.orbiting.add(candidate);
              info.nextOrbiting.add(candidate);
            }
          }
        });
      }
    }

    if(info.nextOrbiting.size === 0) {
      info.orbitHashComplete = true;
    }

    return info.orbitHashes[orbit];
  }

  serializeOrbitQuads({info, orbit, issuer}) {
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
          {info, component, key, orbit, issuer});
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
      if(this.canonicalIssuer.hasId(info.id)) {
        continue;
      }
      // FIXME: remove logging and `tmp` var
      const tmp = this.canonicalIssuer.getId(info.id);
      //console.log(`issue ${info.id} => ${tmp}`);
      unlabeled.delete(info);
    }
  }

  // helper for modifying component during Serialize Orbit Quads
  modifyFirstDegreeComponent({info, component, orbit, issuer}) {
    // do not modify if component is not a blank node
    if(component.termType !== 'BlankNode') {
      return component;
    }
    component = util.clone(component);
    // use c14n label if already issued
    if(issuer.hasId(component.value)) {
      component.value = issuer.getId(component.value);
      return component;
    }
    // use relational bnode name (`a` for self, `z` for other) + orbit hash
    let componentInfo;
    if(component.value === info.id) {
      componentInfo = info;
      component.value = '_:a';
    } else {
      componentInfo = this.blankNodeInfo[component.value];
      component.value = '_:z';
    }
    if(orbit === 1) {
      info.orbiting.add(componentInfo);
    } else {
      component.value += componentInfo.orbitHashes[orbit - 1];
    }
    return component;
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
