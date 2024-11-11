/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let aeNavigator = {
  TARGET_NEW_WINDOW: 1,
  TARGET_NEW_TAB: 2,
  WND_MAX_WIDTH: 1000,
  WND_MAX_HEIGHT: 720,
  
  _openerWndID: null,

  
  init(aOpenerWndID)
  {
    if (aOpenerWndID === null || aOpenerWndID === undefined) {
      throw new ReferenceError("aOpenerWndID is invalid");
    }
    
    aOpenerWndID = Number(aOpenerWndID);
    if (Number.isNaN(aOpenerWndID)) {
      throw new TypeError("aOpenerWndID is not a Number");
    }
    
    this._openerWndID = aOpenerWndID;
  },

  async gotoURL(aURL, aTarget=this.TARGET_NEW_WINDOW)
  {
    if (this._openerWndID === null) {
      throw new ReferenceError("_openerWndID not defined");
    }

    if (aTarget == this.TARGET_NEW_TAB) {
      browser.tabs.create({url: aURL});
    }
    else {
      try {
	let openerWnd = await browser.windows.get(this._openerWndID);
	browser.windows.create({
          url: aURL,
          type: "normal",
          state: "normal",
          width: openerWnd.width,
          height: openerWnd.height,
	});
      }
      catch (e) {
	browser.windows.create({
          url: aURL,
          type: "normal",
          state: "normal",
          width: this.WND_MAX_WIDTH,
          height: this.WND_MAX_HEIGHT,
	});
      }
    }
  },  
};
