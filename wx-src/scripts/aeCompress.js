/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let aeCompress = {
  // Adapted from "How to use the JavaScript Compression Streams API to
  // (de)compress strings"
  // <https://evanhahn.com/javascript-compression-streams-api-with-strings/>
  async decompress(aCompressedBytes)
  {
    let stream = new Blob([aCompressedBytes]).stream();
    let decompressedStrm = stream.pipeThrough(new DecompressionStream("gzip"));
    let chunks = [];
    for await (let chunk of decompressedStrm) {
      chunks.push(chunk);
    }

    let stringBytes = await this._concatUint8Arrays(chunks);
    return new TextDecoder().decode(stringBytes);
  },


  // Utility function
  base64ToBytes(aBase64Data) {
    let binString = atob(aBase64Data);
    return Uint8Array.from(binString, (aChar) => aChar.codePointAt(0));
  },
  

  // Private helper
  async _concatUint8Arrays(aUInt8Arrays)
  {
    let blob = new Blob(aUInt8Arrays);
    let buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }
};
