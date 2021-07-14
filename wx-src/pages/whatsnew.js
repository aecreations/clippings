/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, { SAFE_FOR_JQUERY: true });
}


// Page initialization
$(async () => {
  browser.history.deleteUrl({ url: window.location.href });

  let extInfo = browser.runtime.getManifest();
  let contribCTA = browser.i18n.getMessage("contribCTA", [extInfo.name, aeConst.DONATE_URL, aeConst.CONTRIB_URL]);
  $("#contrib-cta").html(sanitizeHTML(contribCTA));
  
  $("#link-website").attr("href", extInfo.homepage_url);
  $("#link-amo").attr("href", aeConst.AMO_URL);
  $("#link-blog").attr("href", aeConst.BLOG_URL);
  $("#link-forum").attr("href", aeConst.FORUM_URL);

  $("#btn-close").on("click", async (aEvent) => { closePage() }); 
});


async function closePage()
{
  let tab = await browser.tabs.getCurrent();
  browser.tabs.remove(tab.id);
}


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.getAttribute("type") != "text") {
    aEvent.preventDefault();
  }
});
