/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// Page initialization
$(async () => {
  let pgURL = new URL(window.location.href);

  let platform = await browser.runtime.getPlatformInfo();
  document.body.dataset.os = platform.os;
  aeInterxn.init(platform.os);

  let lang = browser.i18n.getUILanguage();
  document.body.dataset.locale = lang;
  
  $("#goto-whatsnew").click(aEvent => {
    gotoURL(aeConst.WHATSNEW_URL);
  });
  
  $("#goto-quick-start").click(aEvent => {
    gotoURL(aeConst.QUICKSTART_URL);
  });

  $("#dismiss-welcome").click(aEvent => { closePage() });

  $("#link-website > a").attr("href", aeConst.HELP_URL);
  $("#link-blog > a").attr("href", aeConst.BLOG_URL);
  $("#link-forum > a").attr("href", aeConst.FORUM_URL);

  $("a").click(aEvent => {
    aEvent.preventDefault();
    gotoURL(aEvent.target.href);
  });
});


function gotoURL(aURL)
{
  browser.tabs.create({ url: aURL });
}


function closePage()
{
  browser.tabs.getCurrent().then(aTab => {
    browser.tabs.remove(aTab.id);
  });
}


$(window).keydown(aEvent => {
  aeInterxn.suppressBrowserShortcuts(aEvent, false);
});


// Suppress browser's context menu.
$(document).on("contextmenu", aEvent => { aEvent.preventDefault() });
