/**
 * rdf-canonize Quad
 */

#ifndef RDF_CANONIZE_QUAD_H_
#define RDF_CANONIZE_QUAD_H_

#include <vector>
#include <string>
#include <cstring>

namespace RdfCanonize {

typedef enum {
  BlankNode,
  NamedNode,
  Literal,
  DefaultGraph
} TermType;

struct Term {
  // all
  TermType termType;
  char* value;
  bool valueManaged;

  // literal
  Term* datatype;
  std::string* language;

  Term(const TermType& termType) :
    termType(termType),
    value((char*)""), valueManaged(false),
    datatype(NULL), language(NULL) {};
  ~Term() {
    if(value != NULL && valueManaged) {
      free(value);
    }
    if(datatype != NULL) {
      delete datatype;
    }
    if(language != NULL) {
      delete language;
    }
  };
  // TODO: remove default for `manage`
  void setValue(const std::string& newValue, bool manage = true) {
    if(manage) {
      if(!valueManaged) {
        value = NULL;
      }
      value = (char*)realloc(value, newValue.size() + 1);
      strcpy(value, newValue.c_str());
    } else {
      if(valueManaged) {
        free(value);
      }
      value = (char*)newValue.c_str();
    }
    valueManaged = manage;
  }
  // TODO: remove default for `manage`
  void setValue(const char* newValue, bool manage = true) {
    if(manage) {
      if(!valueManaged) {
        value = NULL;
      }
      value = (char*)realloc(value, strlen(newValue) + 1);
      strcpy(value, newValue);
    } else {
      if(valueManaged) {
        free(value);
      }
      value = (char*)newValue;
    }
    valueManaged = manage;
  }
  Term* clone() const {
    Term* copy = new Term(termType);
    copy->setValue(value, valueManaged);
    if(datatype != NULL) {
      copy->datatype = datatype->clone();
    }
    if(language != NULL) {
      copy->language = new std::string(*language);
    }
    return copy;
  }
};

struct Quad {
  Term* subject;
  Term* predicate;
  Term* object;
  Term* graph;
  std::string* hash;

  Quad() :
    subject(NULL), predicate(NULL), object(NULL), graph(NULL), hash(NULL) {};
  Quad& operator=(const Quad& toCopy) {
    delete subject;
    delete predicate;
    delete object;
    delete graph;
    delete hash;

    subject = toCopy.subject->clone();
    predicate = toCopy.predicate->clone();
    object = toCopy.object->clone();
    graph = toCopy.graph->clone();
    if(toCopy.hash == NULL) {
      hash = NULL;
    } else {
      hash = new std::string(*toCopy.hash);
    }

    return *this;
  }
  ~Quad() {
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
    if(hash != NULL) {
      delete hash;
    }
  }
};

typedef std::vector<Quad*> QuadSet;

struct Dataset {
  QuadSet quads;

  ~Dataset() {
    for(Quad* quad : quads) {
      delete quad;
    }
  }
};

}

#endif // RDF_CANONIZE_QUAD_H_
