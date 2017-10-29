/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Clippings.
 *
 * The Initial Developer of the Original Code is 
 * Alex Eng <ateng@users.sourceforge.net>.
 * Portions created by the Initial Developer are Copyright (C) 2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

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
