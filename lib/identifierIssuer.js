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

var api = {};
module.exports = api;

/**
 * Creates a new IdentifierIssuer. A IdentifierIssuer issues unique
 * identifiers, keeping track of any previously issued identifiers.
 *
 * @param prefix the prefix to use ('<prefix><counter>').
 */
var IdentifierIssuer = api.IdentifierIssuer = function(prefix) {
  this.prefix = prefix;
  this.counter = 0;
  this.existing = {};
};

/**
 * Copies this IdentifierIssuer.
 *
 * @return a copy of this IdentifierIssuer.
 */
IdentifierIssuer.prototype.clone = function() {
  var copy = new IdentifierIssuer(this.prefix);
  copy.counter = this.counter;
  copy.existing = _clone(this.existing);
  return copy;
};

/**
 * Gets the new identifier for the given old identifier, where if no old
 * identifier is given a new identifier will be generated.
 *
 * @param [old] the old identifier to get the new identifier for.
 *
 * @return the new identifier.
 */
IdentifierIssuer.prototype.getId = function(old) {
  // return existing old identifier
  if(old && old in this.existing) {
    return this.existing[old];
  }

  // get next identifier
  var identifier = this.prefix + this.counter;
  this.counter += 1;

  // save mapping
  if(old) {
    this.existing[old] = identifier;
  }

  return identifier;
};
// alias
IdentifierIssuer.prototype.getName = IdentifierIssuer.prototype.getName;

/**
 * Returns true if the given old identifer has already been assigned a new
 * identifier.
 *
 * @param old the old identifier to check.
 *
 * @return true if the old identifier has been assigned a new identifier, false
 *   if not.
 */
IdentifierIssuer.prototype.hasId = function(old) {
  return (old in this.existing);
};
// alias
IdentifierIssuer.prototype.isNamed = IdentifierIssuer.prototype.hasId;
