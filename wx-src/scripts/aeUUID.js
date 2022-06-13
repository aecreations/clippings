/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function aeUUID()
{
  let rv;
  
  if (typeof crypto.randomUUID == "function") {
    rv = crypto.randomUUID(); 
  }
  else {
    // Source: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
    rv = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  return rv;
}
