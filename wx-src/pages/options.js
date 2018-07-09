/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let gClippings;
let gDialogs = {};


// Options page initialization
$(() => {
  chrome.runtime.getBackgroundPage(aBkgrdWnd => {
    gClippings = aBkgrdWnd;

    init();
  });
});


function init()
{
  let os = gClippings.getOS();
  let keybPasteKeys = aeConst.SHORTCUT_KEY_PREFIX;
  
  if (os == "mac") {
    keybPasteKeys = aeConst.SHORTCUT_KEY_PREFIX_MAC;
  }
  $("#enable-shortcut-key-label").text(chrome.i18n.getMessage("prefsShortcutMode", keybPasteKeys));

  initDialogs();
  
  browser.storage.local.get().then(aPrefs => {
    $("#html-paste-options").val(aPrefs.htmlPaste).change(aEvent => {
      setPref({ htmlPaste: aEvent.target.value });
    });
    
    $("#html-auto-line-break").attr("checked", aPrefs.autoLineBreak).click(aEvent => {
      setPref({ autoLineBreak: aEvent.target.checked });
    });

    $("#enable-shortcut-key").attr("checked", aPrefs.keyboardPaste).click(aEvent => {
      setPref({ keyboardPaste: aEvent.target.checked })
    });
    
    $("#auto-inc-plchldrs-start-val").val(aPrefs.autoIncrPlcHldrStartVal).click(aEvent => {
      setPref({ autoIncrPlcHldrStartVal: aEvent.target.valueAsNumber });
    });

    $("#always-save-src-url").attr("checked", aPrefs.alwaysSaveSrcURL).click(aEvent => {
      setPref({ alwaysSaveSrcURL: aEvent.target.checked });
    });

    $("#check-spelling").attr("checked", aPrefs.checkSpelling).click(aEvent => {
      setPref({ checkSpelling: aEvent.target.checked });
    });

    $("#toggle-sync").click(aEvent => {
      gDialogs.syncClippings.showModal();
      //gDialogs.turnOffSync.showModal();
    });

    $("#show-sync-help").click(aEvent => {
      gDialogs.syncClippingsHelp.showModal();
    });
  });
}


function setPref(aPref)
{
  browser.storage.local.set(aPref);
}


function initDialogs()
{
  gDialogs.syncClippings = new aeDialog("#sync-clippings-dlg");
  gDialogs.syncClippings.onInit = () => {
    $("#sync-clippings-dlg .dlg-accept").hide();
    $("#sync-clippings-dlg .dlg-cancel").text(chrome.i18n.getMessage("btnClose"));

    let deck = $("#sync-clippings-dlg > .dlg-content > .deck");
    $(deck[0]).show();
    $(deck[1]).hide();
    $(deck[2]).hide();
    $(deck[3]).hide();
    $(deck[4]).hide();

    // TO DO:
    // Connect to the Sync Clippings native app.
    // If connection is unsuccessful, show error message in deck[1].
    // If connection is successful, then retrieve the current sync location
    // and then switch to deck[3] and populate the sync file location.
    // If the sync file location is NOT set, then switch to deck[4].
    // Any errors reported from helper app should be displayed in deck[2].
  };
  gDialogs.syncClippings.onAccept = () => {
    let that = gDialogs.syncClippings;

    // TO DO: Perform dialog actions.
    
    that.close();
  };

  gDialogs.turnOffSync = new aeDialog("#turn-off-sync-clippings-dlg");
  gDialogs.turnOffSync.onAccept = () => {
    let that = gDialogs.turnOffSync;

    // TO DO: Turn off Sync Clippings.

    that.close();
  };
  
  gDialogs.syncClippingsHelp = new aeDialog("#sync-clippings-help-dlg");

  // Sync Clippings dialog once-only initialization.
  $("#sync-clippings-dlg #change-sync-location").click(aEvent => {
    let deck = $("#sync-clippings-dlg > .dlg-content > .deck");
    $(deck[3]).hide();
    $(deck[4]).fadeIn("slow", "linear");
    $("#sync-clippings-dlg .dlg-accept").show();
    $("#sync-clippings-dlg .dlg-cancel").text(chrome.i18n.getMessage("btnCancel"));
  });
}


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});

