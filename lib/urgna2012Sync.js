/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

var URDNA2015Sync = require('./urdna2015Sync');
var util = require('./util');

module.exports = URDNA2012Sync;

function URDNA2012Sync(options) {
  URDNA2015Sync.call(this, options);
  this.name = 'URGNA2012';
  this.hashAlgorithm = 'sha1';
}
URDNA2012Sync.prototype = new URDNA2015Sync();

// helper for modifying component during Hash First Degree Quads
URDNA2012Sync.prototype.modifyFirstDegreeComponent = function(
  id, component, key) {
  if(component.type !== 'blank node') {
    return component;
  }
  component = util.clone(component);
  if(key === 'name') {
    component.value = '_:g';
  } else {
    component.value = (component.value === id ? '_:a' : '_:z');
  }
  return component;
};

// helper for getting a related predicate
URDNA2012Sync.prototype.getRelatedPredicate = function(quad) {
  return quad.predicate.value;
};

// helper for creating hash to related blank nodes map
URDNA2012Sync.prototype.createHashToRelated = function(id, issuer) {
  var self = this;

  // 1) Create a hash to related blank nodes map for storing hashes that
  // identify related blank nodes.
  var hashToRelated = {};

  // 2) Get a reference, quads, to the list of quads in the blank node to
  // quads map for the key identifier.
  var quads = self.blankNodeInfo[id].quads;

  // 3) For each quad in quads:
  for(var i = 0; i < quads.length; ++i) {
    // 3.1) If the quad's subject is a blank node that does not match
    // identifier, set hash to the result of the Hash Related Blank Node
    // algorithm, passing the blank node identifier for subject as related,
    // quad, path identifier issuer as issuer, and p as position.
    var quad = quads[i];
    var position;
    var related;
    if(quad.subject.type === 'blank node' && quad.subject.value !== id) {
      related = quad.subject.value;
      position = 'p';
    } else if(quad.object.type === 'blank node' && quad.object.value !== id) {
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
    // 3.4) Add a mapping of hash to the blank node identifier for the
    // component that matched (subject or object) to hash to related blank
    // nodes map, adding an entry as necessary.
    var hash = self.hashRelatedBlankNode(related, quad, issuer, position);
    if(hash in hashToRelated) {
      hashToRelated[hash].push(related);
    } else {
      hashToRelated[hash] = [related];
    }
  }

  return hashToRelated;
};
