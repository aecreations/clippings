/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

async function init()
{
  let lang = browser.i18n.getUILanguage();
  document.body.dataset.locale = lang;

  let platform = await browser.runtime.getPlatformInfo();
  document.body.dataset.os = platform.os;
  aeInterxn.init(platform.os);

  let pasteShct = browser.i18n.getMessage("keyCtrl") + "+V";
  if (platform.os == "mac") {
    pasteShct = browser.i18n.getMessage("keyCommand") + "V";
  }

  let txt = document.createTextNode(browser.i18n.getMessage("sbarHlpWhat", pasteShct));
  document.querySelector("#what-is").appendChild(txt);

  document.querySelector("#btn-accept").addEventListener("click", aEvent => { closeDlg() });

  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  let wnd = await browser.windows.getCurrent();
  browser.windows.update(wnd.id, {
    width: wnd.width + 1,
    focused: true,
  });
}


function closeDlg()
{
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}


document.addEventListener("DOMContentLoaded", aEvent => { init() });

document.addEventListener("keydown", aEvent => {
  aeInterxn.suppressBrowserShortcuts(aEvent, aeConst.DEBUG);
});

document.addEventListener("contextmenu", aEvent => { aEvent.preventDefault() });
