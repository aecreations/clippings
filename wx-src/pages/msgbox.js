/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function init()
{
  let url = new URL(window.location.href);
  let msgID = url.searchParams.get("msgid") || aeMsgBox.MSG_UNKNOWN;
  document.querySelector("#msgbox-content > p").textContent = chrome.i18n.getMessage(msgID);

  chrome.history.deleteUrl({ url: url.href });

  let msgIcon = document.getElementById("msgbox-icon");
  if (navigator.platform == "Win32" || navigator.platform == "Win64") {
    msgIcon.setAttribute("os", "win");
  }

  window.addEventListener("keydown", aEvent => {
    if (aEvent.key == "Enter" || aEvent.key == "Escape") {
      dismiss();
    }
    else if (aEvent.key == "/" || aEvent.key == "'") {
      aEvent.preventDefault();  // Suppress quick find in page.
    }
    else if (aEvent.key == "F5") {
      aEvent.preventDefault();  // Suppress browser reload.
    }
  });

  window.addEventListener("contextmenu", aEvent => {
    aEvent.preventDefault();
  });
  
  let btnAccept = document.querySelector("#btn-accept");
  btnAccept.addEventListener("click", aEvent => { dismiss(aEvent) });
  btnAccept.focus();

  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  browser.windows.getCurrent(aWnd => {
    browser.windows.update(aWnd.id, {
      width: aWnd.width + 1,
      focused: true,
    });
  });
}


function dismiss()
{
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}


init();
