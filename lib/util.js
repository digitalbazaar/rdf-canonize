/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

var api = {};
module.exports = api;

// define setImmediate and nextTick
//// nextTick implementation with browser-compatible fallback ////
// from https://github.com/caolan/async/blob/master/lib/async.js

// capture the global reference to guard against fakeTimer mocks
var _setImmediate = typeof setImmediate === 'function' && setImmediate;

var _delay = _setImmediate ? function(fn) {
  // not a direct alias (for IE10 compatibility)
  _setImmediate(fn);
} : function(fn) {
  setTimeout(fn, 0);
};

if(typeof process === 'object' && typeof process.nextTick === 'function') {
  api.nextTick = process.nextTick;
} else {
  api.nextTick = _delay;
}
api.setImmediate = _setImmediate ? _delay : api.nextTick;

/**
 * Clones an object, array, or string/number. If a typed JavaScript object
 * is given, such as a Date, it will be converted to a string.
 *
 * @param value the value to clone.
 *
 * @return the cloned value.
 */
api.clone = function(value) {
  if(value && typeof value === 'object') {
    var rval;
    if(Array.isArray(value)) {
      rval = [];
      for(var i = 0; i < value.length; ++i) {
        rval[i] = api.clone(value[i]);
      }
    } else if(api.isObject(value)) {
      rval = {};
      for(var key in value) {
        rval[key] = api.clone(value[key]);
      }
    } else {
      rval = value.toString();
    }
    return rval;
  }
  return value;
};

/**
 * Returns true if the given value is an Object.
 *
 * @param v the value to check.
 *
 * @return true if the value is an Object, false if not.
 */
api.isObject = function(v) {
  return (Object.prototype.toString.call(v) === '[object Object]');
};

/**
 * Returns true if the given value is undefined.
 *
 * @param v the value to check.
 *
 * @return true if the value is undefined, false if not.
 */
api.isUndefined = function(v) {
  return (typeof v === 'undefined');
};
