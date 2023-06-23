# rdf-canonize

[![Build status](https://img.shields.io/github/actions/workflow/status/digitalbazaar/rdf-canonize/main.yml)](https://github.com/digitalbazaar/rdf-canonize/actions/workflows/main.yml)
[![Coverage status](https://img.shields.io/codecov/c/github/digitalbazaar/rdf-canonize)](https://codecov.io/gh/digitalbazaar/rdf-canonize)

An implementation of the [RDF Dataset Canonicalization][] specification in
JavaScript.

Introduction
------------

See the [RDF Dataset Canonicalization][] specification for details on the
specification and algorithm this library implements.

Installation
------------

### Node.js + npm

```
npm install rdf-canonize
```

```js
const canonize = require('rdf-canonize');
```

### Node.js + npm + native bindings

This package has support for [rdf-canonize-native][]. This package can be
useful if your application requires doing many canonizing operations
asynchronously in parallel or in the background. It is **highly recommended**
that you understand your requirements and benchmark using JavaScript vs native
bindings. The native bindings add overhead and the JavaScript implementation
may be faster with modern runtimes.

The native bindings are not installed by default and must be explicitly
installed.

```
npm install rdf-canonize
npm install rdf-canonize-native
```

Note that the native code is not automatically used. To use the native bindings
you must have them installed and set the `useNative` option to `true`.

```js
const canonize = require('rdf-canonize');
```

### Browser + npm

Install in your project with `npm` and use your favorite browser bundler tool.

Examples
--------

```js
const dataset = {
  // ...
};

// canonize a data set with a particular algorithm with async/await
const canonical = await canonize.canonize(dataset, {algorithm: 'RDFC-1.0'});

// canonize a data set with a particular algorithm and force use of the
// native implementation
const canonical = await canonize.canonize(dataset, {
  algorithm: 'RDFC-1.0',
  useNative: true
});
```

Algorithm Support
-----------------

* "[RDFC-1.0][]": Supported.
  * Primary algorithm in the [RDF Dataset Canonicalization][] specification.
* "[URDNA2015][]": Deprecated and supported as an alias for "RDFC-1.0".
  * Former algorithm name that evolved into "RDFC-1.0".
  * **NOTE**: There are minor differences in the [canonical N-Quads
    form](https://w3c.github.io/rdf-canon/spec/#canonical-quads) that *could*
    cause canonical output differences in some cases. See the 4.0.0 changelog
    or code for details. If strict "URDNA2015" support is required, use a 3.x
    version of this library.
  * See the migration section below if you have code that uses the "URDNA2015"
    algorithm name.
* "[URGNA2012][]": No longer supported.
  * Older algorithm with significant differences from newer algorithms.
  * Use older versions versions of this library if support is needed.

URDNA2015 Migration
-------------------

* The deprecated "URDNA2015" algorithm name is currently supported as an alias
  for "RDFC-1.0".
* There is a minor difference that could cause compatibilty issues. It is
  considered an edge case that will not be an issue in practice. See above for
  details.
* Two tools are currently provided to help transition to "RDFC-1.0":
  * If the "undocumented" API option `rejectURDNA2015` is truthy, it will cause
    an error to be thrown if "URDNA2015" is used.
  * If the global "RDF\_CANONIZE\_TRACE\_URDNA2015" is truthy, it will cause
    `console.trace()` to be called when "URDNA2015" is used. This is designed
    for *development use only* to find where "URDNA2015" is being used. It
    could be *very* verbose.

Related Modules
---------------

* [jsonld.js][]: An implementation of the [JSON-LD][] specification.

Tests
-----

This library includes a sample testing utility which may be used to verify
that changes to the processor maintain the correct output.

The test suite is included in an external repository:

    https://github.com/w3c/rdf-canon

This should be a sibling directory of the rdf-canonize directory or in a
`test-suites` dir. To clone shallow copies into the `test-suites` dir you can
use the following:

    npm run fetch-test-suite

Node.js tests can be run with a simple command:

    npm test

If you installed the test suites elsewhere, or wish to run other tests, use
the `TEST_DIR` environment var:

    TEST_DIR="/tmp/tests" npm test

To generate earl reports:

    # generate the earl report for node.js
    EARL=earl-node.jsonld npm test

Browser testing with karma is done indirectly through [jsonld.js][].

Benchmark
---------

See docs in the [benchmark README](./benchmark/README.md).

Source
------

The source code for this library is available at:

https://github.com/digitalbazaar/rdf-canonize

Commercial Support
------------------

Commercial support for this library is available upon request from
[Digital Bazaar][]: support@digitalbazaar.com

[Digital Bazaar]: https://digitalbazaar.com/
[JSON-LD]: https://json-ld.org/
[RDF Dataset Canonicalization]: https://w3c.github.io/rdf-canon/spec/
[RDFC-1.0]: https://w3c.github.io/rdf-canon/spec/
[URDNA2015]: https://w3c.github.io/rdf-canon/spec/#urdna2015
[URGNA2012]: https://w3c.github.io/rdf-canon/spec/#urgna2012
[jsonld.js]: https://github.com/digitalbazaar/jsonld.js
[rdf-canonize-native]: https://github.com/digitalbazaar/rdf-canonize-native
