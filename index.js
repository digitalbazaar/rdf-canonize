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
var URGNA2012 = require('./lib/urgna2015');

'use strict';

var api = {};
module.exports = api;

/**
 * Asynchronously performs RDF dataset normalization on the given input. The
 * input is JSON-LD unless the 'inputFormat' options is used. The output is an
 * RDF dataset unless the 'format' option is used.
 *
 * @param input the input to normalize as JSON-LD or as a format specified by
 *          the 'inputFormat' option.
 * @param [options] the options to use:
 *          [algorithm] the normalization algorithm to use, `URDNA2015` or
 *            `URGNA2012` (default: `URGNA2012`).
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [inputFormat] the format if input is not JSON-LD:
 *            'application/nquads' for N-Quads.
 *          [format] the format if output is a string:
 *            'application/nquads' for N-Quads.
 *          [documentLoader(url, callback(err, remoteDoc))] the document loader.
 * @param callback(err, normalized) called once the operation completes.
 */
api.normalize = function(input, options, callback) {
  // TODO: transform input to dataset
  var dataset = {};

  if(options.algorithm === 'URDNA2015') {
    return new URDNA2015(options).main(dataset, callback);
  }
  if(options.algorithm === 'URGNA2012') {
    return new URGNA2012(options).main(dataset, callback);
  }
  callback(new Error(
    'Invalid RDF Dataset Normalization algorithm: ' + options.algorithm));
};

/**
 * Asynchronously performs RDF dataset normalization on the given input. The
 * input is JSON-LD unless the 'inputFormat' options is used. The output is an
 * RDF dataset unless the 'format' option is used.
 *
 * @param input the input to normalize as JSON-LD or as a format specified by
 *          the 'inputFormat' option.
 * @param [options] the options to use:
 *          [algorithm] the normalization algorithm to use, `URDNA2015` or
 *            `URGNA2012` (default: `URGNA2012`).
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [inputFormat] the format if input is not JSON-LD:
 *            'application/nquads' for N-Quads.
 *          [format] the format if output is a string:
 *            'application/nquads' for N-Quads.
 *          [documentLoader(url, callback(err, remoteDoc))] the document loader.
 *
 * @return the normalized RDF dataset in the format specified via the options.
 */
api.normalizeSync = function(input, options) {
  // TODO: implement
};
