/**
 * rdf-canonize URDNA2015
 */

#ifndef RDF_CANONIZE_URDNA2015_H_
#define RDF_CANONIZE_URDNA2015_H_

#include "Quad.h"

namespace RdfCanonize {

struct Urdna2015 {
  unsigned maxCallStackDepth;
  unsigned maxTotalCallStackDepth;
  Urdna2015(
    const unsigned maxCallStackDepth,
    const unsigned maxTotalCallStackDepth) :
   maxCallStackDepth(maxCallStackDepth),
   maxTotalCallStackDepth(maxTotalCallStackDepth) {};
  ~Urdna2015() {};
  std::string main(const Dataset& dataset);
};

}

#endif // RDF_CANONIZE_URDNA2015_H_
