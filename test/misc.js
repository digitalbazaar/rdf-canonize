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

  it('should set canonicalIdMap data', async () => {
    const input = `\
_:b0 <urn:p0> _:b1 .
_:b1 <urn:p1> "v1" .
`;
    const expected = `\
_:c14n0 <urn:p0> _:c14n1 .
_:c14n1 <urn:p1> "v1" .
`;
    const expectIdMap = new Map(Object.entries({
      "_:b0": "_:c14n0",
      "_:b1": "_:c14n1"
    }));

    const canonicalIdMap = new Map();
    const output = await rdfCanonize.canonize(input, {
      algorithm: 'URDNA2015',
      inputFormat: 'application/n-quads',
      format: 'application/n-quads',
      canonicalIdMap
    });
    assert.deepStrictEqual(output, expected);
    assert.deepStrictEqual(canonicalIdMap, expectIdMap);
  });
});
