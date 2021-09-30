/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function aeVersionCmp(aVer1, aVer2)
{
  if (typeof aVer1 != "string" || typeof aVer2 != "string") {
    return false;
  }

  let v1 = aVer1.split(".");
  let v2 = aVer2.split(".");

  // Last digit may include pre-release suffix, e.g.: a1, b2, rc1
  let vs1 = v1[v1.length - 1].toString();
  let vs2 = v2[v2.length - 1].toString();

  const k = Math.min(v1.length, v2.length);
  
  for (let i = 0; i < k; ++ i) {
    v1[i] = parseInt(v1[i], 10);
    v2[i] = parseInt(v2[i], 10);
    
    if (v1[i] > v2[i]) {
      return 1;
    }
    if (v1[i] < v2[i]) {
      return -1;
    }
  }

  let s1Idx = vs1.search(/[a-z]/);
  let s2Idx = vs2.search(/[a-z]/);

  // E.g.: 6.0 <=> 6.0a1
  if (s1Idx == -1 && s2Idx > 0) {
    return 1;
  }
  // E.g.: 6.0rc1 <=> 6.0
  if (s1Idx > 0 && s2Idx == -1) {
    return -1;
  }
  // E.g.: 6.0b1 <=> 6.0b2
  if (s1Idx > 0 && s2Idx > 0) {
    let s1 = vs1.substr(s1Idx);
    let s2 = vs2.substr(s2Idx);

    if (s1 < s2) {
      return -1;
    }
    if (s1 > s2) {
      return 1;
    }
  }
  
  return (v1.length == v2.length ? 0: (v1.length < v2.length ? -1 : 1));
}
