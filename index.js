/**
 * An implementation of the RDF Dataset Normalization specification.
 * This library works in the browser and node.js.
 *
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


/*
(function (root, factory) {
  if(typeof define === "function" && define.amd) {
    define(["postal"], factory);
  } else if(typeof module === "object" && module.exports) {
    module.exports = factory(require("postal"));
  } else {
    root.myModule = factory(root.postal);
  }
}(this, function(postal) {
  var sub;
  var ch = postal.channel("myModule");
  var myModule = {
    sayHi:function() {
      ch.publish("hey.yall", { msg: "myModule sez hai" });
    },
    dispose: function() {
      sub.unsubscribe();
    }
  };
  return myModule;
}));
*/

var URDNA2015 = require('./lib/urdna2015');
var URGNA2012 = require('./lib/urgna2012');
var URDNA2015Sync = require('./lib/urdna2015Sync');
var URGNA2012Sync = require('./lib/urgna2012Sync');

'use strict';

var api = {};
module.exports = api;

/**
 * Asynchronously canonizes an RDF dataset.
 *
 * @param dataset the dataset to canonize.
 * @param [options] the options to use:
 *          [algorithm] the canonicalization algorithm to use, `URDNA2015` or
 *            `URGNA2012` (default: `URGNA2012`).
 * @param callback(err, canonical) called once the operation completes.
 */
api.canonize = function(dataset, options, callback) {
  if(options.algorithm === 'URDNA2015') {
    return new URDNA2015(options).main(dataset, callback);
  }
  if(options.algorithm === 'URGNA2012') {
    return new URGNA2012(options).main(dataset, callback);
  }

  /*if(self.options.format === 'application/nquads') {
    result = normalized.join('');
    return callback();
  }

  result = _parseNQuads(normalized.join(''));*/

  callback(new Error(
    'Invalid RDF Dataset Canonicalization algorithm: ' + options.algorithm));
};

/**
 * Synchronously canonizes an RDF dataset.
 *
 * @param dataset the dataset to canonize.
 * @param [options] the options to use:
 *          [algorithm] the canonicalization algorithm to use, `URDNA2015` or
 *            `URGNA2012` (default: `URGNA2012`).
 *
 * @return the RDF dataset in canonical form.
 */
api.canonizeSync = function(dataset, options) {
  if(options.algorithm === 'URDNA2015') {
    return new URDNA2015Sync(options).main(dataset);
  }
  if(options.algorithm === 'URGNA2012') {
    return new URGNA2012Sync(options).main(dataset);
  }
  new Error(
    'Invalid RDF Dataset Canonicalization algorithm: ' + options.algorithm);
};
