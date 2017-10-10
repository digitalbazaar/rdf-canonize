{
  "targets": [
    {
      "target_name": "urdna2015",
      "sources": [
        "lib/native/addon.cc",
        "lib/native/urdna2015.cc"
      ],
      "include_dirs": ["<!(node -e \"require('nan')\")"],
      "cflags": [
        "-Wno-maybe-uninitialized",
        "-std=c++11"
      ]
    }
  ]
}
