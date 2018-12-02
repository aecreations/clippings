/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let gClippings;
let gDialogs = {};
let gIsActivatingSyncClippings = false;
let gExtInfo = null;


// DOM utility
function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, { SAFE_FOR_JQUERY: true });
}


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

  if (os == "mac") {
    $("#shortcut-key-prefix-modifiers").text("\u21e7\u2318");
  }
  else {
    let keyAlt = chrome.i18n.getMessage("keyAlt");
    let keyShift = chrome.i18n.getMessage("keyShift");
    $("#shortcut-key-prefix-modifiers").text(`${keyAlt} + ${keyShift} + `);
  }

  $("#shortcut-key-note").html(sanitizeHTML(chrome.i18n.getMessage("prefsShortcutKeyNote")));
  $("#sync-intro").html(sanitizeHTML(chrome.i18n.getMessage("syncIntro")));

  initDialogs();

  $("#toggle-sync").click(aEvent => {
    browser.storage.local.get().then(aPrefs => {
      if (aPrefs.syncClippings) {
        gDialogs.turnOffSync.showModal();
      }
      else {
	gIsActivatingSyncClippings = true;
        gDialogs.syncClippings.showModal();
      }
    });
  });

  $(".hyperlink").click(aEvent => {
    aEvent.preventDefault();
    gotoURL(aEvent.target.href);
  });

  $("#about-btn").click(aEvent => {
    gDialogs.about.showModal();
  });
  
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

    let currShortcut = "";
    if (aPrefs.pasteShortcutKeyPrefix) {
      currShortcut = aPrefs.pasteShortcutKeyPrefix;
    }
    else {
      let extManifest = chrome.runtime.getManifest();
      let suggKey = extManifest.commands["ae-clippings-paste-clipping"]["suggested_key"];

      if (os == "mac") {
        currShortcut = suggKey["mac"];
      }
      else {
        currShortcut = suggKey["default"];
      }
    }
    
    $("#shortcut-key-selector").val(currShortcut.split("+")[2]).change(aEvent => {
      let modifierKeys = os == "mac" ? "Command+Shift" : "Alt+Shift"
      setPref({ pasteShortcutKeyPrefix: `${modifierKeys}+${aEvent.target.value}` });
      browser.commands.update({
        name: "ae-clippings-paste-clipping",
        shortcut: `${modifierKeys}+${aEvent.target.value}`,
      });
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

    $("#backup-reminder").prop("checked", (aPrefs.backupRemFrequency != aeConst.BACKUP_REMIND_NEVER)).click(aEvent => {
      if (aEvent.target.checked) {
        $("#backup-reminder-freq").prop("disabled", false);
        setPref({
          backupRemFrequency: Number($("#backup-reminder-freq").val()),
          backupRemFirstRun: false,
          lastBackupRemDate: new Date().toString(),
        });
      }
      else {
        $("#backup-reminder-freq").prop("disabled", true);
        setPref({ backupRemFrequency: aeConst.BACKUP_REMIND_NEVER });
      }

      gClippings.clearBackupNotificationInterval();
    });

    if (aPrefs.backupRemFrequency == aeConst.BACKUP_REMIND_NEVER) {
      // Set to default interval.
      $("#backup-reminder-freq").val(aeConst.BACKUP_REMIND_WEEKLY).prop("disabled", true);
    }
    else {
      $("#backup-reminder-freq").val(aPrefs.backupRemFrequency);
    }
    
    $("#backup-reminder-freq").change(aEvent => {
      setPref({
        backupRemFrequency: Number(aEvent.target.value),
        backupRemFirstRun: false,
        lastBackupRemDate: new Date().toString(),
      });

      gClippings.clearBackupNotificationInterval();
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
/***
    $("#browse-sync-fldr").click(aEvent => {
      let msg = { msgID: "sync-dir-folder-picker" };
      let sendNativeMsg = browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);

      sendNativeMsg.then(aResp => {
	if (aResp.syncFilePath) {
	  $("#sync-fldr-curr-location").val(aResp.syncFilePath);
	}
      }).catch(aErr => {
	window.alert("The Sync Clippings helper app responded with an error.\n\n" + aErr);
      });
    });
***/
    
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

    let msg = { msgID: "get-app-version" };
    let sendNativeMsg = browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
    sendNativeMsg.then(aResp => {
      console.info("Sync Clippings helper app version: " + aResp.appVersion);

      $(deck[0]).hide();
      $(deck[3]).show();
      $("#sync-clippings-dlg .dlg-accept").show();
      $("#sync-clippings-dlg .dlg-cancel").text(chrome.i18n.getMessage("btnCancel"));

      let msg = { msgID: "get-sync-dir" };
      return browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
      
    }).then(aResp => {     
      $("#sync-fldr-curr-location").val(aResp.syncFilePath).focus().select();
      
    }).catch(aErr => {
      console.error("Clippings/wx::options.js: Error returned from syncClippings native app: " + aErr);

      $(deck[0]).hide();
      if (aErr == aeConst.SYNC_ERROR_CONXN_FAILED) {
        // This would occur if Sync Clippings helper app won't start.
        $(deck[1]).show();
      }
      else if (aErr == aeConst.SYNC_ERROR_UNKNOWN) {
        $(deck[2]).show();
        $("#sync-err-detail").text("Sorry, no further information on this error is available.");
      }
      else {
        $(deck[2]).show();
        $("#sync-err-detail").text(aErr);
      }
    });
  };
  gDialogs.syncClippings.onAccept = () => {
    let that = gDialogs.syncClippings;

    let syncFldrPath = $("#sync-fldr-curr-location").val();
    if (! syncFldrPath) {
      $("#sync-fldr-curr-location").focus();
      return;
    }

    let msg = {
      msgID: "set-sync-dir",
      filePath: syncFldrPath
    };
    log("Sending message 'set-sync-dir' with params:");
    log(msg);

    let setSyncFilePath = browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
    setSyncFilePath.then(aResp => {
      log("Received response to 'set-sync-dir':");
      log(aResp);

      if (aResp.status == "ok") {
        gClippings.enableSyncClippings(true).then(aSyncFldrID => {
	  if (gIsActivatingSyncClippings) {
            // Don't do the following if Sync Clippings was already turned on
            // and no changes to settings were made.
            setPref({ syncClippings: true });
            $("#sync-settings").show();
            $("#toggle-sync").text(chrome.i18n.getMessage("syncTurnOff"));
            $("#sync-status").text(chrome.i18n.getMessage("syncStatusOn"));

	    gIsActivatingSyncClippings = false;
	  }

          gClippings.refreshSyncedClippings();  // Asynchronous function.
          
	  let syncClippingsListeners = gClippings.getSyncClippingsListeners().getListeners();
	  for (let listener of syncClippingsListeners) {
	    listener.onActivate(aSyncFldrID);
	  }
	  
	  that.close();
        });
      }
      else {
        window.alert(`The Sync Clippings helper app responded with an error.\n\nStatus: ${aResp.status}\nDetails: ${aResp.details}`);
        that.close();
      }     
    }).catch(aErr => {
      console.error(aErr);
    });
  };

  // Dialog UI strings
  let os = gClippings.getOS();
  if (os == "win") {
    $("#example-sync-path").text(chrome.i18n.getMessage("syncFileDirExWin"));
  }
  else if (os == "mac") {
    $("#example-sync-path").text(chrome.i18n.getMessage("syncFileDirExMac"));
  }
  else {
    $("#example-sync-path").text(chrome.i18n.getMessage("syncFileDirExLinux"));
  }
  $("#sync-conxn-error-detail").html(sanitizeHTML(chrome.i18n.getMessage("errSyncConxnDetail")));

  gDialogs.turnOffSync = new aeDialog("#turn-off-sync-clippings-dlg");
  gDialogs.turnOffSync.onAccept = () => {
    let that = gDialogs.turnOffSync;
    that.close();

    gClippings.enableSyncClippings(false).then(aOldSyncFldrID => {
      setPref({ syncClippings: false });
      $("#sync-settings").hide();
      $("#toggle-sync").text(chrome.i18n.getMessage("syncTurnOn"));
      $("#sync-status").text(chrome.i18n.getMessage("syncStatusOff"));

      let syncClippingsListeners = gClippings.getSyncClippingsListeners().getListeners();
      for (let listener of syncClippingsListeners) {
	listener.onDeactivate(aOldSyncFldrID);
      }

      gDialogs.turnOffSyncAck.showModal();
    });
  };

  gDialogs.turnOffSyncAck = new aeDialog("#turn-off-sync-clippings-ack-dlg");
  gDialogs.turnOffSyncAck.onInit = () => {
    $("#delete-sync-fldr").prop("checked", true);
  };
  gDialogs.turnOffSyncAck.onAfterAccept = () => {
    let removeSyncFldr = $("#delete-sync-fldr").prop("checked");
    let syncClippingsListeners = gClippings.getSyncClippingsListeners().getListeners();

    for (let listener of syncClippingsListeners) {
      listener.onAfterDeactivate(removeSyncFldr);
    }
  };

  gDialogs.about = new aeDialog("#about-dlg");
  gDialogs.about.onInit = () => {
    let diagDeck = $("#about-dlg > .dlg-content #diag-info .deck");
    diagDeck.children("#sync-diag-loading").show();
    diagDeck.children("#sync-diag").hide();
    $("#about-dlg > .dlg-content #diag-info #sync-diag-detail").hide();
    $("#about-dlg > .dlg-content #diag-info #sync-file-size").text("");

    if (! gExtInfo) {
      let extManifest = chrome.runtime.getManifest();
      gExtInfo = {
        name: extManifest.name,
        version: extManifest.version,
        description: extManifest.description,
      };
    }

    $("#about-dlg > .dlg-content #ext-name").text(gExtInfo.name);
    $("#about-dlg > .dlg-content #ext-ver").text(chrome.i18n.getMessage("aboutExtVer", gExtInfo.version));
    $("#about-dlg > .dlg-content #ext-desc").text(gExtInfo.description);
  };
  gDialogs.about.onShow = () => {
    let msg = { msgID: "get-app-version" };
    let sendNativeMsg = browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
    sendNativeMsg.then(aResp => {
      $("#about-dlg > .dlg-content #diag-info #sync-ver").text(aResp.appVersion);     
      return browser.storage.local.get();

    }).then(aPrefs => {
      if (aPrefs.syncClippings) {
        let msg = { msgID: "get-sync-file-info" };
        return browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
      }
      else {
        return null;
      }
    }).then(aResp => {
      if (aResp) {
        let syncFileSize;
        if (aResp.fileSizeKB == "") {
          // Sync Clippings is turned on, but sync file is not yet created.
          syncFileSize = "-";
        }
        else {
          syncFileSize = `${aResp.fileSizeKB} KiB`;
        }
        $("#about-dlg > .dlg-content #diag-info #about-sync-status").hide();
        $("#about-dlg > .dlg-content #diag-info #sync-file-size-label").show();
        $("#about-dlg > .dlg-content #diag-info #sync-file-size").text(syncFileSize);
      }
      else {
        // Sync Clippings is inactive.
        $("#about-dlg > .dlg-content #diag-info #sync-file-size-label").hide();
        $("#about-dlg > .dlg-content #diag-info #about-sync-status").text(chrome.i18n.getMessage("syncStatusOff")).show();
      }
      
      $("#about-dlg > .dlg-content #diag-info #sync-diag-detail").show();

    }).catch(aErr => {
      // Native app is not installed.
      log("Clippings/wx: About dialog: Error returned from native app: " + aErr);
      $("#about-dlg > .dlg-content #diag-info #sync-ver").text(chrome.i18n.getMessage("noSyncHelperApp"));
      
    }).finally(() => {
      let diagDeck = $("#about-dlg > .dlg-content #diag-info .deck");
      diagDeck.children("#sync-diag-loading").hide();
      diagDeck.children("#sync-diag").show();
    });
  };
  
  gDialogs.syncClippingsHelp = new aeDialog("#sync-clippings-help-dlg");

  // Sync Clippings help dialog content.
  $("#sync-clippings-help-dlg > .dlg-content").html(sanitizeHTML(chrome.i18n.getMessage("syncHelp")));
}


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


function gotoURL(aURL)
{
  chrome.tabs.create({ url: aURL });
}


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
