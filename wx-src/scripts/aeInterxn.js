/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let aeInterxn = {
  _isMacOS: window.navigator.oscpu.search(/mac/i) != -1,
  
  suppressBrowserShortcuts(aEvent, aIsDebugging)
  {
    if (aIsDebugging && aEvent.key != "Alt" && aEvent.key != "Control"
	&& aEvent.key != "Meta" && aEvent.key != "Shift") {
      console.log(`Clippings/wx::aeInterxn.suppressBrowserShortcuts():\nkey = ${aEvent.key}\ncode = ${aEvent.code}\naltKey = ${aEvent.altKey}\nctrlKey = ${aEvent.ctrlKey}\nmetaKey = ${aEvent.metaKey}\nshiftKey = ${aEvent.shiftKey}`);
    }
    
    if (aEvent.key == "/" || aEvent.key == "'") {
      if (! this._isTextboxFocused(aEvent)) {
	aEvent.preventDefault();
      }
    }
    else if (["F3", "F5"].includes(aEvent.key) || (aEvent.key == "Home" && aEvent.altKey)) {
      aEvent.preventDefault();
    }
    else if (aEvent.key == "F12" && !aIsDebugging) {
      aEvent.preventDefault();
    }
    else if (aEvent.key.toUpperCase() == "A" && this._isAccelKeyPressed(aEvent)) {
      if (! this._isTextboxFocused(aEvent)) {
	aEvent.preventDefault();
      }
    }
    else {
      // Ignore most standard browser shortcuts.
      // BUG!! This won't catch window shortcuts (CTRL+N, CTRL+T, CTRL+SHIFT+P)
      let key = aEvent.key.toUpperCase();
      if (this._isAccelKeyPressed(aEvent)
          && ["D","E","F","G","I","J","K","N","O","P","R","S","T","U","Y","^"].includes(key)) {
	aEvent.preventDefault();
      }
      // Ignore shortcuts for web developer tools on macOS.
      else if (aEvent.altKey && this._isAccelKeyPressed(aEvent)
	       && ["Ç", "´", "µ", "^", "˚", "Ω"].includes(key)) {
	aEvent.preventDefault();
      }
      else if (aEvent.shiftKey && ["F5", "F7", "F9", "F12"].includes(key)) {
	aEvent.preventDefault();
      }
    }
  },


  //
  // Private helper methods
  //
  
  _isAccelKeyPressed(aEvent)
  {
    let rv = aEvent.ctrlKey;
    if (this._isMacOS) {
      rv = aEvent.metaKey;
    }
    
    return rv;
  },

  _isTextboxFocused(aEvent)
  {
    return (aEvent.target.tagName == "INPUT" || aEvent.target.tagName == "TEXTAREA");
  }
};
