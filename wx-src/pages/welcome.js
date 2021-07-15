/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// Page initialization
$(async () => {
  let pgURL = new URL(window.location.href);

  browser.history.deleteUrl({ url: pgURL.href });

  let platform = await browser.runtime.getPlatformInfo();
  document.body.dataset.os = platform.os;
  
  $("#goto-whatsnew").click(aEvent => {
    window.location.href = "http://aecreations.sourceforge.net/clippings/whatsnew.php";
  });
  
  $("#goto-quick-start").click(aEvent => {
    window.location.href = "http://aecreations.sourceforge.net/clippings/quickstart.php";
  });

  $("#dismiss-welcome").click(aEvent => {
    showModal("#dismiss-welcome-dlg");
  });

  $("#link-website").attr("href", aeConst.HELP_URL);
  $("#link-blog").attr("href", aeConst.BLOG_URL);
  $("#link-forum").attr("href", aeConst.FORUM_URL);
  
  initDialogs();
});


$(window).keydown(aEvent => {
  aeInterxn.suppressBrowserShortcuts(aEvent, false);
});


// Suppress browser's context menu.
$(document).on("contextmenu", aEvent => { aEvent.preventDefault() });


function initDialogs()
{
  $("#dismiss-welcome-dlg .dlg-accept").click(aEvent => {
    closePage();
  });

  $("#dismiss-welcome-dlg .dlg-cancel").click(aEvent => {
    $("#dismiss-welcome-dlg").removeClass("lightbox-show");    
    $("#lightbox-bkgrd-ovl").hide();
  });
}


function showModal(aDlgEltSelector)
{
  $("#lightbox-bkgrd-ovl").show();
  $(aDlgEltSelector).addClass("lightbox-show");
}


function closePage()
{
  browser.tabs.getCurrent().then(aTab => {
    return browser.tabs.remove(aTab.id);
  }).catch(aErr => {
    console.error("Clippings/wx: welcome.js: " + aErr);
  });
}
