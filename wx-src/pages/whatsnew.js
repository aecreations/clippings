/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let gWndID, gTabID;


// Page initialization
$(async () => {
  let extInfo = browser.runtime.getManifest();
  let extVer = aeMozVersion.getMozVersion(extInfo.version);
  $("#latest-ver").text(browser.i18n.getMessage("upgrade", extInfo.name));
  $("#ver-subhead").text(browser.i18n.getMessage("aboutExtVer", extVer));
  let contribCTA = browser.i18n.getMessage("contribCTA", [extInfo.name, aeConst.DONATE_URL, aeConst.CONTRIB_URL]);
  $("#contrib-cta").html(sanitizeHTML(contribCTA));

  let hostAppName = browser.i18n.getMessage("hostAppFx");
  $("#hostapp-compat").text(browser.i18n.getMessage("hostAppCompat", hostAppName));
  $("#whats-new-sync").html(sanitizeHTML(browser.i18n.getMessage("whatsNewSync", aeConst.SYNC_CLIPPINGS_DWNLD_URL)));
  
  $("#link-website > a").attr("href", extInfo.homepage_url);
  $("#link-amo > a").attr("href", aeConst.AMO_URL);
  $("#link-blog > a").attr("href", aeConst.BLOG_URL);
  $("#link-forum > a").attr("href", aeConst.FORUM_URL);

  $("#btn-close").on("click", async (aEvent) => { closePage() });

  $("a").click(aEvent => {
    aEvent.preventDefault();
    gotoURL(aEvent.target.href);
  });

  let [currWnd, tabs] = await Promise.all([
    browser.windows.getCurrent(),
    browser.tabs.query({active: true, currentWindow: true}),
  ]);
  gWndID = currWnd.id;
  gTabID = tabs[0].id;

  browser.runtime.sendMessage({msgID: "whats-new-pg-opened"});
});


function gotoURL(aURL)
{
  browser.tabs.create({url: aURL});
}


async function closePage()
{
  let tab = await browser.tabs.getCurrent();
  browser.tabs.remove(tab.id);
}


function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, {SAFE_FOR_JQUERY: true});
}


browser.runtime.onMessage.addListener(aRequest => {
  if (aRequest.msgID == "ping-whats-new-pg") {
    let resp = {
      wndID: gWndID,
      tabID: gTabID,
    };
    return Promise.resolve(resp);
  }
});


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.getAttribute("type") != "text") {
    aEvent.preventDefault();
  }
});
