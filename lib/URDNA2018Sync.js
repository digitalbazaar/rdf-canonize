/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const IdentifierIssuer = require('./IdentifierIssuer');
const NQuads = require('./NQuads');
const util = require('./util');

const COMPONENTS = ['subject', 'object', 'graph'];

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

    this.computeOrbits({
      unlabeled,
      // TODO: refactor `orbitAction` ... hashes no longer used
      orbitAction: ({hashGroups, issuer, complete}) => {
        // filter out unique hashes and assign labels to any unique bnodes
        const uniqueHashes = Object.keys(hashGroups)
          .filter(h => hashGroups[h].length === 1);
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
        const remaining = [...firstInfo.state.orbiting]
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
          info => ({info, unlabeled: info.state.orbiting, state: {}}));
        let winner;
        for(let orbit = 1; !winner; ++orbit) {
          //console.log('speculative orbit', orbit);
          const candidates = [];
          for(const {info, unlabeled, state} of group) {
            //console.log('best orbit at', orbit);
            const hashGroupType = this.bestHashGroupTypeAtOrbit(
              {info, orbit, unlabeled: new Set(unlabeled), state});
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

  bestHashGroupTypeAtOrbit({info, orbit: stopOrbit, unlabeled, state}) {
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
      state,
      orbitAction: ({hashGroups, orbit, complete}) => {
        if(orbit === stopOrbit || complete === unlabeled.size) {
          //console.log('info.id', info.id);
          //console.log('hashgroups', hashGroups);
          result = this.bestHashGroupType({hashGroups});
          //console.log('complete', complete, 'size', unlabeled.size, 'max', stopOrbit);
          result.orbit = orbit;
          result.complete = hashGroups[result.hash][0].state.orbitHashComplete;
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

  computeOrbits(
    {unlabeled, issuer = this.canonicalIssuer, state = {}, orbitAction}) {

    // TODO: adjust algorithm so
    // 1. every time a new orbit hash is computed, for each bnode X,
    //    we consume the quads of every bnode Y in that orbit using
    //    :o0<bnodeXhash> _oN<bnodeYHash>, where N is min(maxOrbit, N-1)
    //    then use the resulting hash to consume quads of bnodes in N-1 until
    //    we reach our own quads and produce a new hash for the orbit...
    //    perhaps no speculative orbiting is necessary after this... when
    //    unique hashes are found name all nodes in orbit that are unique
    //    wrt to the bnode getting named
    // 2. then reset and start over -- and that's the only loop
    // TODO: also -- we don't need to produce new nquads each time, just
    //   slice the quads array and sort it differently, then write compare
    //   function.

    let orbit = 1;
    let complete = 0;

    // restore state
    if(state.orbit !== undefined) {
      orbit = state.orbit;
      complete = state.complete;
      for(const info of unlabeled) {
        info.state = state.infos[info.id];
      }
    }

    for(; unlabeled.size > 0; ++orbit) {
      //console.log('orbit', orbit);
      const hashGroups = {};
      for(const info of unlabeled) {
        const orbitHash = this.computeOrbitHash({info, orbit, issuer});
        if(info.state.orbitHashComplete) {
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

      // call custom orbital action and restart loop or quit if requested
      const rval = orbitAction(
        {unlabeled, hashGroups, orbit, issuer, complete});
      if(rval === true) {
        complete = orbit = 0;
      } else if(rval === false) {
        // save state
        state.orbit = orbit;
        state.complete = complete;
        state.infos = {};
        for(const info of unlabeled) {
          state.infos[info.id] = info.state;
        }
        break;
      }
    }

    // save state
    state.orbit = orbit;
    state.complete = complete;
    state.infos = {};
    for(const info of unlabeled) {
      state.infos[info.id] = info.state;
    }
  }

  computeOrbit({info, orbit, issuer = this.canonicalIssuer}) {
    if(orbit === 0) {
      info.state = {
        seen: new Set(),
        orbitGroups: [],
        quads: [info.quads.slice()],
        names: {},
        complete: false
      };
    } else {
      if(info.state.complete) {
        return;
      }
      // add quads from non-c14n bnodes in previous orbit
      const orbitGroup = info.state.orbitGroups[orbit - 1];
      const quads = info.state.quads[orbit - 1].slice();
      info.state.quads[orbit] = quads;
      orbitGroup.members.forEach(info => {
        if(!issuer.hasId(info.id)) {
          quads.push(...info.quads);
        }
      });
    }

    const {state} = info;

    // add all bnodes orbiting at the current level
    const orbitGroup = state.orbitGroups[orbit] = {members: []};
    for(const quad of state.quads) {
      this.forEachComponent(quad, component => {
        // add every non-c14n orbiting bnode that hasn't been seen yet
        if(component.termType === 'BlankNode' &&
          !issuer.hasId(component.value)) {
          const candidate = this.blankNodeInfo[component.value];
          if(!state.seen.has(candidate)) {
            state.seen.add(candidate);
            orbitGroup.members.push({info: candidate});
          }
        }
      });
    }

    if(orbitGroup.members.length === 0) {
      // TODO: need to know that the orbit is complete when computing
      // it instead of one iteration later... in order for comparisons to work
      // properly as we don't know the processing order of bnodes

      // no members in orbit group, so orbits are complete
      state.complete = true;
      state.maxOrbit = Math.max(0, orbit - 1);
    }

    // resort every orbit with non-unique groups
    const names = state.names;
    for(const orbitGroup of state.orbitGroups) {
      if(orbitGroup.memberUnique) {
        // every member is already unique, no need to resort
        continue;
      }

      // sort the orbit group, grouping bnodes that sort the same
      const sortGroups = {};
      orbitGroup.members.sort((info1, info2) => {
        const {id: id1} = info1;
        const {id: id2} = info2;
        let diff = this.compareBlankNodes({id1, id2, issuer, names, orbit});
        if(diff === 0) {
          const sortGroup = sortGroups[id1] || sortGroups[id2];
          if(!sortGroup) {
            sortGroup = {
              members: [{info: info1}, {info: info2}]
            };
            sortGroups[id1] = sortGroups[id2] = sortGroup;
          } else if(!(id1 in sortGroups)) {
            sortGroups[id1] = sortGroup;
            sortGroup.members.push({info: info1});
          } else if(!(id2 in sortGroups)) {
            sortGroups[id2] = sortGroup;
            sortGroup.members.push({info: info2});
          }
        }
        return diff;
      });

      // TODO: both these TODOs should be covered now
      // TODO: need to track names so they can be used when issuing c14n names
      // TODO: need to preserve orbit names from previous orbit so they can
      // be used for comparison against other bnodes in sort function

      // name each bnode according to its group
      let sortGroupNumber = 0;
      orbitGroup.membersUnique = true;
      for(const info of orbitGroup.members) {
        const sortGroup = sortGroups[info.id];
        if(sortGroup.visited) {
          continue;
        }
        sortGroup.visited = true;
        if(sortGroup.members.length === 1) {
          sortGroup.members[0].unique = true;
        } else {
          orbitGroup.membersUnique = false;
        }
        const name = '_:o' + orbit + '_' + (sortGroupNumber++);
        sortGroup.members.forEach(m => state.names[m.info.id][orbit] = name);
      }
    }
  }

  // TODO: use canonical issuer, do not pass
  compareQuads({q1, q2, issuer, names, orbit}) {
    // compare in quad order: subject, object, graph
    for(const key of COMPONENTS) {
      const c1 = q1[key];
      const c2 = q2[key];
      const diff = this.compareComponents({c1, c2, issuer, names, orbit});
      if(diff !== 0) {
        return diff;
      }
    }
    return 0;
  }

  compareComponents({c1, c2, issuer, names, orbit}) {
    if(c1 === c2) {
      return 0;
    }
    if(c1 === undefined) {
      return -1;
    }
    if(c2 === undefined) {
      return 1;
    }

    if(c1.termType !== c2.termType) {
      // order: DefaultGraph, NamedNode, Literal, BlankNode
      return c2.termType.localeCompare(c1.termType);
    }
    if(c1.termType === 'DefaultGraph') {
      return 0;
    }
    if(c1.termType === 'IRI') {
      return c1.value.localeCompare(c2.value);
    }
    if(c1.termType === 'Literal') {
      return this.compareLiterals(c1, c2);
    }
    return this.compareBlankNodes(
      {id1: c1.value, id2: c2.value, issuer, names, orbit});
  }

  compareLiterals(c1, c2) {
    // compare datatypes
    let diff = this.compareComponents(c1.datatype, c2.datatype);
    if(diff !== 0) {
      return diff;
    }

    // compare languages
    diff = (c2.language === undefined) - (c1.language === undefined);
    if(diff === 0 && c1.language !== undefined) {
      diff = c1.localeCompare(c2);
    }
    if(diff !== 0) {
      return diff;
    }

    // compare values
    return c1.value.localeCompare(c2.value);
  }

  compareBlankNodes({id1, id2, issuer, names, orbit}) {
    const c1Issued = issuer.hasId(id1);
    const c2Issued = issuer.hasId(id2);
    if(c1Issued && c2Issued) {
      return issuer.getId(id1).localeCompare(issuer.getId(id2));
    }
    let diff = c2Issued - c1Issued;
    if(diff !== 0) {
      return diff;
    }

    if(orbit === 0) {
      return 0;
    }

    const {state: c1State} = this.blankNodeInfo[id1];
    const {state: c2State} = this.blankNodeInfo[id2];

    // compare orbit-completeness
    if(c1State.maxOrbit !== c2State.maxOrbit) {
      // TODO: need to fix when `maxOrbit` is known ... needs to be computed
      // at `orbit` time, not `orbit + 1`
      const c1Complete = (c1State.complete && c1State.maxOrbit < (orbit - 1));
      const c2Complete = (c2State.complete && c2State.maxOrbit < (orbit - 1));
      diff = c2Complete - c1Complete;
      if(diff === 0 && c1Complete) {
        diff = c1State.maxOrbit - c2State.maxOrbit;
      }
      if(diff !== 0) {
        return diff;
      }
    }

    // compare names from previous orbit
    const c1Name = names[id1][orbit - 1];
    const c2Name = names[id2][orbit - 1];
    diff = c1Name.localeCompare(c2Name);
    if(diff !== 0) {
      return diff;
    }

    // compare quads from previous orbit
    const c1Quads = c1State.quads[orbit - 1];
    const c2Quads = c2State.quads[orbit - 1];

    // fewer quads is first
    diff = c1Quads.length - c2Quads.length;
    if(diff !== 0) {
      return diff;
    }

    // sort quads using `names`
    c1Quads.sort((q1, q2) => this.compareQuads(
      {q1, q2, issuer, names, orbit: orbit - 1}));
    c2Quads.sort((q1, q2) => this.compareQuads(
      {q1, q2, issuer, names, orbit: orbit - 1}));

    // find first quad, if any
    for(let i = 0; i < c1Quads.length; ++i) {
      diff = this.compareQuads(
        {q1: c1Quads[i], q2: c2Quads[i], issuer, names, orbit: orbit - 1});
      if(diff !== 0) {
        return diff;
      }
    }

    return 0;
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
