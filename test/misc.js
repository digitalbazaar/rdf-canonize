/**
 * Misc tests.
 */
// disable so tests can be copy & pasted
/* eslint-disable quotes, quote-props */
const rdfCanonize = require('..');
const assert = require('assert');

const {NQuads} = rdfCanonize;

describe('API tests', () => {
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
      '_:b0': '_:c14n0',
      '_:b1': '_:c14n1'
    }));

    const canonicalIdMap = new Map();
    const dataset = NQuads.parse(input);
    const output = await rdfCanonize.canonize(dataset, {
      algorithm: 'URDNA2015',
      format: 'application/n-quads',
      canonicalIdMap
    });
    assert.deepStrictEqual(output, expected);
    assert.deepStrictEqual(canonicalIdMap, expectIdMap);
  });
});