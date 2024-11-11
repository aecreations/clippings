/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MSG_UNKNOWN = "msgUnknown";
const DEFAULT_WND_HEIGHT = 170;
const MSG_BODY_DEFAULT_HEIGHT = 40;


async function init()
{
  let url = new URL(window.location.href);
  let msgID = url.searchParams.get("msgid") || MSG_UNKNOWN;
  let msgBody = document.querySelector("#msgbox-content > p");
  msgBody.textContent = browser.i18n.getMessage(msgID);

  let compStyles = window.getComputedStyle(msgBody);
  let msgBodyHeight = parseInt(compStyles.getPropertyValue("height"));
  if (msgBodyHeight > MSG_BODY_DEFAULT_HEIGHT) {
    let height = DEFAULT_WND_HEIGHT + (msgBodyHeight - MSG_BODY_DEFAULT_HEIGHT);
    await browser.windows.update(browser.windows.WINDOW_ID_CURRENT, {height});
  }

  let platform = await browser.runtime.getPlatformInfo();
  document.body.dataset.os = platform.os;
  aeInterxn.init(platform.os);

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
  let wnd = await browser.windows.getCurrent();
  browser.windows.update(wnd.id, {
    width: wnd.width + 1,
    focused: true,
  });
}


function dismiss()
{
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}


document.addEventListener("DOMContentLoaded", async (aEvent) => { init() });

document.addEventListener("keydown", aEvent => {
  aeInterxn.suppressBrowserShortcuts(aEvent, false);
});

document.addEventListener("contextmenu", aEvent => { aEvent.preventDefault() });
