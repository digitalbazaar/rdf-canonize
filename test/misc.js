/**
 * Misc tests.
 */
// disable so tests can be copy & pasted
/* eslint-disable quotes, quote-props */
const rdfCanonize = require('..');
const assert = require('assert');

describe.only('API tests', () => {
  it('should reject invalid inputFormat', async () => {
    let error;
    try {
      await rdfCanonize.canonize('', {
        algorithm: 'URDNA2015',
        inputFormat: 'application/bogus',
        format: 'application/n-quads'
      });
    } catch(e) {
      error = e;
    }
    assert(error);
  });

  it('should fail to parse empty dataset as N-Quads', async () => {
    let error;
    try {
      await rdfCanonize.canonize([], {
        algorithm: 'URDNA2015',
        inputFormat: 'application/bogus',
        format: 'application/n-quads'
      });
    } catch(e) {
      error = e;
    }
    assert(error);
  });

  it('should fail to parse empty legacy dataset as N-Quads', async () => {
    let error;
    try {
      await rdfCanonize.canonize({}, {
        algorithm: 'URDNA2015',
        inputFormat: 'application/bogus',
        format: 'application/n-quads'
      });
    } catch(e) {
      error = e;
    }
    assert(error);
  });
});
