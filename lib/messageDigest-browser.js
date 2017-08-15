/*
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

//var forge = require('node-forge');
var forge = require('node-forge/lib/forge');
require('node-forge/lib/md');
require('node-forge/lib/sha1');
require('node-forge/lib/sha256');

module.exports = MessageDigest;

/**
 * Creates a new MessageDigest.
 *
 * @param algorithm the algorithm to use.
 */
function MessageDigest(algorithm) {
  if(!(this instanceof MessageDigest)) {
    return new MessageDigest(algorithm);
  }

  this.md = forge.md[algorithm].create();
}

MessageDigest.prototype.update = function(msg) {
  this.md.update(msg, 'utf8');
};

MessageDigest.prototype.digest = function() {
  return this.md.digest().toHex();
};
