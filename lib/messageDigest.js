/**
 * BSD 3-Clause License
 * Copyright (c) 2016 Digital Bazaar, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *.now
 * Neither the name of the Digital Bazaar, Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
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
