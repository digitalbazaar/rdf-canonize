/*********************************************************************
 * rdf-canonize MessageDigest for Node.js.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc.
 *
 * BSD License
 * <https://github.com/digitalbazaar/rdf-canonize/blob/master/LICENSE>
 ********************************************************************/

#include "MessageDigest.h"
#include <cstring>

using namespace std;
using namespace RdfCanonize;

static string _bytesToHex(const char* bytes, unsigned length);

MessageDigest::MessageDigest(const char* algorithm) : hashFn(NULL) {
  EVP_MD_CTX_init(&context);

  if(strcmp(algorithm, "sha256") == 0) {
    hashFn = EVP_sha256();
  } else {
    // TODO: throw error -- should never happen
  }

  if(hashFn != NULL) {
    // initialize the message digest context (NULL uses the default engine)
    EVP_DigestInit_ex(&context, hashFn, NULL);
  }
}

MessageDigest::~MessageDigest() {
  EVP_MD_CTX_cleanup(&context);
}

void MessageDigest::update(const char& c) {
  if(hashFn != NULL) {
    EVP_DigestUpdate(&context, &c, 1);
  }
}

void MessageDigest::update(const string& msg) {
  if(hashFn != NULL) {
    EVP_DigestUpdate(&context, msg.c_str(), msg.size());
  }
}

string MessageDigest::digest() {
  if(hashFn == NULL) {
    return "error";
  }

  // get hash
  unsigned length = EVP_MD_size(hashFn);
  char hash[length];
  EVP_DigestFinal_ex(&context, (unsigned char*)hash, &length);

  // TODO: return bytes instead of hex
  // convert hash to hexadecimal
  return _bytesToHex(hash, length);
}

// initialize hexadecimal characters strings for fast lookups
static const char* HEX_CHARS = "0123456789abcdef";

static string _bytesToHex(const char* bytes, unsigned length) {
  char hex[length * 2 + 1];
  char* ptr = hex;
  unsigned char* ubytes = (unsigned char*)bytes;
  for(unsigned i = 0; i < length; ++i, ptr += 2) {
    // hexadecimal uses 2 digits, each with 16 values (or 4 bits):
    // convert the top 4 bits
    ptr[0] = HEX_CHARS[(ubytes[i] >> 4)];
    // convert the bottom 4 bits
    ptr[1] = HEX_CHARS[(ubytes[i] & 0x0f)];
  }
  ptr[0] = 0;

  return hex;
}
