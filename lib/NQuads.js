/*
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const util = require('util');

const ATTRS = ['subject', 'predicate', 'object'];
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDF_LANGSTRING = RDF + 'langString';
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';

module.exports = class NQuads {
  /**
   * Parses RDF in the form of N-Quads.
   *
   * @param input the N-Quads input to parse.
   *
   * @return an RDF dataset.
   */
  static parse(input) {
    // define partial regexes
    const iri = '(?:<([^:]+:[^>]*)>)';
    const bnode = '(_:(?:[A-Za-z0-9]+))';
    const plain = '"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"';
    const datatype = '(?:\\^\\^' + iri + ')';
    const language = '(?:@([a-z]+(?:-[a-z0-9]+)*))';
    const literal = '(?:' + plain + '(?:' + datatype + '|' + language + ')?)';
    const ws = '[ \\t]+';
    const wso = '[ \\t]*';
    const eoln = /(?:\r\n)|(?:\n)|(?:\r)/g;
    const empty = new RegExp('^' + wso + '$');

    // define quad part regexes
    const subject = '(?:' + iri + '|' + bnode + ')' + ws;
    const property = iri + ws;
    const object = '(?:' + iri + '|' + bnode + '|' + literal + ')' + wso;
    const graphName = '(?:\\.|(?:(?:' + iri + '|' + bnode + ')' + wso + '\\.))';

    // full quad regex
    const quad = new RegExp(
      '^' + wso + subject + property + object + graphName + wso + '$');

    // build RDF dataset
    const dataset = {};

    // split N-Quad input into lines
    const lines = input.split(eoln);
    let lineNumber = 0;
    for(let li = 0; li < lines.length; ++li) {
      const line = lines[li];
      lineNumber++;

      // skip empty lines
      if(empty.test(line)) {
        continue;
      }

      // parse quad
      const match = line.match(quad);
      if(match === null) {
        throw new Error('N-Quads parse error on line ' + lineNumber + '.');
      }

      // create RDF triple
      const triple = {};

      // get subject
      if(!util.isUndefined(match[1])) {
        triple.subject = {type: 'IRI', value: match[1]};
      } else {
        triple.subject = {type: 'blank node', value: match[2]};
      }

      // get predicate
      triple.predicate = {type: 'IRI', value: match[3]};

      // get object
      if(!util.isUndefined(match[4])) {
        triple.object = {type: 'IRI', value: match[4]};
      } else if(!util.isUndefined(match[5])) {
        triple.object = {type: 'blank node', value: match[5]};
      } else {
        triple.object = {type: 'literal'};
        if(!util.isUndefined(match[7])) {
          triple.object.datatype = match[7];
        } else if(!util.isUndefined(match[8])) {
          triple.object.datatype = RDF_LANGSTRING;
          triple.object.language = match[8];
        } else {
          triple.object.datatype = XSD_STRING;
        }
        var unescaped = match[6]
          .replace(/\\"/g, '"')
          .replace(/\\t/g, '\t')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\\\/g, '\\');
        triple.object.value = unescaped;
      }

      // get graph name ('@default' is used for the default graph)
      let name = '@default';
      if(!util.isUndefined(match[9])) {
        name = match[9];
      } else if(!util.isUndefined(match[10])) {
        name = match[10];
      }

      // initialize graph in dataset
      if(!(name in dataset)) {
        dataset[name] = [triple];
      } else {
        // FIXME: this should become unnecessary w/new format for abstract dataset
        // add triple if unique to its graph
        let unique = true;
        const triples = dataset[name];
        for(let ti = 0; unique && ti < triples.length; ++ti) {
          if(_compareTriples(triples[ti], triple)) {
            unique = false;
          }
        }
        if(unique) {
          triples.push(triple);
        }
      }
    }

    return dataset;
  }

  /**
   * Converts an RDF dataset to N-Quads.
   *
   * @param dataset the RDF dataset to convert.
   *
   * @return the N-Quads string.
   */
  static serialize(dataset) {
    const quads = [];
    for(let graphName in dataset) {
      const triples = dataset[graphName];
      for(let ti = 0; ti < triples.length; ++ti) {
        const triple = triples[ti];
        if(graphName === '@default') {
          graphName = null;
        }
        quads.push(NQuads.serializeQuad(triple, graphName));
      }
    }
    return quads.sort().join('');
  }

  /**
   * Converts an RDF triple and graph name to an N-Quad string (a single quad).
   *
   * @param triple the RDF triple or quad to convert (a triple or quad may be
   *          passed, if a triple is passed then `graphName` should be given
   *          to specify the name of the graph the triple is in, `null` for
   *          the default graph).
   * @param graphName the name of the graph containing the triple, null for
   *          the default graph.
   *
   * @return the N-Quad string.
   */
  static serializeQuad(triple, graphName) {
    const s = triple.subject;
    const p = triple.predicate;
    const o = triple.object;
    let g = graphName || null;
    if('name' in triple && triple.name) {
      g = triple.name.value;
    }

    let quad = '';

    // subject is an IRI
    if(s.type === 'IRI') {
      quad += '<' + s.value + '>';
    } else {
      quad += s.value;
    }
    quad += ' ';

    // predicate is an IRI
    if(p.type === 'IRI') {
      quad += '<' + p.value + '>';
    } else {
      quad += p.value;
    }
    quad += ' ';

    // object is IRI, bnode, or literal
    if(o.type === 'IRI') {
      quad += '<' + o.value + '>';
    } else if(o.type === 'blank node') {
      quad += o.value;
    } else {
      const escaped = o.value
        .replace(/\\/g, '\\\\')
        .replace(/\t/g, '\\t')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\"/g, '\\"');
      quad += '"' + escaped + '"';
      if(o.datatype === RDF_LANGSTRING) {
        if(o.language) {
          quad += '@' + o.language;
        }
      } else if(o.datatype !== XSD_STRING) {
        quad += '^^<' + o.datatype + '>';
      }
    }

    // graph
    if(g !== null && g !== undefined) {
      if(g.indexOf('_:') !== 0) {
        quad += ' <' + g + '>';
      } else {
        quad += ' ' + g;
      }
    }

    quad += ' .\n';
    return quad;
  }
};

/**
 * Compares two RDF triples for equality.
 *
 * @param t1 the first triple.
 * @param t2 the second triple.
 *
 * @return true if the triples are the same, false if not.
 */
function _compareTriples(t1, t2) {
  for(let i = 0; i < ATTRS.length; ++i) {
    const attr = ATTRS[i];
    if(t1[attr].type !== t2[attr].type || t1[attr].value !== t2[attr].value) {
      return false;
    }
  }
  if(t1.object.language !== t2.object.language) {
    return false;
  }
  if(t1.object.datatype !== t2.object.datatype) {
    return false;
  }
  return true;
}
