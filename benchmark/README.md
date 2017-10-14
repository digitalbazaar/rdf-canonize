RDF Dataset Canonicalization Benchmark
--------------------------------------

The benchmark system uses the same manifest setup as the test suite.  This
allows setting up both tests and benchmarks with one setup.

In the root dir run **all** test suite tests:

    npm run benchmark

To run a particular dir or file:

    TEST_DIR=./benchmark npm run benchmark
    TEST_DIR=./benchmark/m2.jsonld npm run benchmark

As an addition to the test suite, tests can be marked with boolean "skip" or
"only" flags. The "only" support is a hack and requies the env var "ONLY" to be
set:

    ONLY=1 npm run benchmark
    ONLY=1 TEST_DIR=./benchmark npm run benchmark

Tests are benchmarked with a matrix of {async/sync} {js/native} {x1/x10}.

To run large "block" benchmarks, run the builder script first:

    node make-tests.js
