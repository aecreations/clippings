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


function init()
{
  let url = new URL(window.location.href);
  let msgID = url.searchParams.get("msgid") || aeMsgBox.MSG_UNKNOWN;
  document.querySelector("#msgbox-content > p").textContent = aeMsgBox.msg[msgID];

  window.addEventListener("keypress", aEvent => {
    if (aEvent.key == "Enter" || aEvent.key == "Escape") {
      dismiss();
    }
  });
  
  let btnAccept = document.querySelector("#btn-accept");
  btnAccept.addEventListener("click", aEvent => { dismiss(aEvent) });
  btnAccept.focus();
}


function dismiss()
{
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}


init();
