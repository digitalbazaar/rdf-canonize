# rdf-canonize ChangeLog

### Notes
- **WARNING**: This release has a **BREAKING** change that could cause the
  canonical N-Quads output to differ from previous releases. Specifically, tabs
  in literals are no longer escaped. No backwards compatibility mode is
  provided at this time but if you belive it is needed, please file an issue.

### Fixed
- **BREAKING**: N-Quad canonical serialized output.
  - Only escape 4 chars.
  - Now compatible with https://www.w3.org/TR/n-triples/#canonical-ntriples

### Changed
- Improve N-Quads parsing.
  - Unescape literals.
  - Handle unicode escapes.
- N-Quad serialization optimization.
  - Varies based on input by roughly ~1-2x.

## 0.3.0 - 2018-11-01

### Changed
- **BREAKING**: Move native support to optional `rdf-canonize-native` package.
  If native support is **required** in your environment then *also* add a
  dependency on the `rdf-canonize-native` package directly. This package only
  has an *optional* dependency on the native packge to allow systems without
  native binding build tools to use the JavaScript implementation alone.

### Added
- Istanbul coverage support.

## 0.2.5 - 2018-11-01

### Fixed
- Accept N-Quads upper case language tag.
- Improve acceptable N-Quads blank node labels.

## 0.2.4 - 2018-04-25

### Fixed
- Update for Node.js 10 / OpenSSL 1.1 API.

### Changed
- Update nan dependency for Node.js 10 support.

## 0.2.3 - 2017-12-05

### Fixed
- Avoid variable length arrays.  Not supported by some C++ compilers.

## 0.2.2 - 2017-12-04

### Fixed
- Use const array initializer sizes.

### Changed
- Comment out debug logging.

## 0.2.1 - 2017-10-16

### Fixed
- Distribute `binding.gyp`.

## 0.2.0 - 2017-10-16

### Added
- Benchmark tool using the same manifests as the test system.
- Support Node.js 6.
- Native Node.js addon support for URDNA2015. Improves performance.
- `usePureJavaScript` option to only use JavaScript.

## 0.1.5 - 2017-09-18

### Changed
- **BREAKING**: Remove Node.js 4.x testing and native support. Use a transpiler
  such as babel if you need further 4.x support.

## 0.1.4 - 2017-09-17

### Added
- Expose `IdentifierIssuer` helper class.

## 0.1.3 - 2017-09-17

### Fixed
- Fix build.

## 0.1.2 - 2017-09-17

### Changed
- Change internals to use ES6.
- Return Promise from API for async method.

## 0.1.1 - 2017-08-15

### Fixed
- Move node-forge to dependencies.

## 0.1.0 - 2017-08-15

### Added
- RDF Dataset Normalization async implementation from [jsonld.js][].
- webpack support.
- Split messageDigest into Node.js and browser files.
  - Node.js file uses native crypto module.
  - Browser file uses forge.
- See git history for all changes.

[jsonld.js]: https://github.com/digitalbazaar/jsonld.js
