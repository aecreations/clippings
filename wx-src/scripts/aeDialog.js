/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


class aeDialog
{
  constructor(aDlgEltSelector)
  {
    this.HIDE_POPUP_DELAY_MS = 5000;
    this.FOCUSABLE_ELTS_STOR = "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]";
    
    this._dlgElt = $(`${aDlgEltSelector}`);
    this._dlgEltStor = aDlgEltSelector;
    this._isInitialized = false;
    this._fnFirstInit = function () {};
    this._fnInit = function () {};
    this._fnDlgShow = function () {};
    this._fnUnload = function () {};
    this._fnAfterDlgAccept = function () {};
    this._popupTimerID = null;
    this._lastFocusedElt = null;
    this._focusedElt = null;

    this._fnDlgAccept = function (aEvent) {
      if (this.isPopup()) {
        this.hidePopup();
      }
      else {
        this.close();
      }
    };
    
    this._fnDlgCancel = function (aEvent) {
      if (this.isPopup()) {
        this.hidePopup();
      }
      else {
        this.close();
      }
    };

    this._init();
  }

  _init()
  {
    let dlgAcceptElt = $(`${this._dlgEltStor} > .dlg-btns > .dlg-accept`);
    if (dlgAcceptElt.length > 0) {
      dlgAcceptElt.click(aEvent => {
        if (aEvent.target.disabled) {
          return;
        }
        this._fnDlgAccept(aEvent);
        this._fnAfterDlgAccept();
      });
    }

    let dlgCancelElt = $(`${this._dlgEltStor} > .dlg-btns > .dlg-cancel`);
    if (dlgCancelElt.length > 0) {
      dlgCancelElt.click(aEvent => {
        if (aEvent.target.disabled) {
          return;
        }
        this._fnDlgCancel(aEvent);
      });
    }
  }

  set onInit(aFnInit)
  {
    this._fnInit = aFnInit;
  }

  set onFirstInit(aFnInit)
  {
    this._fnFirstInit = aFnInit;
  }

  set onUnload(aFnUnload)
  {
    this._fnUnload = aFnUnload;
  }

  set onShow(aFnShow)
  {
    this._fnDlgShow = aFnShow;
  }
  
  set onAfterAccept(aFnAfterAccept)
  {
    this._fnAfterDlgAccept = aFnAfterAccept;
  }
  
  set onAccept(aFnAccept)
  {
    this._fnDlgAccept = aFnAccept;
  }

  set onCancel(aFnCancel)
  {
    this._fnDlgCancel = aFnCancel;    
  }

  set focusedSelector(aFocusedEltStor)
  {
    this._focusedElt = this._dlgElt.find(aFocusedEltStor)[0];
  }

  find(aEltStor)
  {
    return this._dlgElt.find(aEltStor);
  }

  setProps(aProperties)
  {
    for (let prop in aProperties) {
      this[prop] = aProperties[prop];
    }
  }

  isPopup()
  {
    let rv = this._dlgElt.hasClass("panel");
    return rv;
  }

  showModal(aInitKeyboardNav=true)
  {
    if (! this._isInitialized) {
      this._fnFirstInit();
      this._isInitialized = true;
    }
    
    this._fnInit();

    $("#lightbox-bkgrd-ovl").addClass("lightbox-show");
    this._dlgElt.addClass("lightbox-show");
    this._fnDlgShow();

    if (aInitKeyboardNav) {
      this.initKeyboardNavigation();
    }
  }

  initKeyboardNavigation(aFocusableEltsArray)
  {
    this._lastFocusedElt = document.activeElement;

    let focusableElts = [];
    if (aFocusableEltsArray) {
      focusableElts = aFocusableEltsArray;
    }
    else {
      focusableElts = $(`${this.FOCUSABLE_ELTS_STOR}`, this._dlgElt).toArray();
    }
    
    let firstTabStop = focusableElts[0];
    let lastTabStop = focusableElts[focusableElts.length - 1];

    this._dlgElt.on("keydown.aeDialog", aEvent => {
      if (aEvent.key == "Tab") {
        if (aEvent.shiftKey) {
          if (document.activeElement == firstTabStop) {
            aEvent.preventDefault();
            lastTabStop.focus();
          }
        }
        else {
          if (document.activeElement == lastTabStop) {
            aEvent.preventDefault();
            firstTabStop.focus();
          }
        }
      }
    });

    if (this._focusedElt) {
      this._focusedElt.focus();
    }
    else {
      firstTabStop.focus();
    }
  }

