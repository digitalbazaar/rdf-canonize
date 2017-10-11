/*********************************************************************
 * rdf-canonize addon for Node.js.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc.
 *
 * MIT License
 * <https://github.com/digitalbazaar/equihash/blob/master/LICENSE>
 ********************************************************************/

#include <nan.h>
#include "addon.h"   // NOLINT(build/include)
#include "urdna2015.h"  // NOLINT(build/include)

using Nan::AsyncQueueWorker;
using Nan::AsyncWorker;
using Nan::Callback;
using Nan::GetFunction;
using Nan::HandleScope;
using Nan::MaybeLocal;
using Nan::New;
using Nan::Null;
using Nan::Set;
using Nan::To;
using Nan::Utf8String;
using v8::Array;
using v8::Function;
using v8::FunctionTemplate;
using v8::Handle;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;

class Urdna2015Worker : public AsyncWorker {
public:
  Urdna2015Worker(Urdna2015 urdna2015, Callback* callback)
    : AsyncWorker(callback), urdna2015(urdna2015) {}
  ~Urdna2015Worker() {}

  // Executed inside the worker-thread.
  // It is not safe to access V8, or V8 data structures
  // here, so everything we need for input and output
  // should go on `this`.
  void Execute () {
    output = urdna2015.main();
  }

  // Executed when the async work is complete
  // this function will be run inside the main event loop
  // so it is safe to use V8 again
  void HandleOKCallback () {
    HandleScope scope;
    Local<Value> argv[] = {
      Null(),
      New(output.c_str()).ToLocalChecked()
    };

    callback->Call(2, argv);
  }

private:
  Urdna2015 urdna2015;
  std::string output;
};

NAN_METHOD(Main) {
  // ensure first argument is an object
  if(!info[0]->IsObject()) {
    Nan::ThrowTypeError("'options' must be an object");
    return;
  }
  // ensure second argument is a callback
  if(!info[1]->IsFunction()) {
    Nan::ThrowTypeError("'callback' must be a function");
    return;
  }

  Callback* callback = new Callback(info[1].As<Function>());
  Handle<Object> object = Handle<Object>::Cast(info[0]);
  /*
  Handle<Value> maxCallStackDepthValue =
    object->Get(New("maxCallStackDepth").ToLocalChecked());
  Handle<Value> maxTotalCallStackDepthValue =
    object->Get(New("maxTotalCallStackDepth").ToLocalChecked());
  */
  Handle<Object> datasetValue =
    Handle<Object>::Cast(object->Get(New("dataset").ToLocalChecked()));

  /*
  const unsigned maxCallStackDepth =
    To<unsigned>(maxCallStackDepthValue).FromJust();
  const unsigned maxTotalCallStackDepth =
    To<unsigned>(maxTotalCallStackDepthValue).FromJust();
  */

  Dataset dataset;
  Handle<Array> quadNames =
    Handle<Array>::Cast(datasetValue->GetOwnPropertyNames());

  Local<String> subjectKey = New("subject").ToLocalChecked();
  Local<String> predicateKey = New("predicate").ToLocalChecked();
  Local<String> objectKey = New("object").ToLocalChecked();
  Local<String> nameKey = New("name").ToLocalChecked();
  Local<String> typeKey = New("type").ToLocalChecked();
  Local<String> valueKey = New("value").ToLocalChecked();
  Local<String> datatypeKey = New("datatype").ToLocalChecked();

  // TODO: check for valid structure
  for(size_t gi = 0; gi < quadNames->Length(); ++gi) {
    Local<Value> quadName = quadNames->Get(gi);
    Handle<Array> quads = Handle<Array>::Cast(datasetValue->Get(quadName));
    Graph g;
    for(size_t qi = 0; qi < quads->Length(); ++qi) {
      Handle<Object> quad = Handle<Object>::Cast(quads->Get(qi));

      Handle<Object> subject =
        Handle<Object>::Cast(quad->Get(subjectKey));
      Handle<Object> predicate =
        Handle<Object>::Cast(quad->Get(predicateKey));
      Handle<Object> object =
        Handle<Object>::Cast(quad->Get(objectKey));
      Handle<Object> name =
        Handle<Object>::Cast(quad->Get(nameKey));

      Quad q(
        QuadValue(
          *Utf8String(subject->Get(typeKey)),
          *Utf8String(subject->Get(valueKey)),
          *Utf8String(subject->Get(datatypeKey))),
        QuadValue(
          *Utf8String(predicate->Get(typeKey)),
          *Utf8String(predicate->Get(valueKey)),
          *Utf8String(predicate->Get(valueKey))),
        QuadValue(
          *Utf8String(object->Get(typeKey)),
          *Utf8String(object->Get(valueKey)),
          *Utf8String(object->Get(datatypeKey))),
        QuadValue(
          *Utf8String(name->Get(typeKey)),
          *Utf8String(name->Get(valueKey)),
          *Utf8String(name->Get(datatypeKey))));
      g.push_back(q);
    }

    dataset[*Utf8String(quadName)] = g;
  }

  //Urdna2015 urdna2015(maxCallStackDepth, maxTotalCallStackDepth, dataset);
  Urdna2015 urdna2015(0, 0, dataset);

  AsyncQueueWorker(new Urdna2015Worker(urdna2015, callback));
}

NAN_MODULE_INIT(InitAll) {
  Set(
    target, New<String>("main").ToLocalChecked(),
    GetFunction(New<FunctionTemplate>(Main)).ToLocalChecked());
}

NODE_MODULE(addon, InitAll)
