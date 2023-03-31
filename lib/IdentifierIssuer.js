/*
 * Copyright (c) 2016-2023 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

module.exports = class IdentifierIssuer {
  /**
   * Creates a new IdentifierIssuer. A IdentifierIssuer issues unique
   * identifiers, keeping track of any previously issued identifiers.
   *
   * @param prefix the prefix to use ('<prefix><counter>').
   * @param existing an existing refs and Map object to use.
   * @param counter the counter to use.
   */
  constructor(prefix, existing = {refs: 0, map: new Map()}, counter = 0) {
    this.prefix = prefix;
    this._existing = existing;
    // add ref to shared map
    this._existing.refs++;
    this.counter = counter;
  }

  /**
   * Copies this IdentifierIssuer.
   *
   * @return a copy of this IdentifierIssuer.
   */
  clone() {
    const {prefix, _existing, counter} = this;
    return new IdentifierIssuer(prefix, _existing, counter);
  }

  /**
   * Gets the new identifier for the given old identifier, where if no old
   * identifier is given a new identifier will be generated.
   *
   * @param [old] the old identifier to get the new identifier for.
   *
   * @return the new identifier.
   */
  getId(old) {
    // return existing old identifier
    const existing = old && this._existing.map.get(old);
    if(existing) {
      return existing;
    }

    // get next identifier
    const identifier = this.prefix + this.counter;
    this.counter++;

    // save mapping
    if(old) {
      if(this._existing.refs > 1) {
        // copy-on-write shared map
        // TODO: improve copy-on-write reference handling
        //   - current code handles copying the 'existing' maps when it is
        //     shared
        //   - it will remove a reference when doing a copy
        //   - a reference is NOT removed when a copy is no longer used
        //   - need a `release()` call or similar to do this and add it
        //     throughout the code as needed
        //   - this won't result in errors, only extra copies if a child does
        //     not do an update, is done, and a parent then does an update
        // unref shared map
        this._existing.refs--;
        // copy to new map
        this._existing = {
          refs: 1,
          map: new Map(this._existing.map)
        };
      }
      this._existing.map.set(old, identifier);
    }

    return identifier;
  }

  /**
   * Returns true if the given old identifer has already been assigned a new
   * identifier.
   *
   * @param old the old identifier to check.
   *
   * @return true if the old identifier has been assigned a new identifier,
   *   false if not.
   */
  hasId(old) {
    return this._existing.map.has(old);
  }

  /**
   * Returns all of the IDs that have been issued new IDs in the order in
   * which they were issued new IDs.
   *
   * @return the list of old IDs that has been issued new IDs in order.
   */
  getOldIds() {
    return [...this._existing.map.keys()];
  }
};
