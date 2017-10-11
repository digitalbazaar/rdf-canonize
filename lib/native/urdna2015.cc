/*********************************************************************
 * rdf-canonize urdna2015 for Node.js.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc.
 *
 * BSD License
 * <https://github.com/digitalbazaar/rdf-canonize/blob/master/LICENSE>
 ********************************************************************/

#include "urdna2015.h"
#include <algorithm>
#include <cstring>

using namespace std;
using namespace RdfCanonize;

static void printTerm(const Term& term);

string Urdna2015::main(const Dataset& dataset) {
  QuadSet::const_iterator dit = dataset.quads.begin();
  printf("dataset:\n");
  while(dit != dataset.quads.end()) {
    Quad& q = **dit;
    printf("  quad:\n");
    printf("    subject:\n");
    printTerm(*(q.subject));
    printf("    predicate:\n");
    printTerm(*(q.predicate));
    printf("    object:\n");
    printTerm(*(q.object));
    if(q.graph != NULL) {
      printf("    graph:\n");
      printTerm(*(q.graph));
    }
    dit++;
  }
  return "FIXME";
}

static void printTerm(const Term& term) {
  string termType;
  switch(term.termType) {
    case TermType::BLANK_NODE:
      termType = "BlankNode";
      break;
    case TermType::NAMED_NODE:
      termType = "NamedNode";
      break;
    case TermType::LITERAL:
      termType = "Literal";
      break;
    case TermType::DEFAULT_GRAPH:
      termType = "DefaultGraph";
      break;
  }

  printf("      termType: %s\n", termType.c_str());
  if(term.termType != TermType::DEFAULT_GRAPH) {
    printf("      value: %s\n", term.value.c_str());
  }
  if(term.termType == TermType::LITERAL) {
    Term* datatype = ((Literal&)term).datatype;
    string& language = ((Literal&)term).language;
    if(datatype != NULL) {
      printf("      datatype: \n");
      printTerm(*datatype);
    } else if(language != "") {
      printf("      language: %s\n", language.c_str());
    }
  }
}
