/*!
 * Copyright (c) 2016-2022 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const MessageDigest = require('./MessageDigest');
const URDNA2015 = require('./URDNA2015');

module.exports = class URDNA2012 extends URDNA2015 {
  constructor() {
    super();
    this.name = 'URGNA2012';
    this.createMessageDigest = () => new MessageDigest('sha1');
  }

  // helper for modifying component during Hash First Degree Quads
  modifyFirstDegreeComponent(id, component, key) {
    if(component.termType !== 'BlankNode') {
      return component;
    }
    if(key === 'graph') {
      return {
        termType: 'BlankNode',
        value: '_:g'
      };
    }
    return {
      termType: 'BlankNode',
      value: (component.value === id ? '_:a' : '_:z')
    };
  }

  // helper for getting a related predicate
  getRelatedPredicate(quad) {
    return quad.predicate.value;
  }

  // helper for creating hash to related blank nodes map
  async createHashToRelated(id, issuer) {
    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    const hashToRelated = new Map();

    // 2) Get a reference, quads, to the list of quads in the blank node to
    // quads map for the key identifier.
    const quads = this.blankNodeInfo.get(id).quads;

    // 3) For each quad in quads:
    let i = 0;
    for(const quad of quads) {
      // 3.1) If the quad's subject is a blank node that does not match
      // identifier, set hash to the result of the Hash Related Blank Node
      // algorithm, passing the blank node identifier for subject as related,
      // quad, path identifier issuer as issuer, and p as position.
      let position;
      let related;
      if(quad.subject.termType === 'BlankNode' && quad.subject.value !== id) {
        related = quad.subject.value;
        position = 'p';
      } else if(
        quad.object.termType === 'BlankNode' && quad.object.value !== id) {
        // 3.2) Otherwise, if quad's object is a blank node that does not match
        // identifier, to the result of the Hash Related Blank Node algorithm,
        // passing the blank node identifier for object as related, quad, path
        // identifier issuer as issuer, and r as position.
        related = quad.object.value;
        position = 'r';
      } else {
        // 3.3) Otherwise, continue to the next quad.
        continue;
      }
      // Note: batch hashing related blank nodes 100 at a time
      if(++i % 100 === 0) {
        await this._yield();
      }
      // 3.4) Add a mapping of hash to the blank node identifier for the
      // component that matched (subject or object) to hash to related blank
      // nodes map, adding an entry as necessary.
      const hash = await this.hashRelatedBlankNode(
        related, quad, issuer, position);
      const entries = hashToRelated.get(hash);
      if(entries) {
        entries.push(related);
      } else {
        hashToRelated.set(hash, [related]);
      }
    }

    return hashToRelated;
  }
};
