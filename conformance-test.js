/**
 * Test runner for rdf-canonize.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
(function() {

'use strict';

// detect node.js (vs. phantomJS)
var _nodejs = (typeof process !== 'undefined' &&
  process.versions && process.versions.node);

var fs = require('fs');
var program;
var assert;

if(_nodejs) {
  var path = require('path');
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
  var system = require('system');
  require('./setImmediate');
  window.Promise = require('es6-promise').Promise;
  assert = require('chai').assert;
  require('mocha/mocha');
  require('mocha-phantomjs/lib/mocha-phantomjs/core_extensions');
  program = {};
  for(var i = 0; i < system.args.length; ++i) {
    var arg = system.args[i];
    if(arg.indexOf('--') === 0) {
      var argname = arg.substr(2);
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

var canonize = require('.');
var NQuads = require('./lib/NQuads');

var _TEST_SUITE_PATHS = [
  program['testDir'],
  '../normalization/tests',
  './test-suites/normalization/tests',
];
var TEST_SUITE = _TEST_SUITE_PATHS.find(pathExists);
if(!TEST_SUITE) {
  throw new Error('Test suite not found.')
}
var ROOT_MANIFEST_DIR = resolvePath(TEST_SUITE);
var TEST_TYPES = {
  'rdfn:Urgna2012EvalTest': {
    fn: canonize.canonize,
    params: [
      parseNQuads(readTestNQuads('action')),
      createTestOptions({
        algorithm: 'URGNA2012',
        inputFormat: 'application/nquads',
        format: 'application/nquads'
      })
    ],
    compare: compareExpectedNQuads
  },
  'rdfn:Urdna2015EvalTest': {
    fn: canonize.canonize,
    params: [
      parseNQuads(readTestNQuads('action')),
      createTestOptions({
        algorithm: 'URDNA2015',
        inputFormat: 'application/nquads',
        format: 'application/nquads'
      })
    ],
    compare: compareExpectedNQuads
  },
};

var SKIP_TESTS = [];

// create earl report
var earl = new EarlReport();

// run tests
describe('rdf-canonize', function() {
  var filename = joinPath(ROOT_MANIFEST_DIR, 'manifest.jsonld');
  var rootManifest = readJson(filename);
  rootManifest.filename = filename;
  addManifest(rootManifest);

  if(program.earl) {
    var filename = resolvePath(program.earl);
    describe('Writing EARL report to: ' + filename, function() {
      it('should print the earl report', function(done) {
        earl.write(filename);
        done();
      });
    });
  }
});

if(!_nodejs) {
  mocha.run(function() {
    phantom.exit();
  });
}

/**
 * Adds the tests for all entries in the given manifest.
 *
 * @param manifest the manifest.
 */