  changeKeyboardNavigableElts(aFocusableEltsArray)
  {
    let firstTabStop = aFocusableEltsArray[0];
    let lastTabStop = aFocusableEltsArray[aFocusableEltsArray.length - 1];

    this._dlgElt.on("keydown.aeDialog", aEvent => {
      if (aEvent.key == "Tab") {
        if (aEvent.shiftKey) {
          if (document.activeElement == firstTabStop) {
            aEvent.preventDefault();
            lastTabStop.focus();
          }
        }
        else {
          if (document.activeElement == lastTabStop) {
            aEvent.preventDefault();
            firstTabStop.focus();
          }
        }
      }
    });

    firstTabStop.focus();
  }

  close()
  {
    this._dlgElt.off("keydown.aeDialog");

    this._fnUnload();
    this._dlgElt.removeClass("lightbox-show");
    $("#lightbox-bkgrd-ovl").removeClass("lightbox-show");

    this._lastFocusedElt?.focus();
    this._lastFocusedElt = null;
  }

  openPopup()
  {
    if (this._popupTimerID) {
      window.clearTimeout(this._popupTimerID);
      this._popupTimerID = null;
    }

    this._fnInit();

    let popupElt = $(`${this._dlgEltStor}`);
    $("#panel-bkgrd-ovl").addClass("panel-show");
    popupElt.addClass("panel-show");

    // Auto-close after a few second's delay.
    this._popupTimerID = window.setTimeout(() => {
      this.hidePopup();
    }, this.HIDE_POPUP_DELAY_MS);
  }

  hidePopup()
  {
    let popupElt = $(`${this._dlgEltStor}`);

    if (popupElt.hasClass("panel-show")) {
      this._fnUnload();
      popupElt.removeClass("panel-show");
      $("#panel-bkgrd-ovl").removeClass("panel-show");

      window.clearTimeout(this._popupTimerID);
      this._popupTimerID = null;
    }
  }

  isAcceptOnly()
  {
    let dlgAcceptElt = $(`${this._dlgEltStor} > .dlg-btns > .dlg-accept`);
    let dlgCancelElt = $(`${this._dlgEltStor} > .dlg-btns > .dlg-cancel`);
    
    return (dlgCancelElt.length == 0 && dlgAcceptElt.length > 0);
  }
  
  static isOpen()
  {
    return ($(".lightbox.lightbox-show").length > 0);
  }
  
  static acceptDlgs()
  {
    let openDlgElts = $(".lightbox.lightbox-show");

    if (openDlgElts.length > 0) {
      // Normally there should just be 1 dialog open at a time.
      $(".lightbox.lightbox-show .dlg-accept:not(:disabled)").click();
    }

    this.hidePopups();
  }

  static cancelDlgs()
  {
    let openDlgElts = $(".lightbox.lightbox-show");

    if (openDlgElts.length > 0) {
      // Normally there should just be 1 dialog open at a time.
      let cancelBtnElt = $(".lightbox.lightbox-show .dlg-cancel:not(:disabled)");
      if (cancelBtnElt.length > 0) {
        cancelBtnElt.click();
      }
      else {
        // Dialog only has an OK, Close or Done button.
        $(".lightbox.lightbox-show .dlg-accept").click();
      }
    }

    this.hidePopups();
  }

  static hidePopups()
  {
    let openPopupPanelElts = $(".panel");

    if (openPopupPanelElts.length > 0) {
      $(".panel").removeClass("panel-show");
      $("#panel-bkgrd-ovl").removeClass("panel-show");
    }
  }
}
