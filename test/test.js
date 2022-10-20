/**
 * Test and benchmark runner for rdf-canonize.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2016-2022 Digital Bazaar, Inc. All rights reserved.
 */
/* eslint-disable indent */
const EarlReport = require('./EarlReport.js');
const NQuads = require('../lib/NQuads');
const join = require('join-path-js');
const canonize = require('..');
const {klona} = require('klona');

// try to load native bindings
let rdfCanonizeNative;
// try regular load
try {
  rdfCanonizeNative = require('rdf-canonize-native');
} catch(e) {
  // try peer package
  try {
    rdfCanonizeNative = require('../../rdf-canonize-native');
  } catch(e) {
  }
}
// use native bindings
if(rdfCanonizeNative) {
  canonize._rdfCanonizeNative(rdfCanonizeNative);
} else {
  // skip native tests
  console.warn('rdf-canonize-native not found');
}

module.exports = function(options) {

'use strict';

const assert = options.assert;
const benchmark = options.benchmark;

const manifest = options.manifest || {
  '@context': {
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    mf: 'http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#',
    id: '@id',
    type: '@type',
    comment: 'rdfs:comment',
    include: {'@id': 'mf:include', '@type': '@id', '@container': '@list'},
    label: 'rdfs:label'
    // FIXME: add missing terms and/or move to tests context file
  },
  id: '',
  type: 'mf:Manifest',
  description: 'Top level rdf-canonize manifest',
  name: 'rdf-canonize',
  sequence: options.entries || [],
  filename: '/'
};

const TEST_TYPES = {
  'rdfc:Urdna2015EvalTest': {
    params: [
      parseNQuads(readTestNQuads('action')),
      createTestOptions({
        algorithm: 'URDNA2015',
        inputFormat: 'application/n-quads',
        format: 'application/n-quads'
      })
    ],
    compare: compareExpectedNQuads
  }
};

const SKIP_TESTS = [];

// create earl report
if(options.earl && options.earl.filename) {
  options.earl.report = new EarlReport({
    env: options.testEnv
  });
  if(options.benchmarkOptions) {
    options.earl.report.setupForBenchmarks({testEnv: options.testEnv});
  }
}

return new Promise(resolve => {

// async generated tests
// _tests => [{suite}, ...]
// suite => {
//   title: ...,
//   tests: [test, ...],
//   suites: [suite, ...]
// }
const _tests = [];

return addManifest(manifest, _tests)
  .then(() => {
    return _testsToMocha(_tests);
  }).then(result => {
    if(options.earl.report) {
      describe('Writing EARL report to: ' + options.earl.filename, function() {
        // print out EARL even if .only was used
        const _it = result.hadOnly ? it.only : it;
        _it('should print the earl report', function() {
          return options.writeFile(
            options.earl.filename, options.earl.report.reportJson());
        });
      });
    }
  }).then(() => resolve());

// build mocha tests from local test structure
function _testsToMocha(tests) {
  let hadOnly = false;
  tests.forEach(suite => {
    if(suite.skip) {
      describe.skip(suite.title);
      return;
    }
    describe(suite.title, () => {
      suite.tests.forEach(test => {
        if(test.only) {
          hadOnly = true;
          it.only(test.title, test.f);
          return;
        }
        it(test.title, test.f);
      });
      const {hadOnly: _hadOnly} = _testsToMocha(suite.suites);
      hadOnly = hadOnly || _hadOnly;
    });
    suite.imports.forEach(f => {
      options.import(f);
    });
  });
  return {
    hadOnly
  };
}

});

/**
 * Adds the tests for all entries in the given manifest.
 *
 * @param manifest {Object} the manifest.
 * @param parent {Object} the parent test structure
 * @return {Promise}
 */
function addManifest(manifest, parent) {
  return new Promise((resolve, reject) => {
    // create test structure
    const suite = {
      title: manifest.name || manifest.label,
      tests: [],
      suites: [],
      imports: []
    };
    parent.push(suite);

    // get entries and sequence (alias for entries)
    const entries = [].concat(
      getJsonLdValues(manifest, 'entries'),
      getJsonLdValues(manifest, 'sequence')
    );

    const includes = getJsonLdValues(manifest, 'include');
    // add includes to sequence as jsonld files
    for(let i = 0; i < includes.length; ++i) {
      entries.push(includes[i] + '.jsonld');
    }

    // resolve all entry promises and process
    Promise.all(entries).then(entries => {
      let p = Promise.resolve();
      entries.forEach(entry => {
        if(typeof entry === 'string' && entry.endsWith('js')) {
          // process later as a plain JavaScript file
          suite.imports.push(entry);
          return;
        } else if(typeof entry === 'function') {
          // process as a function that returns a promise
          p = p.then(() => {
            return entry(options);
          }).then(childSuite => {
            if(suite) {
              suite.suites.push(childSuite);
            }
          });
          return;
        }
        p = p.then(() => {
          return readManifestEntry(manifest, entry);
        }).then(entry => {
          if(isJsonLdType(entry, '__SKIP__')) {
            // special local skip logic
            suite.tests.push(entry);
          } else if(isJsonLdType(entry, 'mf:Manifest')) {
            // entry is another manifest
            return addManifest(entry, suite.suites);
          } else {
            // assume entry is a test
            return addTest(manifest, entry, suite.tests);
          }
        });
      });
      return p;
    }).then(() => {
      resolve();
    }).catch(err => {
      console.error(err);
      reject(err);
    });
  });
}

/**
 * Adds a test.
 *
 * @param manifest {Object} the manifest.
 * @param test {Object} the test.
 * @param tests {Array} the list of tests to add to.
 * @return {Promise}
 */
async function addTest(manifest, test, tests) {
  // expand @id and input base
  const test_id = test['@id'] || test.id;
  test['@id'] =
    (manifest.baseIri || '') +
    basename(manifest.filename).replace('.jsonld', '') +
    test_id;
  test.base = manifest.baseIri + test.input;
  test.manifest = manifest;
  const description = test_id + ' ' + (test.purpose || test.name);

  // build test options for omit checks
  const testInfo = TEST_TYPES[getJsonLdTestType(test)];
  const params = testInfo.params.map(param => param(test));
  const testOptions = params[1];

  // number of parallel operations for benchmarks
  const N = 10;

  // async js
  const _aj_test = {
    title: description + ' (asynchronous js)',
    f: makeFn({
      test,
      run: ({/*test, testInfo,*/ params}) => {
        return canonize.canonize(...params);
      }
    })
  };
  // 'only' based on test manifest
  // 'skip' handled via skip()
  if('only' in test) {
    _aj_test.only = test.only;
  }
  tests.push(_aj_test);

  if(options.benchmarkOptions) {
    // async js x N
    const _ajN_test = {
      title: description + ` (asynchronous js x ${N})`,
      f: makeFn({
        test,
        run: ({/*test, testInfo,*/ params}) => {
          const all = [];
          for(let i = 0; i < N; i++) {
            all.push(canonize.canonize(...params));
          }
          return Promise.all(all);
        },
        ignoreResult: true
      })
    };
    // 'only' based on test manifest
    // 'skip' handled via skip()
    if('only' in test) {
      _ajN_test.only = test.only;
    }
    tests.push(_ajN_test);
  }

  // async native
  if(rdfCanonizeNative && testOptions.algorithm === 'URDNA2015') {
    const _an_test = {
      title: description + ' (asynchronous native)',
      f: makeFn({
        test,
        adjustParams: ({params}) => {
          params[1].useNative = true;
        },
        run: ({/*test, testInfo,*/ params}) => {
          return rdfCanonizeNative.canonize(...params);
        }
      })
    };
    // 'only' based on test manifest
    // 'skip' handled via skip()
    if('only' in test) {
      _an_test.only = test.only;
    }
    tests.push(_an_test);
  }

  // TODO: add benchmark async native x N

  // sync js
  const _sj_test = {
    title: description + ' (synchronous js)',
    f: makeFn({
      test,
      run: async ({/*test, testInfo,*/ params}) => {
        return canonize._canonizeSync(...params);
      }
    })
  };
  // 'only' based on test manifest
  // 'skip' handled via skip()
  if('only' in test) {
    _sj_test.only = test.only;
  }
  tests.push(_sj_test);

  if(options.benchmarkOptions) {
    // sync js x N
    const _sjN_test = {
      title: description + ` (synchronous js x ${N})`,
      f: makeFn({
        test,
        run: ({/*test, testInfo,*/ params}) => {
          const all = [];
          for(let i = 0; i < N; i++) {
            all.push(canonize._canonizeSync(...params));
          }
          return Promise.all(all);
        },
        ignoreResult: true
      })
    };
    // 'only' based on test manifest
    // 'skip' handled via skip()
    if('only' in test) {
      _sjN_test.only = test.only;
    }
    tests.push(_sjN_test);
  }

  // sync native
  if(rdfCanonizeNative && testOptions.algorithm === 'URDNA2015') {
    const _sn_test = {
      title: description + ' (synchronous native)',
      f: makeFn({
        test,
        adjustParams: ({params}) => {
          params[1].useNative = true;
        },
        run: async ({/*test, testInfo,*/ params}) => {
          return rdfCanonizeNative.canonizeSync(...params);
        }
      })
    };
    // 'only' based on test manifest
    // 'skip' handled via skip()
    if('only' in test) {
      _sn_test.only = test.only;
    }
    tests.push(_sn_test);
  }

  // TODO: add benchmark sync native x N
}

function makeFn({
  test,
  adjustParams = p => p,
  run,
  ignoreResult = false
}) {
  return async function() {
    const self = this;
    self.timeout(5000);
    const testInfo = TEST_TYPES[getJsonLdTestType(test)];

    // skip based on test manifest
    if('skip' in test && test.skip) {
      if(options.verboseSkip) {
        console.log('Skipping test due to manifest:',
          {id: test['@id'], name: test.name});
      }
      self.skip();
    }

    // skip based on unknown test type
    const testTypes = Object.keys(TEST_TYPES);
    if(!isJsonLdType(test, testTypes)) {
      if(options.verboseSkip) {
        const type = [].concat(
          getJsonLdValues(test, '@type'),
          getJsonLdValues(test, 'type')
        );
        console.log('Skipping test due to unknown type:',
          {id: test['@id'], name: test.name, type});
      }
      self.skip();
    }

    // skip based on test type
    if(isJsonLdType(test, SKIP_TESTS)) {
      if(options.verboseSkip) {
        const type = [].concat(
          getJsonLdValues(test, '@type'),
          getJsonLdValues(test, 'type')
        );
        console.log('Skipping test due to test type:',
          {id: test['@id'], name: test.name, type});
      }
      self.skip();
    }

    // skip based on type info
    if(testInfo.skip && testInfo.skip.type) {
      if(options.verboseSkip) {
        console.log('Skipping test due to type info:',
          {id: test['@id'], name: test.name});
      }
      self.skip();
    }

    // skip based on id regex
    if(testInfo.skip && testInfo.skip.idRegex) {
      testInfo.skip.idRegex.forEach(function(re) {
        if(re.test(test['@id'])) {
          if(options.verboseSkip) {
            console.log('Skipping test due to id:',
              {id: test['@id']});
          }
          self.skip();
        }
      });
    }

    // skip based on description regex
    // fuzzy use of test.title which is created from description
    if(testInfo.skip && testInfo.skip.descriptionRegex) {
      testInfo.skip.descriptionRegex.forEach(function(re) {
        if(re.test(test.description)) {
          if(options.verboseSkip) {
            console.log('Skipping test due to description:', {
              id: test['@id'],
              name: test.name,
              description: test.description
            });
          }
          self.skip();
        }
      });
    }

    const params = adjustParams(testInfo.params.map(param => param(test)));
    // resolve test data
    const values = await Promise.all(params);
    // copy used to check inputs do not change
    const valuesOrig = klona(values);
    let err;
    let result;
    // run and capture errors and results
    try {
      result = await run({test, testInfo, params: values});
      // check input not changed
      assert.deepStrictEqual(valuesOrig, values);
    } catch(e) {
      err = e;
    }

    try {
      if(isJsonLdType(test, 'XXX:NegativeEvaluationTest')) {
        if(!ignoreResult) {
          // FIXME add if needed
          //await compareExpectedError(test, err);
        }
      } else if(isJsonLdType(test, 'XXX:PositiveEvaluationTest') ||
        isJsonLdType(test, 'rdfc:Urgna2012EvalTest') ||
        isJsonLdType(test, 'rdfc:Urdna2015EvalTest')) {
        if(err) {
          throw err;
        }
        if(!ignoreResult) {
          await testInfo.compare(test, result);
        }
      } else if(isJsonLdType(test, 'XXX:PositiveSyntaxTest')) {
        // no checks
      } else {
        throw Error('Unknown test type: ' + test.type);
      }

      let benchmarkResult = null;
      if(options.benchmarkOptions) {
        const result = await runBenchmark({
          test,
          testInfo,
          run,
          params: testInfo.params.map(param => param(test, {
            // pre-load params to avoid doc loader and parser timing
            load: true
          })),
          mochaTest: self
        });
        benchmarkResult = {
          // FIXME use generic prefix
          '@type': 'jldb:BenchmarkResult',
          'jldb:hz': result.target.hz,
          'jldb:rme': result.target.stats.rme
        };
      }

      if(options.earl.report) {
        options.earl.report.addAssertion(test, true, {
          benchmarkResult
        });
      }
    } catch(err) {
      // FIXME: improve handling of non-normative errors
      // FIXME: for now, explicitly disabling tests.
      //if(!normativeTest) {
      //  // failure ok
      //  if(options.verboseSkip) {
      //    console.log('Skipping non-normative test due to failure:',
      //      {id: test['@id'], name: test.name});
      //  }
      //  self.skip();
      //}
      if(options.bailOnError) {
        if(err.name !== 'AssertionError') {
          console.error('\nError: ', JSON.stringify(err, null, 2));
        }
        options.exit();
      }
      if(options.earl.report) {
        options.earl.report.addAssertion(test, false);
      }
      console.error('Error: ', JSON.stringify(err, null, 2));
      throw err;
    }
  };
}

async function runBenchmark({test, testInfo, params, run, mochaTest}) {
  const values = await Promise.all(params);

  return new Promise((resolve, reject) => {
    const suite = new benchmark.Suite();
    suite.add({
      name: test.name,
      defer: true,
      fn: deferred => {
        run({test, testInfo, params: values}).then(() => {
          deferred.resolve();
        });
      }
    });
    suite
      .on('start', e => {
        // set timeout to a bit more than max benchmark time
        mochaTest.timeout((e.target.maxTime + 10) * 1000);
      })
      .on('cycle', e => {
        console.log(String(e.target));
      })
      .on('error', err => {
        reject(new Error(err));
      })
      .on('complete', e => {
        resolve(e);
      })
      .run({async: true});
  });
}

function getJsonLdTestType(test) {
  const types = Object.keys(TEST_TYPES);
  for(let i = 0; i < types.length; ++i) {
    if(isJsonLdType(test, types[i])) {
      return types[i];
    }
  }
  return null;
}

function readManifestEntry(manifest, entry) {
  let p = Promise.resolve();
  let _entry = entry;
  if(typeof entry === 'string') {
    let _filename;
    p = p.then(() => {
      if(entry.endsWith('json') || entry.endsWith('jsonld')) {
        // load as file
        return entry;
      }
      // load as dir with manifest.jsonld
      return joinPath(entry, 'manifest.jsonld');
    }).then(entry => {
      const dir = dirname(manifest.filename);
      return joinPath(dir, entry);
    }).then(filename => {
      _filename = filename;
      return readJson(filename);
    }).then(entry => {
      _entry = entry;
      _entry.filename = _filename;
      return _entry;
    }).catch(err => {
      if(err.code === 'ENOENT') {
        //console.log('File does not exist, skipping: ' + _filename);
        // return a "skip" entry
        _entry = {
          type: '__SKIP__',
          title: 'Not found, skipping: ' + _filename,
          filename: _filename,
          skip: true
        };
        return;
      }
      throw err;
    });
  }
  return p.then(() => {
    _entry.dirname = dirname(_entry.filename || manifest.filename);
    return _entry;
  });
}

function readTestNQuads(property) {
  return async function(test) {
    if(!test[property]) {
      return null;
    }
    const filename = await joinPath(test.dirname, test[property]);
    return readFile(filename);
  };
}

function parseNQuads(fn) {
  return async test => NQuads.parse(await fn(test));
}

function createTestOptions(opts) {
  return function(test) {
    const testOptions = test.option || {};
    const options = Object.assign({}, testOptions);
    if(opts) {
      // extend options
      Object.assign(options, opts);
    }
    return options;
  };
}

// find the expected output property or throw error
function _getExpectProperty(test) {
  if('expectErrorCode' in test) {
    return 'expectErrorCode';
  } else if('expect' in test) {
    return 'expect';
  } else if('result' in test) {
    return 'result';
  } else {
    throw Error('No expected output property found');
  }
}

async function compareExpectedNQuads(test, result) {
  let expect;
  try {
    expect = await readTestNQuads(_getExpectProperty(test))(test);
    assert.strictEqual(result, expect);
  } catch(ex) {
    if(options.bailOnError) {
      console.log('\nTEST FAILED\n');
      console.log('EXPECTED:\n' + expect);
      console.log('ACTUAL:\n' + result);
    }
    throw ex;
  }
}

function isJsonLdType(node, type) {
  const nodeType = [].concat(
    getJsonLdValues(node, '@type'),
    getJsonLdValues(node, 'type')
  );
  type = Array.isArray(type) ? type : [type];
  for(let i = 0; i < type.length; ++i) {
    if(nodeType.indexOf(type[i]) !== -1) {
      return true;
    }
  }
  return false;
}

function getJsonLdValues(node, property) {
  let rval = [];
  if(property in node) {
    rval = [].concat(node[property]);
  }
  return rval;
}

async function readJson(filename) {
  const data = await readFile(filename);
  return JSON.parse(data);
}

async function readFile(filename) {
  return options.readFile(filename);
}

async function joinPath() {
  return join.apply(null, Array.prototype.slice.call(arguments));
}

function dirname(filename) {
  if(options.nodejs) {
    return options.nodejs.path.dirname(filename);
  }
  const idx = filename.lastIndexOf('/');
  if(idx === -1) {
    return filename;
  }
  return filename.substr(0, idx);
}

function basename(filename) {
  if(options.nodejs) {
    return options.nodejs.path.basename(filename);
  }
  const idx = filename.lastIndexOf('/');
  if(idx === -1) {
    return filename;
  }
  return filename.substr(idx + 1);
}

};
