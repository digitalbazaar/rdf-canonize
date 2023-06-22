/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

exports.setImmediate = setImmediate;

// WebCrypto
const crypto = require('node:crypto');
exports.crypto = crypto.webcrypto;

exports.bufferToHex = function bufferToHex(buffer) {
  return Buffer.from(buffer).toString('hex');
};

const seen = new Set();
exports.warning = function warning(msg) {
  if(!seen.has(msg)) {
    seen.add(msg);
    console.warn(`WARNING[rdf-canonize]: ${msg}.`);
  }
};
