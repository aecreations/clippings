/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class aePermReqInfo
{
  constructor()
  {
    this._extPerm = null;
    this._execActionID = null;
  }


  set(aExtPermission, aExecActionID)
  {
    this._extPerm = aExtPermission;
    this._execActionID = aExecActionID;
  }

  get()
  {
    let rv = {
      extPerm: this._extPerm,
      execActionID: this._execActionID,
    };
    return rv;
  }

  clear()
  {
    this._extPerm = null;
    this._execActionID = null;
  }
}
