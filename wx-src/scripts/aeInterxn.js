/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let aeInterxn = {
  _isMacOS: null,
  _isNoisyDebug: false,

  init(aOSName)
  {
    this._isMacOS = aOSName == "mac";
  },
  
  initDialogButtonFocusHandlers()
  {
    let btns = document.querySelectorAll(".btn");

    btns?.forEach(aBtn => {
      aBtn.addEventListener("focus", aEvent => {
        document.querySelector("#btn-accept").classList.remove("default");
        btns.forEach(aOtherBtns => {
          aOtherBtns.classList.remove("default");
        });
        aEvent.target.classList.add("default");
      });

      aBtn.addEventListener("blur", aEvent => {
        aEvent.target.classList.remove("default");
        document.querySelector("#btn-accept").classList.add("default");
      });
    });

    let dlgs = document.querySelectorAll(".lightbox");

    dlgs?.forEach(aDlg => {
      let dlgBtns = aDlg.querySelectorAll(".dlg-btn");

      dlgBtns?.forEach(aDlgBtn => {
        aDlgBtn.addEventListener("focus", aEvent => {
          let acceptBtn = aDlg.querySelector(".dlg-accept");
          if (acceptBtn) {
            acceptBtn.classList.remove("default");
            dlgBtns.forEach(aOtherDlgBtns => {
              aOtherDlgBtns.classList.remove("default");
            });
            aEvent.target.classList.add("default");
          }
        });

        aDlgBtn.addEventListener("blur", aEvent => {
          aEvent.target.classList.remove("default");
          let acceptBtn = aDlg.querySelector(".dlg-accept");
          if (acceptBtn) {
            acceptBtn.classList.add("default");
          }
        });
      });
    });
  },

  suppressBrowserShortcuts(aEvent, aIsDebugging)
  {
    if (aIsDebugging && this._isNoisyDebug
        && aEvent.key != "Alt" && aEvent.key != "Control"
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


  initContextMenuAriaRoles(aStor)
  {
    let menu = $(aStor);
    if (menu.length == 0) {
      throw new RangeError(`aeInterxn.initContextMenuAriaRoles(): jQuery selector "${aStor}" does not match one or more elements`);
    }

    menu.attr("role", "menu");
    menu.attr("tabindex", "0");
    menu.children(".context-menu-item").attr("role", "menuitem");
    menu.children(".context-menu-not-selectable").attr("role", "presentation");

    // BUG!!  Submenus aren't selectable. There doesn't appear to be a way to
    // cause the submenu to take the focus, even if "tabindex" is set on
    // the nested <ul> element in the UI code that defines the menu.
    menu.children(".context-menu-submenu").children(".context-menu-list")
      .attr("role", "menu").attr("tabindex", "0")
      .children(".ae-menuitem").attr("role", "menuitem")
      .children(".context-menu-not-selectable").attr("role", "presentation");
  },


  //
  // Private helper methods
  //
  
  _isAccelKeyPressed(aEvent)
  {
    if (typeof this._isMacOS != "boolean") {
      throw new ReferenceError("aeInterxn not initialized");
    }

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
