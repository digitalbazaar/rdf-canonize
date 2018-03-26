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
    this.quads;
  }

  // 4.4) Normalization Algorithm
  main(dataset) {
    // 1) Create the normalization state.
    const unlabeled = this.init({dataset});

    // unlabeled bnodes isomorphisms stack
    this.isomorphisms = [unlabeled];

    // TODO: could potentially optimize by doing this earlier within `init`
    // label bnodes by unique quad cardinality
    this.labelByQuadCardinality({unlabeled});

    // find isomorphisms and label bnodes in every one separately
    while(this.isomorphisms.length > 0) {
      const isomorphism = this.isomorphisms[this.isomorphisms.length - 1];
      if(isomorphism.size === 0) {
        this.isomorphisms.pop();
        continue;
      }

      // differentiate bnodes according to other orbiting bnodes
      let orbit = 0;
      let complete = 0;
      for(; isomorphism.size > 0; ++orbit, complete = 0) {
        //console.log('orbit', orbit);
        //console.log('size', isomorphism.size);
        // compute orbits
        for(const info of isomorphism) {
          this.computeOrbit({info, orbit});
        }

        // update and track orbit computation completion status
        for(const info of isomorphism) {
          if(info.state.maxOrbit === orbit) {
            info.state.complete = true;
          }
          if(info.state.complete) {
            complete++;
          }
        }

        // sort blank nodes into groups to find unique bnodes in order
        const infos = [...isomorphism];
        const sortGroups = this.getSortGroups({infos, orbit});
        const unique = infos.filter(info =>
          sortGroups[info.id].members.length === 1);

        // if there are unique blank nodes, name them all
        if(unique.length > 0) {
          //console.log('before', isomorphism.size);
          unique.forEach(info => this.assignLabel({info}));
          //console.log('after', isomorphism.size);
          // restart orbit computation
          orbit = -1;
          //console.log('restart');
          continue;
        }

        // not all orbit computations are complete so continue to next orbit
        if(complete < isomorphism.size) {
          continue;
        }

        // label the first bnode from the first group, creating a new
        // isomorphism that must be labeled before other bnodes are labeled
        const [info] = infos;
        this.assignLabel({info});

        // label every related bnode that is unique now and add the others
        // to the next isomorphism to be labeled
        const nextIsomorphism = [];
        for(const orbitGroup of info.state.orbitGroups) {
          if(orbitGroup.memberUnique) {
            this.assignLabel({info: orbitGroup.members[0].info});
          } else {
            nextIsomorphism.push(...orbitGroup.members
              .map(m => m.info)
              .filter(info => !this.canonicalIssuer.hasId(info.id)));
          }
        }

        // push next isomorphism and break to label it
        this.isomorphisms.push(new Set(nextIsomorphism));
        break;
      }
    }

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

  init({dataset}) {
    this.quads = dataset;
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
    // Note: We use a set here and it was generated during step 2.
    return unlabeled;
  }

  labelByQuadCardinality({unlabeled}) {
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
    sortedCardinality.forEach(info => this.assignLabel({info}));
  }

  computeOrbit({info, orbit}) {
    if(orbit === 0) {
      info.state = {
        seen: new Set([info.id]),
        orbitGroups: [{members: [{info}], orbit}],
        quads: [info.quads.slice()],
        names: [],
        complete: false
      };
    } else {
      if(info.state.maxOrbit === orbit) {
        // orbit computation complete, nothing to do
        return;
      }

      // add quads from non-c14n bnodes in current orbit group
      const orbitGroup = info.state.orbitGroups[orbit];
      const quads = info.state.quads[orbit - 1].slice();
      info.state.quads[orbit] = quads;
      orbitGroup.members.forEach(m => {
        if(!this.canonicalIssuer.hasId(m.info.id)) {
          quads.push(...m.info.quads);
        }
      });
    }

    const {state} = info;

    // assign an orbit name to every bnode seen thus far; copy previous `names`
    const names = state.names[orbit] = Object.assign(
      state.names[orbit - 1] || {});
    // sort every orbit group that contains non-unique sort groups when
    // assigning names, because new unique sort groups may have emerged
    for(const orbitGroup of state.orbitGroups) {
      //console.log('orbitGroup', orbitGroup.members.map(m=>m.info));
      if(orbitGroup.membersUnique) {
        // every member is already unique; names already assigned
        continue;
      }

      // sort the orbit group, grouping bnodes that sort the same according
      // to the previous orbit
      const infos = orbitGroup.members.map(m => m.info);
      //console.log('get sort groups for orbit', orbit);
      const sortGroups = this.getSortGroups({infos, names, orbit: orbit - 1});
      orbitGroup.sorted = infos;
      //console.log('sortGroups', sortGroups);

      // name each bnode according to its orbit and sort group
      let sortGroupNumber = 0;
      orbitGroup.membersUnique = true;
      for(const info of infos) {
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
        const name = '_:o' + orbitGroup.orbit + '_' + (sortGroupNumber++);
        sortGroup.members.forEach(m => names[m.info.id] = name);
      }
    }

    // add all bnodes in current quads to the next orbit group
    const nextOrbitGroup = {members: [], orbit: orbit + 1};
    const quads = state.quads[orbit];
    for(const quad of quads) {
      this.forEachComponent(quad, component => {
        // add every non-c14n orbiting bnode that hasn't been seen yet
        if(component.termType === 'BlankNode' &&
          !this.canonicalIssuer.hasId(component.value)) {
          const candidate = this.blankNodeInfo[component.value];
          if(!state.seen.has(candidate)) {
            state.seen.add(candidate);
            nextOrbitGroup.members.push({info: candidate});
          }
        }
      });
    }
    if(nextOrbitGroup.members.length > 0) {
      state.orbitGroups[orbit + 1] = nextOrbitGroup;
    } else {
      // no more orbiting bnodes, so set max orbit
      state.maxOrbit = orbit;
    }
  }

  getSortGroups({infos, names, orbit}) {
    // sort bnode infos, grouping bnodes that sort the same
    const sortGroups = {};
    //console.log('sorting', infos);
    if(infos.length === 1) {
      const [info] = infos;
      sortGroups[info.id] = {members: [{info}]};
      return sortGroups;
    }
    infos.sort((info1, info2) => {
      const {id: id1} = info1;
      const {id: id2} = info2;
      const diff = this.compareBlankNodes(
        {id1, id2, info1, info2, names, orbit});
      if(diff === 0) {
        let sortGroup = sortGroups[id1] || sortGroups[id2];
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
      } else {
        if(!(id1 in sortGroups)) {
          sortGroups[id1] = {members: [{info: info1}]};
        }
        if(!(id2 in sortGroups)) {
          sortGroups[id2] = {members: [{info: info2}]};
        }
      }
      return diff;
    });
    //console.log('resulting sort groups', sortGroups);
    return sortGroups;
  }

  compareQuads({q1, q2, names, orbit}) {
    // compare in quad order: subject, object, graph
    for(const key of COMPONENTS) {
      const c1 = q1[key];
      const c2 = q2[key];
      // never recurse into quads as we are already comparing quads, would
      // produce a cycle
      const diff = this.compareComponents(
        {c1, c2, names, orbit, recurse: false});
      if(diff !== 0) {
        return diff;
      }
    }
    return 0;
  }

  compareComponents({c1, c2, names, orbit, recurse}) {
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
      return this.compareLiterals({c1, c2});
    }
    return this.compareBlankNodes(
      {id1: c1.value, id2: c2.value, names, orbit, recurse});
  }

  compareLiterals({c1, c2}) {
    // compare datatypes (note: recusion not possible, datatype cannot be bnode)
    let diff = this.compareComponents({c1: c1.datatype, c2: c2.datatype});
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

  compareBlankNodes({id1, id2, info1, info2, names, orbit, recurse}) {
    const c1Issued = this.canonicalIssuer.hasId(id1);
    const c2Issued = this.canonicalIssuer.hasId(id2);
    if(c1Issued && c2Issued) {
      return this.canonicalIssuer.getId(id1).localeCompare(
        this.canonicalIssuer.getId(id2));
    }
    let diff = c2Issued - c1Issued;
    if(diff !== 0) {
      return diff;
    }

    //console.log('id1', id1);
    //console.log('id2', id2);
    info1 = info1 || this.blankNodeInfo[id1];
    info2 = info2 || this.blankNodeInfo[id2];
    //console.log('info1', info1);
    //console.log('info2', info2);

    if(orbit <= 0) {
      // compare number of quads
      return info1.quads.length - info2.quads.length;
    }

    const {state: c1State} = info1;
    const {state: c2State} = info2;

    // compare orbit-completeness
    if(c1State.complete || c2State.complete) {
      // `complete` orbit computation comes first
      diff = c2State.complete - c1State.complete;
      if(diff === 0 && c1State.complete) {
        diff = c1State.maxOrbit - c2State.maxOrbit;
      }
      if(diff !== 0) {
        return diff;
      }
    }

    // compare using names from previous orbit
    let c1Name;
    let c2Name;
    //console.log('names', names);
    //console.log('orbit', orbit);
    if(names) {
      // use `names` localized to computing orbit for a particular bnode
      c1Name = names[id1];
      c2Name = names[id2];
      if(c1Name !== c2Name) {
        if(!c1Name) {
          // assigned name comes first
          return 1;
        }
        if(!c2Name) {
          return -1;
        }
        diff = c1Name.localeCompare(c2Name);
        if(diff !== 0) {
          return diff;
        }
      }
    }

    // compare quads from previous orbit
    const c1Quads = c1State.quads[orbit];
    const c2Quads = c2State.quads[orbit];

    // fewer quads is first
    diff = c1Quads.length - c2Quads.length;

    // return if quad cardinality not equal, if `names` was not passed
    // as a common comparison point for quads, or if recursion is off
    if(diff !== 0 || !names || !recurse) {
      return diff;
    }

    // sort quads using `names`
    c1Quads.sort((q1, q2) => this.compareQuads({q1, q2, names, orbit}));
    c2Quads.sort((q1, q2) => this.compareQuads({q1, q2, names, orbit}));

    // find first quad, if any
    for(let i = 0; i < c1Quads.length; ++i) {
      diff = this.compareQuads({q1: c1Quads[i], q2: c2Quads[i], names, orbit});
      if(diff !== 0) {
        return diff;
      }
    }

    return 0;
  }

  assignLabel({info}) {
    if(this.canonicalIssuer.hasId(info.id)) {
      return;
    }
    // FIXME: remove logging and `tmp` var
    const tmp = this.canonicalIssuer.getId(info.id);
    //console.log(`issue ${info.id} => ${tmp}`);
    // TODO: optimize
    for(const isomorphism of this.isomorphisms) {
      isomorphism.delete(info);
    }
  }

  // helper that iterates over quad components (skips predicate)
  forEachComponent(quad, op) {
    for(const key of COMPONENTS) {
      op(quad[key], key, quad);
    }
  }
};
