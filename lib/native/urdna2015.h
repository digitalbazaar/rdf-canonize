/**
 * rdf-canonize URDNA2015
 */

#ifndef RDF_CANONIZE_URDNA2015_H_
#define RDF_CANONIZE_URDNA2015_H_

#include "Quad.h"
#include "IdentifierIssuer.h"
#include <map>
#include <vector>
#include <string>

namespace RdfCanonize {

// TODO: represent as char* (bytes, not hex) instead
typedef std::string Hash;

struct BlankNodeInfo {
  QuadSet quads;
  Hash hash;
};

typedef std::vector<NodeIdentifier> NodeIdentifierList;
typedef std::map<NodeIdentifier, BlankNodeInfo> BlankNodeInfoMap;
typedef std::map<Hash, NodeIdentifierList> HashToBlankNodeMap;

typedef std::pair<Hash, IdentifierIssuer*> HashPath;
typedef std::vector<HashPath> HashPathList;

struct Urdna2015 {
  BlankNodeInfoMap blankNodeInfo;
  HashToBlankNodeMap hashToBlankNodes;
  IdentifierIssuer canonicalIssuer;
  IdentifierIssuerPool issuerPool;
  const char* hashAlgorithm = "sha256";
  unsigned maxCallStackDepth;
  unsigned maxTotalCallStackDepth;

  Urdna2015(
    const unsigned maxCallStackDepth,
    const unsigned maxTotalCallStackDepth) :
    canonicalIssuer("_:c14n"),
    maxCallStackDepth(maxCallStackDepth),
    maxTotalCallStackDepth(maxTotalCallStackDepth) {};
  ~Urdna2015() {};

  std::string main(const Dataset& dataset);
  Hash hashFirstDegreeQuads(NodeIdentifier id);
  Hash hashRelatedBlankNode(
    NodeIdentifier related, const Quad& quad,
    IdentifierIssuer& issuer, char position);
  HashPath hashNDegreeQuads(NodeIdentifier id, IdentifierIssuer*& issuer);
  Term* modifyFirstDegreeComponent(NodeIdentifier id, const Term& component);
  std::string getRelatedPredicate(const Quad& quad);
  HashToBlankNodeMap createHashToRelated(
    NodeIdentifier id, IdentifierIssuer*& issuer);
};

}

#endif // RDF_CANONIZE_URDNA2015_H_