function addManifest(manifest) {
  describe(manifest.name || manifest.label, function() {
    // get entries and sequence (alias for entries)
    var entries = [].concat(
      getJsonLdValues(manifest, 'entries'),
      getJsonLdValues(manifest, 'sequence')
    );

    var includes = getJsonLdValues(manifest, 'include');
    // add includes to sequence as jsonld files
    for(var i = 0; i < includes.length; ++i) {
      entries.push(includes[i] + '.jsonld');
    }

    // process entries
    for(var i = 0; i < entries.length; ++i) {
      var entry = readManifestEntry(manifest, entries[i]);

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
  var testTypes = Object.keys(TEST_TYPES);
  if(!isJsonLdType(test, testTypes) || isJsonLdType(test, SKIP_TESTS)) {
    var type = [].concat(
      getJsonLdValues(test, '@type'),
      getJsonLdValues(test, 'type')
    );
    console.log('Skipping test "' + test.name + '" of type: ' + type);
  }

  // expand @id and input base
  var test_id = test['@id'] || test['id'];
  //var number = test_id.substr(2);
  test['@id'] = manifest.baseIri + basename(manifest.filename) + test_id;
  test.base = manifest.baseIri + test.input;
  test.manifest = manifest;
  var description = test_id + ' ' + (test.purpose || test.name);

  // FIXME: test async callback mode, async promise mode, and sync mode
  // get appropriate API and run test
  var api = _nodejs ? canonize : canonize.promises;
  it(description, function(done) {
    this.timeout(5000);
    var testInfo = TEST_TYPES[getTestType(test)];
    var params = testInfo.params;
    params = params.map(function(param) {return param(test);});
    var callback = function(err, result) {
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

    if(_nodejs) {
      params.push(callback);
    }

    // promise is undefined for node.js API
    var promise = testInfo.fn.apply(api, params);

    if(!_nodejs) {
      promise.then(function(result) {
        callback(null, result);
      }).catch(callback);
    }
  });
}

function getTestType(test) {
  var types = Object.keys(TEST_TYPES);
  for(var i = 0; i < types.length; ++i) {
    if(isJsonLdType(test, types[i])) {
      return types[i];
    }
  }
  return null;
}

function readManifestEntry(manifest, entry) {
  var dir = dirname(manifest.filename);
  if(typeof entry === 'string') {
    var filename = joinPath(dir, entry);
    entry = readJson(filename);
    entry.filename = filename;
  }
  entry.dirname = dirname(entry.filename || manifest.filename);
  return entry;
}

function readTestNQuads(property) {
  return function(test) {
    if(!test[property]) {
      return null;
    }
    var filename = joinPath(test.dirname, test[property]);
    return readFile(filename);
  };
}

function parseNQuads(fn) {
  return function(test) {
    return NQuads.parse(fn(test));
  };
}

function createTestOptions(opts) {
  return function(test) {
    var options = {};
    var testOptions = test.option || {};
    for(var key in testOptions) {
      options[key] = testOptions[key];
    }
    if(opts) {
      // extend options
      for(var key in opts) {
        options[key] = opts[key];
      }
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
  try {
    var expect = readTestNQuads(_getExpectProperty(test))(test);
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
  var nodeType = [].concat(
    getJsonLdValues(node, '@type'),
    getJsonLdValues(node, 'type')
  );
  type = Array.isArray(type) ? type : [type];
  for(var i = 0; i < type.length; ++i) {
    if(nodeType.indexOf(type[i]) !== -1) {
      return true;
    }
  }
  return false;
}

function getJsonLdValues(node, property) {
  var rval = [];
  if(property in node) {
    rval = node[property];
    if(!Array.isArray(rval)) {
      rval = [rval];
    }
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
  var idx = filename.lastIndexOf(fs.separator);
  if(idx === -1) {
    return filename;
  }
  return filename.substr(0, idx);
}

function basename(filename) {
  if(_nodejs) {
    return path.basename(filename);
  }
  var idx = filename.lastIndexOf(fs.separator);
  if(idx === -1) {
    return filename;
  }
  return filename.substr(idx + 1);
}

function EarlReport() {
  var today = new Date();
  today = today.getFullYear() + '-' +
    (today.getMonth() < 9 ?
      '0' + (today.getMonth() + 1) : today.getMonth() + 1) + '-' +
    (today.getDate() < 10 ? '0' + today.getDate() : today.getDate());
  this.report = {
    '@context': {
      'doap': 'http://usefulinc.com/ns/doap#',
      'foaf': 'http://xmlns.com/foaf/0.1/',
      'dc': 'http://purl.org/dc/terms/',
      'earl': 'http://www.w3.org/ns/earl#',
      'xsd': 'http://www.w3.org/2001/XMLSchema#',
      'doap:homepage': {'@type': '@id'},
      'doap:license': {'@type': '@id'},
      'dc:creator': {'@type': '@id'},
      'foaf:homepage': {'@type': '@id'},
      'subjectOf': {'@reverse': 'earl:subject'},
      'earl:assertedBy': {'@type': '@id'},
      'earl:mode': {'@type': '@id'},
      'earl:test': {'@type': '@id'},
      'earl:outcome': {'@type': '@id'},
      'dc:date': {'@type': 'xsd:date'}
    },
    '@id': 'https://github.com/digitalbazaar/jsonld.js',
    '@type': [
      'doap:Project',
      'earl:TestSubject',
      'earl:Software'
    ],
    'doap:name': 'jsonld.js',
    'dc:title': 'jsonld.js',
    'doap:homepage': 'https://github.com/digitalbazaar/rdf-canonize',
    'doap:license':
      'https://github.com/digitalbazaar/rdf-canonize/blob/master/LICENSE',
    'doap:description': 'A JSON-LD processor for JavaScript',
    'doap:programming-language': 'JavaScript',
    'dc:creator': 'https://github.com/dlongley',
    'doap:developer': {
      '@id': 'https://github.com/dlongley',
      '@type': [
        'foaf:Person',
        'earl:Assertor'
      ],
      'foaf:name': 'Dave Longley',
      'foaf:homepage': 'https://github.com/dlongley'
    },
    'dc:date': {
      '@value': today,
      '@type': 'xsd:date'
    },
    'subjectOf': []
  };
  if(_nodejs) {
    this.report['@id'] += '#node.js';
    this.report['doap:name'] += ' node.js';
    this.report['dc:title'] += ' node.js';
  } else {
    this.report['@id'] += '#browser';
    this.report['doap:name'] += ' browser';
    this.report['dc:title'] += ' browser';
  }
}

EarlReport.prototype.addAssertion = function(test, pass) {
  this.report.subjectOf.push({
    '@type': 'earl:Assertion',
    'earl:assertedBy': this.report['doap:developer']['@id'],
    'earl:mode': 'earl:automatic',
    'earl:test': test['@id'],
    'earl:result': {
      '@type': 'earl:TestResult',
      'dc:date': new Date().toISOString(),
      'earl:outcome': pass ? 'earl:passed' : 'earl:failed'
    }
  });
  return this;
};

EarlReport.prototype.write = function(filename) {
  var json = JSON.stringify(this.report, null, 2);
  if(_nodejs) {
    fs.writeFileSync(filename, json);
  } else {
    fs.write(filename, json, 'w');
  }
  return this;
};

})();
