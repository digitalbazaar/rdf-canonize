/**
 * rdf-canonize URDNA2015
 */

#ifndef RDF_CANONIZE_URDNA2015_H_
#define RDF_CANONIZE_URDNA2015_H_

#include <map>
#include <vector>
#include <cstdio>

class QuadValue {
public:
  std::string type;
  std::string value;
  std::string datatype;
  QuadValue(std::string type, std::string value, std::string datatype) :
    type(type), value(value), datatype(datatype) {};
  QuadValue& operator=(const QuadValue &r) {
    type = r.type;
    value = r.value;
    datatype = r.datatype;
    return *this;
  }
};

class Quad {
public:
  QuadValue subject;
  QuadValue predicate;
  QuadValue object;
  QuadValue name;
  Quad(
    QuadValue subject,
    QuadValue predicate,
    QuadValue object,
    QuadValue name) :
    subject(subject), predicate(predicate), object(object), name(name) {};
  Quad& operator=(const Quad &r) {
    subject = r.subject;
    predicate = r.predicate;
    object = r.object;
    name = r.name;
    return *this;
  }
};

typedef std::vector<Quad> Graph;
typedef std::map<std::string, Graph> Dataset;

class Urdna2015 {
  unsigned maxCallStackDepth;
  unsigned maxTotalCallStackDepth;
  Dataset dataset;
public:
  Urdna2015(
    const unsigned maxCallStackDepth,
    const unsigned maxTotalCallStackDepth,
    Dataset &dataset) :
   maxCallStackDepth(maxCallStackDepth),
   maxTotalCallStackDepth(maxTotalCallStackDepth),
   dataset(dataset) {};
  Urdna2015(const Urdna2015 &u) : dataset(u.dataset) {};
  ~Urdna2015() {};
  std::string main();
};

#endif // RDF_CANONIZE_URDNA2015_H_
