/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function init()
{
  let url = new URL(window.location.href);
  let msgID = url.searchParams.get("msgid") || aeMsgBox.MSG_UNKNOWN;
  document.querySelector("#msgbox-content > p").textContent = aeMsgBox.msg[msgID];

  chrome.history.deleteUrl({ url: url.href });

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
