/**
 * Make tests for benchmarks.
 *
 * @author Dave Longley
 * @author David I. Lehn
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* eslint-disable indent */
(async () => {
const fs = require('fs');
const jsonld = require('../../jsonld.js');

const b1json = fs.readFileSync('./block-1.json');
const b1 = JSON.parse(b1json);

const loader = (url, callback) => {
  if(url === 'https://w3id.org/test/v1') {
    callback(null, {
      document: JSON.parse(fs.readFileSync('./test-v1.jsonld'))
    });
  }
  if(url === 'https://w3id.org/webledger/v1') {
    return callback(null, {
      document: JSON.parse(fs.readFileSync('./webledger-v1.jsonld'))
    });
  }
  return jsonld.loadDocument(url, callback);
};

async function bn(b, n) {
  console.log(`Make block-${n}-{in,out}.nq`);
  const data = JSON.parse(JSON.stringify(b));
  //console.log('nq0', data);

  const ev = data.event[0];
  data.event = [];
  //console.log('nq1', data);
  for(let i = 0; i < n; ++i) {
    // copy and change id
    const newEv = JSON.parse(JSON.stringify(ev));
    newEv.input[0].id = newEv.input[0].id + '-' + i;
    //console.log('push', newEv);
    data.event.push(newEv);
  }
  //console.log('nq2', data);

  const nq = await jsonld.toRDF(data, {
    format: 'application/n-quads',
    documentLoader: loader
  });
  fs.writeFileSync(`./block-${n}-in.nq`, nq);
  const can = await jsonld.canonize(data, {
    documentLoader: loader
  });
  fs.writeFileSync(`./block-${n}-out.nq`, can);
}

Promise.all([
  bn(b1, 1),
  bn(b1, 2),
  bn(b1, 10),
  bn(b1, 100),
  bn(b1, 1000)
]).catch(e => console.error(e));

})();
