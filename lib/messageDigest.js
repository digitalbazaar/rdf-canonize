/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

var forge = require('node-forge');

module.exports = MessageDigest;

// determine if using node.js
var _nodejs = (
  typeof process !== 'undefined' && process.versions && process.versions.node);

// FIXME: sufficient to change to a simple try/catch around require?
var crypto;
if(_nodejs) {
  crypto = require('crypto');
}

/**
 * Creates a new MessageDigest.
 *
 * @param algorithm the algorithm to use.
 */
function MessageDigest(algorithm) {
  if(!(this instanceof MessageDigest)) {
    return new MessageDigest(algorithm);
  }

  if(crypto) {
    this.md = crypto.createHash(algorithm);
  } else {
    this.md = forge.md[algorithm].create();
  }
}
MessageDigest.prototype.update = function(msg) {
  this.md.update(msg, 'utf8');
};

if(crypto) {
  MessageDigest.prototype.digest = function() {
    return this.md.digest('hex');
  };
} else {
  MessageDigest.prototype.digest = function() {
    return this.md.digest().toHex();
  };
}
