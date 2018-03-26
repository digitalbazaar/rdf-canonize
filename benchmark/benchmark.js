/**
 * Benchmark runner for rdf-canonize.
 *
 * @author Dave Longley
 * @author David I. Lehn
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
(function() {

'use strict';

// detect node.js (vs. phantomJS)
const _nodejs = (typeof process !== 'undefined' &&
  process.versions && process.versions.node);

const Benchmark = require('benchmark');
const assert = require('assert');
const fs = require('fs');
let path;

if(_nodejs) {
  path = require('path');
}

const canonize = require('..');
const NQuads = require('../lib/NQuads');

const _TEST_SUITE_PATHS = [
  process.env.TEST_DIR,
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
    ]
  },
  'rdfn:Urdna2015EvalTest': {
    params: [
      parseNQuads(readTestNQuads('action')),
      createTestOptions({
        algorithm: 'URDNA2015',
        inputFormat: 'application/n-quads',
        format: 'application/n-quads'
      })
    ]
  },
  'rdfn:Urdna2018EvalTest': {
    params: [
      parseNQuads(readTestNQuads('action')),
      createTestOptions({
        algorithm: 'URDNA2018',
        inputFormat: 'application/n-quads',
        format: 'application/n-quads'
      })
    ]
  },
};

const SKIP_TESTS = [];

// run tests
const suite = new Benchmark.Suite;
const namepath = [];
const filename = joinPath(ROOT_MANIFEST_DIR, 'manifest.jsonld');
const rootManifest = readJson(filename);
rootManifest.filename = filename;
addManifest(rootManifest);

suite
  .on('start', () => {
    console.log('Benchmarking...');
  })
  .on('cycle', event => {
    console.log(String(event.target));
    const s = event.target.stats;
    /*
    console.log(`  min:${Math.min(...s.sample)} max:${Math.max(...s.sample)}`);
    console.log(`  deviation:${s.deviation} mean:${s.mean}`);
    console.log(`  moe:${s.moe} rme:${s.rme}% sem:${s.sem} var:${s.variance}`);
    */
  })
  .on('complete', () => {
    console.log('Done.');
  })
  .run({async: true});

/**
 * Adds the tests for all entries in the given manifest.
 *
 * @param manifest the manifest.
 */
function addManifest(manifest) {
  namepath.push(manifest.name || manifest.label);
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
      if(entry.name.startsWith('evil (1)') || entry.name.startsWith('block')) {
        addTest(manifest, entry);
      }
    }
  }
  namepath.pop();
}

// i null for random, i number for incremental hashes mode
function _bench({description, params, minSamples}) {
  let options = {
    name: description,
    defer: true,
    fn: function(deferred) {
      const promise = canonize.canonize.apply(null, params);
      promise
        .catch(err => assert.ifError(err))
        .then(() => deferred.resolve());
    }
  };
  if(minSamples) {
    options.minSamples = minSamples;
  }
  return options;
}

function addTest(manifest, test) {
  // skip unknown and explicitly skipped test types
  const testTypes = Object.keys(TEST_TYPES);
  const skip = 'skip' in test && test.skip === true;
  if(skip || !isJsonLdType(test, testTypes) || isJsonLdType(test, SKIP_TESTS)) {
    const type = [].concat(
      getJsonLdValues(test, '@type'),
      getJsonLdValues(test, 'type')
    );
    console.log('Skipping test "' + test.name + '" of type: ' + type);
    return;
  }

  // if ONLY env var set then only run if only is true
  if(process.env.ONLY && !('only' in test && test.only === true)) {
    return;
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
  jsParams[1].usePureJavaScript = true;

  // custom params for native only async mode (if available)
  const nativeParams = testInfo.params.map(param => param(test));
  nativeParams[1].usePureJavaScript = false;

  // NOTE: the below omit error handling. run manifest with test suite first

  // number of parallel operations
  const N = 10;

  // run async js benchmark
  /*suite.add({
    name: namepath.concat([description, '(asynchronous js)']).join(' / '),
    defer: true,
    fn: function(deferred) {
      canonize.canonize(...jsParams).then(() => deferred.resolve());
    }
  });
  // run async js benchmark x N
  suite.add({
    name: namepath.concat(
      [description, `(asynchronous js x ${N})`]).join(' / '),
    defer: true,
    fn: function(deferred) {
      const all = [];
      for(let i = 0; i < N; ++i) {
        all.push(canonize.canonize(...jsParams));
      }
      Promise.all(all).then(() => deferred.resolve());
    }
  });*/
  /*
  // run async js benchmark (callback)
  suite.add({
    name: namepath.concat([description, '(asynchronous js / cb)']).join(' / '),
    defer: true,
    fn: function(deferred) {
      canonize.canonize(...jsParams, (err, output) => deferred.resolve());
    }
  });
  */
  // run async native benchmark
  /*suite.add({
    name: namepath.concat([description, '(asynchronous native)']).join(' / '),
    defer: true,
    fn: function(deferred) {
      canonize.canonize(...nativeParams).then(() => deferred.resolve());
    }
  });
  // run async native benchmark x N
  suite.add({
    name: namepath.concat(
      [description, `(asynchronous native x ${N})`]).join(' / '),
    defer: true,
    fn: function(deferred) {
      const all = [];
      for(let i = 0; i < N; ++i) {
        all.push(canonize.canonize(...nativeParams));
      }
      Promise.all(all).then(() => deferred.resolve());
    }
  });*/

  // run sync js benchmark
  suite.add({
    name: namepath.concat([description, '(synchronous js)']).join(' / '),
    defer: true,
    fn: function(deferred) {
      canonize.canonizeSync(...jsParams);
      deferred.resolve();
    }
  });
  // run sync js benchmark x N
  /*suite.add({
    name: namepath.concat(
      [description, `(synchronous js x ${N})`]).join(' / '),
    defer: true,
    fn: function(deferred) {
      const all = [];
      for(let i = 0; i < N; ++i) {
        all.push(canonize.canonizeSync(...jsParams));
      }
      Promise.all(all).then(() => deferred.resolve());
    }
  });*/
  /*
  // run sync native benchmark
  suite.add({
    name: namepath.concat([description, '(synchronous native)']).join(' / '),
    defer: true,
    fn: function(deferred) {
      canonize.canonizeSync(...nativeParams);
      deferred.resolve();
    }
  });
  // run sync native benchmark x N
  suite.add({
    name: namepath.concat(
      [description, `(synchronous native x ${N})`]).join(' / '),
    defer: true,
    fn: function(deferred) {
      const all = [];
      for(let i = 0; i < N; ++i) {
        all.push(canonize.canonizeSync(...nativeParams));
      }
      Promise.all(all).then(() => deferred.resolve());
    }
  });*/

  /*
  // run sync js benchmark (try/catch)
  suite.add({
    name: namepath.concat([description, '(synchronous js / try/catch)']).join(' / '),
    defer: true,
    fn: function(deferred) {
      try {
        canonize.canonizeSync(...jsParams);
      } catch(e) {}
      deferred.resolve();
    }
  });
  // run sync js benchmark (non-deferred)
  suite.add({
    name: namepath.concat([description, '(synchronous js nd)']).join(' / '),
    fn: function() {
      canonize.canonizeSync(...jsParams);
    }
  });
  // run sync js benchmark (non-deferred try/catch)
  suite.add({
    name: namepath.concat([description, '(synchronous js nd/tc)']).join(' / '),
    fn: function() {
      try {
        canonize.canonizeSync(...jsParams);
      } catch(e) {}
    }
  });
  */
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

})()
