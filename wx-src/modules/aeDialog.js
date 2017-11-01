/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


class aeDialog
{
  constructor(aDlgID)
  {
    this._dlgID = aDlgID;
    this._initFn = function () {};
    this._unloadFn = function () {};
    this._afterDlgAcceptFn = function () {};
  }

  setInit(aInitFn)
  {
    this._initFn = aInitFn;
  }

  setUnload(aUnloadFn)
  {
    this._unloadFn = aUnloadFn;
  }

  setAfterAccept(aAfterAcceptFn)
  {
    this._afterDlgAcceptFn = aAfterAcceptFn;
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
      this._afterDlgAcceptFn();
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
    this._initFn();
    $("#lightbox-bkgrd-ovl").addClass("lightbox-show");
    $(`#${this._dlgID}`).addClass("lightbox-show");
  }

  close()
  {
    this._unloadFn();
    $(`#${this._dlgID}`).removeClass("lightbox-show");
    $("#lightbox-bkgrd-ovl").removeClass("lightbox-show");
  }
}
