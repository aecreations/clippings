/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// Page initialization
$(async () => {
  browser.history.deleteUrl({ url: window.location.href });

  let donateCTA = $("#donate-cta");
  donateCTA.append(browser.i18n.getMessage("donateCta1"));
  donateCTA.append("\u00a0");
  donateCTA.append(
    $(document.createElement("a")).attr("href", aeConst.DONATE_URL)
      .attr("target", "_blank")
      .text(browser.i18n.getMessage("donateLink"))
  );
  donateCTA.append(browser.i18n.getMessage("donateCta2"));
  
  let extInfo = browser.runtime.getManifest();
  $("#link-website").attr("href", extInfo.homepage_url);
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
