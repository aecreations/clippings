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

  if (os == "mac") {
    $("#shortcut-key-prefix-modifiers").text("\u21e7\u2318");
  }
  else {
    let keyAlt = chrome.i18n.getMessage("keyAlt");
    let keyShift = chrome.i18n.getMessage("keyShift");
    $("#shortcut-key-prefix-modifiers").text(`${keyAlt} + ${keyShift} + `);
  }

  let shortcutKeyNoteHTML = DOMPurify.sanitize(chrome.i18n.getMessage("prefsShortcutKeyNote"), { SAFE_FOR_JQUERY: true });
  $("#shortcut-key-note").html(shortcutKeyNoteHTML);

  initDialogs();

  $("#toggle-sync").click(aEvent => {
    browser.storage.local.get().then(aPrefs => {
      if (aPrefs.syncClippings) {
        gDialogs.turnOffSync.showModal();
      }
      else {
        gDialogs.syncClippings.showModal();
      }
    });
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

    $("#backup-reminder-freq").val(aPrefs.backupRemFrequency).change(aEvent => {
      setPref({
        backupRemFrequency: Number(aEvent.target.value),
        backupRemFirstRun: false,
        lastBackupRemDate: new Date().toString(),
      });

      gClippings.clearBackupNotificationInterval();
      if (aEvent.target.value != aeConst.BACKUP_REMIND_NEVER) {
        gClippings.setBackupNotificationInterval();
      }
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
      if (aErr == "Error: Attempt to postMessage on disconnected port") {
        // This would occur if Sync Clippings helper app won't start.
        $(deck[1]).show();
      }
      else if (aErr == "Error: undefined") {
        $(deck[2]).show();
        $("#sync-err-detail").text("An unknown error was returned. Make sure that the Sync Clippings native app is running using Python 3.");
      }
      else {
        $(deck[2]).show();
        $("#sync-err-detail").text(aErr);
      }
    });
  };
  gDialogs.syncClippings.onAccept = () => {
    let that = gDialogs.syncClippings;

    let msg = {
      msgID: "set-sync-dir",
      filePath: $("#sync-fldr-curr-location").val()
    };
    log("Sending message 'set-sync-dir' with params:");
    log(msg);

    let setSyncFilePath = browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
    setSyncFilePath.then(aResp => {
      log("Received response to 'set-sync-dir':");
      log(aResp);

      if (aResp.status == "ok") {
        gClippings.enableSyncClippings(true).then(() => {
          setPref({ syncClippings: true });

          gClippings.refreshSyncedClippings();  // Asynchronous function.

          $("#sync-settings").show();
          $("#toggle-sync").text(chrome.i18n.getMessage("syncTurnOff"));
          $("#sync-status").text(chrome.i18n.getMessage("syncStatusOn"));

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

  gDialogs.turnOffSync = new aeDialog("#turn-off-sync-clippings-dlg");
  gDialogs.turnOffSync.onAccept = () => {
    let that = gDialogs.turnOffSync;

    gClippings.enableSyncClippings(false).then(() => {
      setPref({ syncClippings: false });
      $("#sync-settings").hide();
      $("#toggle-sync").text(chrome.i18n.getMessage("syncTurnOn"));
      $("#sync-status").text(chrome.i18n.getMessage("syncStatusOff"));

      that.close();
    });
  };
  
  gDialogs.syncClippingsHelp = new aeDialog("#sync-clippings-help-dlg");
}


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
