/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const crypto = require('crypto');

module.exports = class MessageDigest {
  /**
   * Creates a new MessageDigest.
   *
   * @param {string} algorithm - The algorithm to use.
   */
  constructor(algorithm) {
    this.md = crypto.createHash(algorithm);
  }

  update(msg) {
    this.md.update(msg, 'utf8');
  }

  // async code awaits this but it is not async to support
  // the sync code
  digest() {
    return this.md.digest('hex');
  }
};
