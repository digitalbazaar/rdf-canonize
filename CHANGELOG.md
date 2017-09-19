# rdf-canonize ChangeLog

### Changed
- *BREAKING*: Remove Node.js 4.x testing and native support. Use a transpiler
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
