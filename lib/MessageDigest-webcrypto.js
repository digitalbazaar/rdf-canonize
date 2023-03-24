/*!
 * Copyright (c) 2016-2023 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {crypto} = require('./platform');

module.exports = class MessageDigest {
  /**
   * Creates a new WebCrypto API MessageDigest.
   *
   * @param algorithm the algorithm to use.
   */
  constructor(algorithm) {
    // check if crypto.subtle is available
    // check is here rather than top-level to only fail if class is used
    if(!(crypto && crypto.subtle)) {
      throw new Error('crypto.subtle not found.');
    }
    if(algorithm === 'sha256') {
      this.algorithm = {name: 'SHA-256'};
    } else {
      throw new Error(`Unsupported algorithm "${algorithm}".`);
    }
    this._content = '';
  }

  update(msg) {
    this._content += msg;
  }

  async digest() {
    const data = new TextEncoder().encode(this._content);
    const buffer = new Uint8Array(
      await crypto.subtle.digest(this.algorithm, data));
    // return digest in hex
    let hex = '';
    for(let i = 0; i < buffer.length; ++i) {
      hex += buffer[i].toString(16).padStart(2, '0');
    }
    return hex;
  }
};