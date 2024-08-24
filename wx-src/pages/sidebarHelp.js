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

  initKeyboardShortcutTable(platform.os);

  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  let wnd = await browser.windows.getCurrent();
  browser.windows.update(wnd.id, {
    width: wnd.width + 1,
    focused: true,
  });
}


function initKeyboardShortcutTable(aOSName)
{
  const isMacOS = aOSName == "mac";

  function buildKeyMapTable(aTableDOMElt)
  {
    let shctKeys = [];
    if (isMacOS) {
      shctKeys = ["F1", "\u2318C"];
    }
    else {
      shctKeys = ["F1", `${browser.i18n.getMessage("keyCtrl")}+C`];
    }

    function buildKeyMapTableRow(aShctKey, aCmdL10nStrIdx)
    {
      let tr = document.createElement("tr");
      let tdKey = document.createElement("td");
      let tdCmd = document.createElement("td");
      tdKey.appendChild(document.createTextNode(aShctKey));
      tdCmd.appendChild(document.createTextNode(browser.i18n.getMessage(aCmdL10nStrIdx)));
      tr.appendChild(tdKey);
      tr.appendChild(tdCmd);

      return tr;
    }

    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[0], "sbarHlpTitle"));
    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[1], "mnuCopyClipTxt"));
  }
 
  let shctKeyTbls = document.querySelectorAll(".shortcut-key-tbl");

  for (let tbl of shctKeyTbls) {
    buildKeyMapTable(tbl);
  }
}


function closeDlg()
{
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}


document.addEventListener("DOMContentLoaded", aEvent => { init() });

document.addEventListener("keydown", aEvent => {
  if (aEvent.key == "Enter" || aEvent.key == "Escape") {
    closeDlg();
  }
  else {
    aeInterxn.suppressBrowserShortcuts(aEvent, aeConst.DEBUG);
  }
});

document.addEventListener("contextmenu", aEvent => { aEvent.preventDefault() });
