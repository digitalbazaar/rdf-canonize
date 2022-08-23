/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const crypto = require('crypto');

module.exports.Hash = class MessageDigest {
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
};

module.exports.Hmac = class MessageHmac {
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
};
