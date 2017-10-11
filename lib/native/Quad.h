/**
 * rdf-canonize Quad
 */

#ifndef RDF_CANONIZE_QUAD_H_
#define RDF_CANONIZE_QUAD_H_

#include <vector>
#include <string>

namespace RdfCanonize {

typedef enum {
  BLANK_NODE,
  NAMED_NODE,
  LITERAL,
  DEFAULT_GRAPH
} TermType;

struct Term {
  TermType termType;
  std::string value;

  Term(const TermType& termType, const std::string& value = "") :
    termType(termType), value(value) {};
  Term* clone() {
    return new Term(termType, value);
  }
};

struct BlankNode : public Term {
  BlankNode(const std::string& value = "") :
    Term(TermType::BLANK_NODE, value) {};
  Term* clone() {
    return new BlankNode(value);
  }
};

struct NamedNode : public Term {
  NamedNode(const std::string& value = "") :
    Term(TermType::NAMED_NODE, value) {};
  Term* clone() {
    return new NamedNode(value);
  }
};

struct Literal : public Term {
  std::string language;
  NamedNode* datatype;

  Literal(const std::string& value = "") :
    Term(TermType::LITERAL, value), datatype(NULL) {};
  ~Literal() {
    if(datatype != NULL) {
      delete datatype;
    }
  }
  Term* clone() {
    Literal* literal = new Literal();
    literal->language = language;
    if(datatype != NULL) {
      literal->datatype = (NamedNode*)datatype->clone();
    }
    return literal;
  }
};

struct DefaultGraph : public Term {
  DefaultGraph() : Term(TermType::DEFAULT_GRAPH) {};
  Term* clone() {
    return new DefaultGraph();
  }
};

struct Quad {
  Term* subject;
  Term* predicate;
  Term* object;
  Term* graph;

  Quad() : subject(NULL), predicate(NULL), object(NULL), graph(NULL) {};
  Quad& operator=(const Quad& toCopy) {
    delete subject;
    delete predicate;
    delete object;
    if(graph != NULL) {
      delete graph;
      graph = NULL;
    }

    subject = toCopy.subject->clone();
    predicate = toCopy.predicate->clone();
    object = toCopy.object->clone();
    if(toCopy.graph != NULL) {
      graph = toCopy.graph->clone();
    }

    return *this;
  }
  ~Quad() {
    printf("destroy quad\n");
    if(subject != NULL) {
      delete subject;
    }
    if(predicate != NULL) {
      delete predicate;
    }
    if(object != NULL) {
      delete object;
    }
    if(graph != NULL) {
      delete graph;
    }
  }
};

typedef std::vector<Quad*> QuadSet;

struct Dataset {
  QuadSet quads;

  ~Dataset() {
    printf("destroy dataset\n");
    for(QuadSet::iterator i = quads.begin(); i != quads.end(); ++i) {
      delete *i;
    }
  }
};

}

#endif // RDF_CANONIZE_QUAD_H_
