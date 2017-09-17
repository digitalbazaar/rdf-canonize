/**
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const fs = require('fs');

module.exports = class EarlReport {
  constructor(implementation) {
    this.implementation = 'node.js';
    let today = new Date();
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
    this.report['@id'] += '#' + implementation;
    this.report['doap:name'] += ' ' + implementation;
    this.report['dc:title'] += ' ' + implementation;
  }

  addAssertion(test, pass) {
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
  }

  write(filename) {
    const json = JSON.stringify(this.report, null, 2);
    if(this.implementation === 'node.js') {
      fs.writeFileSync(filename, json);
    } else {
      fs.write(filename, json, 'w');
    }
    return this;
  }
};
