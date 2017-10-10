/*********************************************************************
 * rdf-canonize urdna2015 for Node.js.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc.
 *
 * MIT License
 * <https://github.com/digitalbazaar/equihash/blob/master/LICENSE>
 ********************************************************************/

#include "urdna2015.h"
#include <algorithm>
#include <cstring>

using namespace std;

std::string Urdna2015::main() {
    Dataset::iterator dit = dataset.begin();
    printf("dataset:\n");
    while(dit != dataset.end()) {
        Graph g = dit->second;
        printf("  graph[%s]:\n", dit->first.c_str());
        Graph::iterator git = g.begin();
        while(git != g.end()) {
           Quad q = *git;
           printf("    quad:\n");
           printf("      subject:\n");
           printf("        type: %s\n", q.subject.type.c_str());
           printf("        value: %s\n", q.subject.value.c_str());
           printf("        datatype: %s\n", q.subject.datatype.c_str());
           printf("      predicate:\n");
           printf("        type: %s\n", q.predicate.type.c_str());
           printf("        value: %s\n", q.predicate.value.c_str());
           printf("        datatype: %s\n", q.predicate.datatype.c_str());
           printf("      object:\n");
           printf("        type: %s\n", q.object.type.c_str());
           printf("        value: %s\n", q.object.value.c_str());
           printf("        datatype: %s\n", q.object.datatype.c_str());
           printf("      name:\n");
           printf("        type: %s\n", q.name.type.c_str());
           printf("        value: %s\n", q.name.value.c_str());
           printf("        datatype: %s\n", q.name.datatype.c_str());
           git++;
        }
        dit++;
    }
    return "FIXME";
}
