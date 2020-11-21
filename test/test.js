/**
 * Test runner for rdf-canonize.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
/* eslint-disable indent */
(function() {

'use strict';

// detect node.js (vs. phantomJS)
const _nodejs = (typeof process !== 'undefined' &&
  process.versions && process.versions.node);

const fs = require('fs');
let program;
let assert;
let path;

if(_nodejs) {
  path = require('path');
  assert = require('assert');
  /*
  program = require('commander');
  program
    .option('--earl [filename]', 'Output an earl report')
    .option('--bail', 'Bail when a test fails')
    .option('--test-dir', 'Test directory')
    .parse(process.argv);
  */
  program = {};
  program.earl = process.env.EARL;
  program.bail = process.env.BAIL === 'true';
  program.testDir = process.env.TEST_DIR;
} else {
  const system = require('system');
  require('./setImmediate');
  window.Promise = require('es6-promise').Promise;
  assert = require('chai').assert;
  require('mocha/mocha');
  require('mocha-phantomjs/lib/mocha-phantomjs/core_extensions');
  program = {};
  for(let i = 0; i < system.args.length; ++i) {
    const arg = system.args[i];
    if(arg.indexOf('--') === 0) {
      const argname = arg.substr(2);
      switch(argname) {
      case 'earl':
        program[argname] = system.args[i + 1];
        ++i;
        break;
      default:
        program[argname] = true;
      }
    }
  }

  mocha.setup({
    reporter: 'spec',
    ui: 'bdd'
  });
}

const canonize = require('..');
const EarlReport = require('./EarlReport');
const NQuads = require('../lib/NQuads');

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

const _TEST_SUITE_PATHS = [
  program['testDir'],
  '../normalization/tests',
  './test-suites/normalization/tests',
];
const TEST_SUITE = _TEST_SUITE_PATHS.find(pathExists);
if(!TEST_SUITE) {
  throw new Error('Test suite not found.');
}
const ROOT_MANIFEST_DIR = resolvePath(TEST_SUITE);
const TEST_TYPES = {
  'rdfn:Urgna2012EvalTest': {
    params: [
      parseNQuads(readTestNQuads('action')),
      createTestOptions({
        algorithm: 'URGNA2012',
        inputFormat: 'application/n-quads',
        format: 'application/n-quads'
      })
    ],
    compare: compareExpectedNQuads
  },
  'rdfn:Urdna2015EvalTest': {
    params: [
      parseNQuads(readTestNQuads('action')),
      createTestOptions({
        algorithm: 'URDNA2015',
        inputFormat: 'application/n-quads',
        format: 'application/n-quads'
      })
    ],
    compare: compareExpectedNQuads
  },
};

const SKIP_TESTS = [];

// create earl report
const earl = new EarlReport(_nodejs ? 'node.js' : 'browser');

// run tests
describe('rdf-canonize', function() {
  const filename = joinPath(ROOT_MANIFEST_DIR, 'manifest.jsonld');
  const rootManifest = readJson(filename);
  rootManifest.filename = filename;
  addManifest(rootManifest);

  if(program.earl) {
    const filename = resolvePath(program.earl);
    describe('Writing EARL report to: ' + filename, function() {
      it('should print the earl report', function(done) {
        earl.write(filename);
        done();
      });
    });
  }
});

if(!_nodejs) {
  mocha.run(() => phantom.exit());
}

/**
 * Adds the tests for all entries in the given manifest.
 *
 * @param manifest the manifest.
 */
function addManifest(manifest) {
  describe(manifest.name || manifest.label, function() {
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

    // process entries
    for(let i = 0; i < entries.length; ++i) {
      const entry = readManifestEntry(manifest, entries[i]);

      if(isJsonLdType(entry, 'mf:Manifest')) {
        // entry is another manifest
        addManifest(entry);
      } else {
        // assume entry is a test
        addTest(manifest, entry);
      }
    }
  });
}

function addTest(manifest, test) {
  // skip unknown and explicitly skipped test types
  const testTypes = Object.keys(TEST_TYPES);
  if(!isJsonLdType(test, testTypes) || isJsonLdType(test, SKIP_TESTS)) {
    const type = [].concat(
      getJsonLdValues(test, '@type'),
      getJsonLdValues(test, 'type')
    );
    console.log('Skipping test "' + test.name + '" of type: ' + type);
  }

  // expand @id and input base
  const test_id = test['@id'] || test['id'];
  test['@id'] = manifest.baseIri + basename(manifest.filename) + test_id;
  test.base = manifest.baseIri + test.input;
  test.manifest = manifest;
  const description = test_id + ' ' + (test.purpose || test.name);

  const testInfo = TEST_TYPES[getTestType(test)];
  const params = testInfo.params.map(param => param(test));
  // custom params for js only async mode
  const jsParams = testInfo.params.map(param => param(test));
  // custom params for native only async mode
  const nativeParams = testInfo.params.map(param => param(test));
  nativeParams[1].useNative = true;
  const createCallback = done => (err, result) => {
    try {
      if(err) {
        throw err;
      }
      testInfo.compare(test, result);
      earl.addAssertion(test, true);
      return done();
    } catch(ex) {
      if(program.bail) {
        if(ex.name !== 'AssertionError') {
          console.log('\nError: ', JSON.stringify(ex, null, 2));
        }
        if(_nodejs) {
          process.exit();
        } else {
          phantom.exit();
        }
      }
      earl.addAssertion(test, false);
      return done(ex);
    }
  };

  // run async js test
  it.skip(description + ' (asynchronous js)', function(done) {
    this.timeout(5000);
    const callback = createCallback(done);
    const promise = canonize.canonize.apply(null, clone(jsParams));
    promise.then(callback.bind(null, null), callback);
  });

  if(rdfCanonizeNative && params[1].algorithm === 'URDNA2015') {
    // run async native test
    it(description + ' (asynchronous native)', function(done) {
      this.timeout(5000);
      const callback = createCallback(done);
      const promise = canonize.canonize.apply(null, clone(nativeParams));
      promise.then(callback.bind(null, null), callback);
    });
  }

  // run sync test
  it(description + ' (synchronous js)', function(done) {
    this.timeout(5000);
    const callback = createCallback(done);
    let result;
    try {
      result = canonize.canonizeSync.apply(null, clone(jsParams));
    } catch(e) {
      return callback(e);
    }
    callback(null, result);
  });

  if(rdfCanonizeNative && params[1].algorithm === 'URDNA2015') {
    // run sync test
    it(description + ' (synchronous native)', function(done) {
      this.timeout(5000);
      const callback = createCallback(done);
      let result;
      try {
        result = canonize.canonizeSync.apply(null, clone(nativeParams));
      } catch(e) {
        return callback(e);
      }
      callback(null, result);
    });
  }
}

function getTestType(test) {
  const types = Object.keys(TEST_TYPES);
  for(let i = 0; i < types.length; ++i) {
    if(isJsonLdType(test, types[i])) {
      return types[i];
    }
  }
  return null;
}

function readManifestEntry(manifest, entry) {
  const dir = dirname(manifest.filename);
  if(typeof entry === 'string') {
    const filename = joinPath(dir, entry);
    entry = readJson(filename);
    entry.filename = filename;
  }
  entry.dirname = dirname(entry.filename || manifest.filename);
  return entry;
}

function readTestNQuads(property) {
  return test => {
    if(!test[property]) {
      return null;
    }
    const filename = joinPath(test.dirname, test[property]);
    return readFile(filename);
  };
}

function parseNQuads(fn) {
  return test => NQuads.parse(fn(test));
}

function createTestOptions(opts) {
  return test => {
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
  if('expect' in test) {
    return 'expect';
  } else if('result' in test) {
    return 'result';
  } else {
    throw Error('No expected output property found');
  }
}

function compareExpectedNQuads(test, result) {
  let expect;
  try {
    expect = readTestNQuads(_getExpectProperty(test))(test);
    assert.equal(result, expect);
  } catch(ex) {
    if(program.bail) {
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

function readJson(filename) {
  return JSON.parse(readFile(filename));
}

function pathExists(filename) {
  if(_nodejs) {
    return fs.existsSync(filename);
  }
  return fs.exists(filename);
}

function readFile(filename) {
  if(_nodejs) {
    return fs.readFileSync(filename, 'utf8');
  }
  return fs.read(filename);
}

function resolvePath(to) {
  if(_nodejs) {
    return path.resolve(to);
  }
  return fs.absolute(to);
}

function joinPath() {
  return (_nodejs ? path : fs).join.apply(
    null, Array.prototype.slice.call(arguments));
}

function dirname(filename) {
  if(_nodejs) {
    return path.dirname(filename);
  }
  const idx = filename.lastIndexOf(fs.separator);
  if(idx === -1) {
    return filename;
  }
  return filename.substr(0, idx);
}

function basename(filename) {
  if(_nodejs) {
    return path.basename(filename);
  }
  const idx = filename.lastIndexOf(fs.separator);
  if(idx === -1) {
    return filename;
  }
  return filename.substr(idx + 1);
}

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

})();
