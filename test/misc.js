/**
 * Misc tests.
 */
// disable so tests can be copy & pasted
/* eslint-disable quotes, quote-props */
const assert = require('assert');
const graphs = require('./graphs.js');
const rdfCanonize = require('..');

describe('API tests', () => {
  it('should reject invalid inputFormat', async () => {
    let error;
    try {
      await rdfCanonize.canonize('', {
        algorithm: 'RDFC-1.0',
        inputFormat: 'application/bogus',
        format: 'application/n-quads'
      });
    } catch(e) {
      error = e;
    }
    assert(error);
  });

  it('should reject invalid output format', async () => {
    let error;
    try {
      await rdfCanonize.canonize([], {
        algorithm: 'RDFC-1.0',
        format: 'bogus'
      });
    } catch(e) {
      error = e;
    }
    assert(error);
  });

  it('should handle falsy output format', async () => {
    const input = [];
    const expected = '';
    const output = await rdfCanonize.canonize(input, {
      algorithm: 'RDFC-1.0',
      inputFormat: null,
      format: null
    });
    assert.deepStrictEqual(output, expected);
  });

  it('should fail to parse empty dataset as N-Quads', async () => {
    let error;
    try {
      await rdfCanonize.canonize([], {
        algorithm: 'RDFC-1.0',
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
      'b0': 'c14n0',
      'b1': 'c14n1'
    }));

    const canonicalIdMap = new Map();
    const output = await rdfCanonize.canonize(input, {
      algorithm: 'RDFC-1.0',
      inputFormat: 'application/n-quads',
      format: 'application/n-quads',
      canonicalIdMap
    });
    assert.deepStrictEqual(output, expected);
    assert.deepStrictEqual(canonicalIdMap, expectIdMap);
  });

  it('should allow URDNA2015 by default', async () => {
    await rdfCanonize.canonize([], {
      algorithm: 'URDNA2015',
      format: 'application/n-quads'
    });
  });

  it('should handle rejectURDNA2015 option', async () => {
    let error;
    try {
      await rdfCanonize.canonize([], {
        algorithm: 'URDNA2015',
        format: 'application/n-quads',
        rejectURDNA2015: true
      });
    } catch(e) {
      error = e;
    }
    assert(error);
  });

  it('should abort (timeout)', async () => {
    const {data} = graphs.makeDataC({
      counts: [10, 10, 10]
    });
    let error;
    let output;
    try {
      output = await rdfCanonize.canonize(data, {
        algorithm: 'RDFC-1.0',
        inputFormat: 'application/n-quads',
        format: 'application/n-quads',
        signal: AbortSignal.timeout(100),
        maxDeepIterations: Infinity
      });
    } catch(e) {
      error = e;
    }
    assert(error, 'no abort error');
    assert(!output, 'abort should have no output');
  });

  it('should abort (iterations)', async () => {
    const {data} = graphs.makeDataA({
      subjects: 6,
      objects: 6
    });
    let error;
    let output;
    try {
      output = await rdfCanonize.canonize(data, {
        algorithm: 'RDFC-1.0',
        inputFormat: 'application/n-quads',
        format: 'application/n-quads',
        signal: null,
        maxDeepIterations: 1000
      });
    } catch(e) {
      error = e;
    }
    assert(error, 'no abort error');
    assert(!output, 'abort should have no output');
  });

  /*
  it.only('should abort (playground)', async () => {
    //const {data, n} = graphs.makeDataA({
    //  subjects: 6,
    //  objects: 6
    //});
    //const {data, n} = graphs.makeDataB({
    //  subjects: 6
    //});
    const {data, n} = graphs.makeDataC({
      counts: [10, 10, 10]
    });
    console.log('INPUT', data);
    console.log('INPUTN', n);
    console.log('INPUTSIZE', data.length);
    let error;
    let output;
    const start = performance.now();
    try {
      const p = rdfCanonize.canonize(data, {
        algorithm: 'RDFC-1.0',
        inputFormat: 'application/n-quads',
        format: 'application/n-quads',
        signal: AbortSignal.timeout(100),
        maxDeepIterations: 1000
      });
      output = await p;
      //console.log('OUTPUT', output);
    } catch(e) {
      console.log('ERROR', e);
      error = e;
    }
    const dt = performance.now() - start;
    console.log('DT(ms)', dt);
    assert(error, 'no abort error');
    assert(!output, 'abort should have no output');
  });
  */
});
