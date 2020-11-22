/*
 * Copyright (c) 2016-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

// TODO: convert to ES6 iterable?

module.exports = class Permuter {
  /**
   * A Permuter iterates over all possible permutations of the given array
   * of elements.
   *
   * @param list the array of elements to iterate over.
   */
  constructor(list) {
    // original array
    this.list = list.sort();
    // indicates whether there are more permutations
    this.done = false;
    // directional info for permutation algorithm
    this.left = new Map();
    for(let i = 0; i < list.length; ++i) {
      this.left.set(list[i], true);
    }
  }

  /**
   * Returns true if there is another permutation.
   *
   * @return true if there is another permutation, false if not.
   */
  hasNext() {
    return !this.done;
  }

  /**
   * Gets the next permutation. Call hasNext() to ensure there is another one
   * first.
   *
   * @return the next permutation.
   */
  next() {
    // copy current permutation
    const rval = this.list.slice();

    /* Calculate the next permutation using the Steinhaus-Johnson-Trotter
     permutation algorithm. */

    // get largest mobile element k
    // (mobile: element is greater than the one it is looking at)
    let k = null;
    let pos = 0;
    const length = this.list.length;
    for(let i = 0; i < length; ++i) {
      const element = this.list[i];
      const left = this.left.get(element);
      if((k === null || element > k) &&
        ((left && i > 0 && element > this.list[i - 1]) ||
        (!left && i < (length - 1) && element > this.list[i + 1]))) {
        k = element;
        pos = i;
      }
    }

    // no more permutations
    if(k === null) {
      this.done = true;
    } else {
      // swap k and the element it is looking at
      const swap = this.left.get(k) ? pos - 1 : pos + 1;
      this.list[pos] = this.list[swap];
      this.list[swap] = k;

      // reverse the direction of all elements larger than k
      for(const element of this.list) {
        if(element > k) {
          this.left.set(element, !this.left.get(element));
        }
      }
    }

    return rval;
  }
};
