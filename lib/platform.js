/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

exports.setImmediate = setImmediate;

// WebCrypto
const crypto = require('node:crypto');
exports.crypto = crypto.webcrypto;
