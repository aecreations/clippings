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

    if (aPrefs.syncClippings) {
      $("#sync-settings").show();
      $("#sync-status").text(chrome.i18n.getMessage("syncStatusOn"));
      $("#toggle-sync").text(chrome.i18n.getMessage("syncTurnOff"));
    }
    else {
      $("#sync-settings").hide();
      $("#sync-status").text(chrome.i18n.getMessage("syncStatusOff"));
      $("#toggle-sync").text(chrome.i18n.getMessage("syncTurnOn"));
    }

    $("#sync-settings").click(aEvent => {
      gDialogs.syncClippings.showModal();
    });
    
    $("#toggle-sync").click(aEvent => {
      if (aPrefs.syncClippings) {
        gDialogs.turnOffSync.showModal();
      }
      else {
        gDialogs.syncClippings.showModal();
      }
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
    $("#sync-err-detail").text("");
    
    let deck = $("#sync-clippings-dlg > .dlg-content > .deck");
    $(deck[0]).show();
    $(deck[1]).hide();
    $(deck[2]).hide();
    $(deck[3]).hide();

    console.log("Clippings/wx::options.js: Sending message 'get-app-version' to the syncClippings native app...");
    let msg = { msgID: "get-app-version" };
    let sendNativeMsg = browser.runtime.sendNativeMessage("syncClippings", msg);
    sendNativeMsg.then(aResp => {
      console.log("Clippings/wx::options.js: Response received from syncClippings native app:");
      console.log(aResp);

      $(deck[0]).hide();
      $(deck[3]).show();
      // TO DO: Populate the sync file location.
      
    }).catch(aErr => {
      console.error("Clippings/wx::options.js: Error returned from syncClippings native app: " + aErr);

      $(deck[0]).hide();
      if (aErr == "Error: Attempt to postMessage on disconnected port") {
        // This would occur if Sync Clippings helper app won't start.
        $(deck[1]).show();
      }
      else {
        $(deck[2]).show();
        $("#sync-err-detail").text(aErr);
      }
    });
  };
  gDialogs.syncClippings.onAccept = () => {
    let that = gDialogs.syncClippings;

    // TO DO: Perform dialog actions.

    setPref({ syncClippings: true });
    
    that.close();
  };

  gDialogs.turnOffSync = new aeDialog("#turn-off-sync-clippings-dlg");
  gDialogs.turnOffSync.onAccept = () => {
    let that = gDialogs.turnOffSync;

    setPref({ syncClippings: false });
    
    // Update extension prefs UI to turn off Sync Clippings.
    $("#sync-settings").hide();
    $("#toggle-sync").text(chrome.i18n.getMessage("syncTurnOn"));
    $("#sync-status").text(chrome.i18n.getMessage("syncStatusOff"));

    that.close();
  };
  
  gDialogs.syncClippingsHelp = new aeDialog("#sync-clippings-help-dlg");

  // TO DO: Repurpose the code below for showing the OK and Cancel dialog buttons.
  // The rest of it can be removed.
  $("#sync-clippings-dlg #change-sync-location").click(aEvent => {
    let deck = $("#sync-clippings-dlg > .dlg-content > .deck");
    $(deck[3]).hide();
    $(deck[4]).fadeIn("slow", "linear");
    $("#sync-clippings-dlg .dlg-accept").show();
    $("#sync-clippings-dlg .dlg-cancel").text(chrome.i18n.getMessage("btnCancel"));
  });
  // END TO DO
}


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});

