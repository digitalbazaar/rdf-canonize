/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const crypto = require('crypto');

class MessageHash {
  /**
   * Creates a new MessageDigest.
   *
   * @param algorithm the algorithm to use.
   */
  constructor(algorithm) {
    this.md = crypto.createHash(algorithm);
  }

  update(msg) {
    this.md.update(msg, 'utf8');
  }

  digest() {
    return this.md.digest('hex');
  }
}

class MessageHmac {
  /**
   * Create a new MessageHmac
   *
   * @param algorithm the hash algorithm used by HMAC
   * @param key the HMAC secret key
   */
  constructor(algorithm, key) {
    this.hmac = crypto.createHmac(algorithm, key);
  }

  update(msg) {
    this.hmac.update(msg, 'utf8');
  }

  digest() {
    return this.hmac.digest('hex');
  }
}

/**
 * Returns a Message digest object, based on the supplied options
 *
 * @param {*} options the options to use:
 *                       - hashAlgorithm: the underlying hash algorithm to use.
 *                       - useHmac: use Hmac as a digest (default: false)
 *                       - hmacKey: a secret hmac key.
 *
 * @returns either a MessageHash or a MessageHmac object
 */
module.exports.getMessageDigest = function(options) {
  if(!(options.hashAlgorithm)) {
    throw new Error('No hash algorithm has been specified');
  }

  if(options.useHmac) {
    if(!(options.hmacKey)) {
      throw new Error('Hmac needs a secret key');
    }
    return new MessageHmac(options.hashAlgorithm, options.hmacKey);
  }

  return new MessageHash(options.hashAlgorithm);
};
