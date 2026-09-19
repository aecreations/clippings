/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


let gExtPermStrKeys = {
  clipboardRead: "extPrmClipbdR",
  clipboardWrite: "extPrmClipbdW",
};

let gWndID, gTabID, gOpenerWndID, gExtPerm, gExecActionID;


// Page initialization
$(async () => {
  let platform = await browser.runtime.getPlatformInfo();
  document.body.dataset.os = platform.os;

  let lang = browser.i18n.getUILanguage();
  document.body.dataset.locale = lang;

  let params = new URLSearchParams(window.location.search);
  gOpenerWndID = params.get("openerWndID");

  await populateRequestedPermission();
  $("#perm-hlp-link").attr("href", aeConst.PERM_HLP_URL);

  let wnd = await browser.windows.getCurrent();
  browser.windows.update(wnd.id, {focused: true});
  gWndID = wnd.id;

  let tab = await browser.tabs.getCurrent();
  gTabID = tab.id;

  $(".hyperlink").on("click", aEvent => {
    aEvent.preventDefault();
    browser.tabs.create({url: aEvent.target.href});
  });

});


async function populateRequestedPermission()
{
  let resp = await browser.runtime.sendMessage({
    msgID: "get-perm-req-key",
    opener: gOpenerWndID,
  });
  gExtPerm = resp.extPerm;
  gExecActionID = resp.execActionID;

  let strKey = gExtPermStrKeys[gExtPerm];
  let strKeyDesc = `${strKey}Desc`;
  $("#ext-perm").text(browser.i18n.getMessage(strKey));
  $("#ext-perm-desc").text(browser.i18n.getMessage(strKeyDesc));
}


async function requestPermission() {
  $("#dlg-btns > button").prop("disabled", true);
  let permGranted = await browser.permissions.request({
    permissions: [gExtPerm],
  });

  if (permGranted) {
    await focusOpenerWnd(gExecActionID);
    closePage();
  }
  else {
    $("#dlg-btns > button").prop("disabled", false);
  }
}


async function focusOpenerWnd(aExecActionID)
{
  let msg = {
    msgID: "focus-ext-window",
    wndID: gOpenerWndID
  };

  if (aExecActionID) {
    msg.execActionMsgID = aExecActionID;
  }
  
  try {
    await browser.runtime.sendMessage(msg);
  }
  catch (e) {
    // Opener window was closed
  }
}


function closePage()
{
  browser.tabs.remove(gTabID);
}


//
// Event handlers
//

$("#dlg-accept").on("click", async (aEvent) => {
  await requestPermission();
});

$("#dlg-cancel").on("click", async (aEvent) => {
  await focusOpenerWnd();
  closePage();
});

$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


$(window).on("keydown", async aEvent => {
  if (aEvent.key == "Enter") {
    if (aEvent.target.tagName == "BUTTON" && aEvent.target.id != "btn-accept"
        && !aEvent.target.classList.contains("dlg-accept")) {
      aEvent.target.click();
    }
    else {
      if (aEvent.target.id != "btn-accept") {
        await requestPermission();
      }
    }
  }
  else if (aEvent.key == "Escape") {
    await focusOpenerWnd();
    closePage();
  }
});


browser.runtime.onMessage.addListener(aRequest => {
  let resp;
  
  if (aRequest.msgID == "ping-perms-req-pg") {
    resp = {
      isOpen: true,
      wndID: gWndID,
      tabID: gTabID,
    };
  }
  else if (aRequest.msgID == "reload-perms-req-pg") {
    // Update the opener window ID, since invoking the permissions page again
    // from a different source window will cancel the pending permission
    // request.
    gOpenerWndID = aRequest.openerWndID;

    populateRequestedPermission();
    browser.windows.update(gWndID, {focused: true});
    browser.tabs.update(gTabID, {active: true});
  }

  if (resp) {
    return Promise.resolve(resp);
  }
});


//
// Utilities
//

function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, {SAFE_FOR_JQUERY: true});
}


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
