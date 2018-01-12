/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


class aeDialog
{
  constructor(aDlgEltSelector)
  {
    this._dlgEltStor = aDlgEltSelector;
    this._fnInit = function () {};
    this._fnUnload = function () {};
    this._fnAfterDlgAccept = function () {};

    this._fnDlgAccept = function (aEvent) {
      if ($(this._dlgEltStor).hasClass("panel")) {
        this.hidePopup();
      }
      else {
        this.close();
      }
    };
    
    this._fnDlgCancel = function (aEvent) {
      if ($(this._dlgEltStor).hasClass("panel")) {
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

  set onUnload(aFnUnload)
  {
    this._fnUnload = aFnUnload;
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

  showModal()
  {
    this._fnInit();
    $("#lightbox-bkgrd-ovl").addClass("lightbox-show");
    $(`${this._dlgEltStor}`).addClass("lightbox-show");
  }

  close()
  {
    this._fnUnload();
    $(`${this._dlgEltStor}`).removeClass("lightbox-show");
    $("#lightbox-bkgrd-ovl").removeClass("lightbox-show");
  }

  openPopup()
  {
    this._fnInit();
    $("#panel-bkgrd-ovl").addClass("panel-show");
    $(`${this._dlgEltStor}`).addClass("panel-show");
  }

  hidePopup()
  {
    this._fnUnload();
    $(`${this._dlgEltStor}`).removeClass("panel-show");
    $("#panel-bkgrd-ovl").removeClass("panel-show");
  }
  
  static isOpen()
  {
    return ($(".lightbox-show").length > 0);
  }
  
  static acceptDlgs()
  {
    let openDlgElts = $(".lightbox-show");

    if (openDlgElts.length > 0) {
      // Normally there should just be 1 dialog open at a time.
      $(".lightbox-show .dlg-accept:not(:disabled)").click();
    }

    this.hidePopups();
  }

  static cancelDlgs()
  {
    let openDlgElts = $(".lightbox-show");

    if (openDlgElts.length > 0) {
      $(".lightbox-show .dlg-cancel:not(:disabled)").click();
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
