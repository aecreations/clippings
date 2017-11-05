/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


class aeDialog
{
  constructor(aDlgID)
  {
    this._dlgID = aDlgID;
    this._fnInit = function () {};
    this._fnUnload = function () {};
    this._fnAfterDlgAccept = function () {};
  }

  setInit(aInitFn)
  {
    this._fnInit = aInitFn;
  }

  setUnload(aUnloadFn)
  {
    this._fnUnload = aUnloadFn;
  }

  setAfterAccept(aAfterAcceptFn)
  {
    this._fnAfterDlgAccept = aAfterAcceptFn;
  }
  
  setAccept(aAcceptFn)
  {
    $(`#${this._dlgID} > .dlg-btns > .dlg-accept`).click(aEvent => {
      if (aAcceptFn) {
        aAcceptFn(aEvent);
      }
      else {
        this.close();
      }
      this._fnAfterDlgAccept();
    });
  }

  setCancel(aCancelFn)
  {
    $(`#${this._dlgID} > .dlg-btns > .dlg-cancel`).click(aEvent => {
      if (aCancelFn) {
        aCancelFn(aEvent);
      }
      else {
        this.close();
      }
    });
  }

  showModal()
  {
    this._fnInit();
    $("#lightbox-bkgrd-ovl").addClass("lightbox-show");
    $(`#${this._dlgID}`).addClass("lightbox-show");
  }

  close()
  {
    this._fnUnload();
    $(`#${this._dlgID}`).removeClass("lightbox-show");
    $("#lightbox-bkgrd-ovl").removeClass("lightbox-show");
  }
}
