/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

require('setimmediate');

exports.setImmediate = setImmediate;

// WebCrypto
exports.crypto = globalThis.crypto;
