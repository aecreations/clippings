/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let gBrowserTabID, gClippingContent;


// Dialog initialization
$(async () => {
  let platform = await browser.runtime.getPlatformInfo();
  document.body.dataset.os = gOS = platform.os;
  aeInterxn.init(platform.os);

  let lang = browser.i18n.getUILanguage();
  document.body.dataset.locale = lang;

  let params = new URLSearchParams(window.location.search);
  gBrowserTabID = Number(params.get("tabID"));

  let resp = await browser.runtime.sendMessage({
    msgID: "init-paste-as-dlg"
  });

  gClippingContent = resp.content;

  $("#clipping-name").text(resp.clippingName);
  $("#paste-cliptxt-html, #paste-cliptxt-plain, #paste-cliptxt-plain-html").on("click", aEvent => {
    pasteClipping(aEvent.target.id);
  });
  $("#btn-cancel").on("click", aEvent => { cancel() });

  $("#paste-cliptxt-html").focus();

  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  let wnd = await browser.windows.getCurrent();
  browser.windows.update(wnd.id, {
    width: wnd.width + 1,
    focused: true,
  });
});


function pasteClipping(aButtonID)
{
  let pasteFormat;
  if (aButtonID == "paste-cliptxt-html") {
    pasteFormat = aeConst.HTMLPASTE_AS_FORMATTED;
  }
  else if (aButtonID == "paste-cliptxt-plain-html") {
    pasteFormat = aeConst.HTMLPASTE_AS_IS;
  }
  else {
    pasteFormat = aeConst.HTMLPASTE_AS_PLAIN;    
  }

  browser.runtime.sendMessage({
    msgID: "paste-clipping-usr-fmt",
    processedContent: gClippingContent,
    browserTabID: gBrowserTabID,
    pasteFormat,
  });

  closeDlg();
}


function cancel(aEvent)
{
  closeDlg();
}


async function closeDlg()
{
  await browser.runtime.sendMessage({msgID: "close-paste-as-dlg"});
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}


//
// Event handlers
//

$(window).on("keydown", aEvent => {
  if (aEvent.key == "Escape") {
    closeDlg();
  }
  // Accelerator keys on paste option buttons
  else if (aEvent.key.toUpperCase() == "F") {
    $("#paste-cliptxt-html")[0].click();
  }
  else if (aEvent.key.toUpperCase() == "C") {
    $("#paste-cliptxt-plain")[0].click();
  }
  else if (aEvent.key.toUpperCase() == "H") {
    $("#paste-cliptxt-plain-html")[0].click();
  }
  else {
    aeInterxn.suppressBrowserShortcuts(aEvent);
  }
});


$(window).on("contextmenu", aEvent => {
  aEvent.preventDefault();
});
