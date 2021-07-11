/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


async function init()
{
  browser.history.deleteUrl({ url: window.location.href });

  let donateCTA = $("#donate-cta");
  donateCTA.append(browser.i18n.getMessage("donateCta1"));
  donateCTA.append("\u00a0");
  donateCTA.append(createHyperlink("donateLink", aeConst.DONATE_URL));
  donateCTA.append(browser.i18n.getMessage("donateCta2"));
  
  let extInfo = browser.runtime.getManifest();
  $("#link-website").append(createHyperlink("linkWebsite", extInfo.homepage_url));
  $("#link-blog").append(createHyperlink("linkBlog", aeConst.BLOG_URL));
  $("#link-forum").append(createHyperlink("linkForum", aeConst.FORUM_URL));
  
  $("#btn-close").on("click", async (aEvent) => { closePage() }); 
}


async function closePage()
{
  let tab = await browser.tabs.getCurrent();
  browser.tabs.remove(tab.id);
}


function createHyperlink(aStringKey, aURL)
{
  let rv = document.createElement("a");
  rv.setAttribute("href", aURL);
  rv.setAttribute("target", "_blank");
  let text = document.createTextNode(browser.i18n.getMessage(aStringKey));
  rv.appendChild(text);
  return rv;
}


document.addEventListener("DOMContentLoaded", async (aEvent) => { init() });

document.addEventListener("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.getAttribute("type") != "text") {
    aEvent.preventDefault();
  }
});
