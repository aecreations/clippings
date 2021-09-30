/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let gOS;
let gClippings;
let gDialogs = {};
let gIsActivatingSyncClippings = false;


// DOM utility
function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, { SAFE_FOR_JQUERY: true });
}

function capitalize(aString)
{
  let rv;

  if (typeof aString != "string") {
    throw new TypeError("Not a string");
  }
  else if (! aString) {
    rv = "";
  }
  else if (aString.length == 1) {
    rv = aString.toUpperCase();
  }
  else {
    rv = aString[0].toUpperCase().concat(aString.substring(1));
  }

  return rv;
}


// Options page initialization
$(async () => {
  gClippings = await browser.runtime.getBackgroundPage();

  if (! gClippings) {
    // Hide the broken "Turn Off Sync" button when Private Browsing turned on.
    $("#toggle-sync").hide();
    
    window.alert(browser.i18n.getMessage("errPrefPgFailed"));
    await closePage();
    return;
  }

  init();
});


async function init()
{
  let platform = await browser.runtime.getPlatformInfo();
  document.body.dataset.os = gOS = platform.os;

  if (gOS == "mac") {
    $("#shortcut-key-prefix-modifiers").text("\u21e7\u2318");
  }
  else {
    let keyAlt = browser.i18n.getMessage("keyAlt");
    let keyShift = browser.i18n.getMessage("keyShift");
    $("#shortcut-key-prefix-modifiers").text(`${keyAlt} + ${keyShift} + `);
  }

  let lang = browser.i18n.getUILanguage();
  document.body.dataset.locale = lang;

  $("#sync-intro").html(sanitizeHTML(browser.i18n.getMessage("syncIntro")));

  initDialogs();

  $("#toggle-sync").click(async (aEvent) => {
    let syncClippings = await aePrefs.getPref("syncClippings");
    if (syncClippings) {
      gDialogs.turnOffSync.showModal();
    }
    else {
      gIsActivatingSyncClippings = true;
      gDialogs.syncClippings.showModal();
    }
  });

  $("#about-btn").click(aEvent => {
    gDialogs.about.showModal();
  });

  let usrContribCTA = $("#usr-contrib-cta");
  usrContribCTA.append(sanitizeHTML(`<label id="usr-contrib-cta-hdg">${browser.i18n.getMessage("aboutContribHdg")}</label>&nbsp;`));
  usrContribCTA.append(sanitizeHTML(`<a href="${aeConst.DONATE_URL}" class="hyperlink">${browser.i18n.getMessage("aboutDonate")}</a>&nbsp;`));
  usrContribCTA.append(sanitizeHTML(`<label id="usr-contrib-cta-conj">${browser.i18n.getMessage("aboutContribConj")}</label>`));
  usrContribCTA.append(sanitizeHTML(`<a href="${aeConst.L10N_URL}" class="hyperlink">${browser.i18n.getMessage("aboutL10n")}</a>`));
  
  let prefs = await aePrefs.getAllPrefs();
  $("#html-paste-options").val(prefs.htmlPaste).change(aEvent => {
    aePrefs.setPrefs({ htmlPaste: aEvent.target.value });
  });
  
  $("#html-auto-line-break").attr("checked", prefs.autoLineBreak).click(aEvent => {
    aePrefs.setPrefs({ autoLineBreak: aEvent.target.checked });
  });

  $("#enable-shortcut-key").attr("checked", prefs.keyboardPaste).click(aEvent => {
    aePrefs.setPrefs({ keyboardPaste: aEvent.target.checked })
  });

  $("#auto-inc-plchldrs-start-val").val(prefs.autoIncrPlcHldrStartVal).click(aEvent => {
    aePrefs.setPrefs({ autoIncrPlcHldrStartVal: aEvent.target.valueAsNumber });
  });

  $("#always-save-src-url").attr("checked", prefs.alwaysSaveSrcURL).click(aEvent => {
    aePrefs.setPrefs({ alwaysSaveSrcURL: aEvent.target.checked });
  });

  $("#check-spelling").attr("checked", prefs.checkSpelling).click(aEvent => {
    aePrefs.setPrefs({ checkSpelling: aEvent.target.checked });
  });

  $("#backup-filename-with-date").attr("checked", prefs.backupFilenameWithDate).click(aEvent => {
    aePrefs.setPrefs({ backupFilenameWithDate: aEvent.target.checked });
  });

  $("#backup-reminder").attr("checked", (prefs.backupRemFrequency != aeConst.BACKUP_REMIND_NEVER)).click(async (aEvent) => {
    if (aEvent.target.checked) {
      $("#backup-reminder-freq").prop("disabled", false);
      $("#skip-backup-if-no-chg").prop("disabled", false);
      $("#skip-backup-label").removeAttr("disabled");
      await aePrefs.setPrefs({
        backupRemFrequency: Number($("#backup-reminder-freq").val()),
        backupRemFirstRun: false,
        lastBackupRemDate: new Date().toString(),
      });
    }
    else {
      $("#backup-reminder-freq").prop("disabled", true);
      $("#skip-backup-if-no-chg").prop("disabled", true);
      $("#skip-backup-label").attr("disabled", true);
      await aePrefs.setPrefs({ backupRemFrequency: aeConst.BACKUP_REMIND_NEVER });
    }

    await browser.runtime.sendMessage({msgID: "clear-backup-notifcn-intv"});
    if (aEvent.target.checked) {
      browser.runtime.sendMessage({msgID: "set-backup-notifcn-intv"});
    }
  });

  if (prefs.backupRemFrequency == aeConst.BACKUP_REMIND_NEVER) {
    // Set to default interval.
    $("#backup-reminder-freq").val(aeConst.BACKUP_REMIND_WEEKLY).prop("disabled", true);
  }
  else {
    $("#backup-reminder-freq").val(prefs.backupRemFrequency);
  }
  
  $("#backup-reminder-freq").change(async (aEvent) => {
    await aePrefs.setPrefs({
      backupRemFrequency: Number(aEvent.target.value),
      backupRemFirstRun: false,
      lastBackupRemDate: new Date().toString(),
    });

    await browser.runtime.sendMessage({msgID: "clear-backup-notifcn-intv"});
    browser.runtime.sendMessage({msgID: "set-backup-notifcn-intv"});
  });   

  $("#skip-backup-if-no-chg").attr("checked", prefs.skipBackupRemIfUnchg).click(aEvent => {
    aePrefs.setPrefs({skipBackupRemIfUnchg: aEvent.target.checked});
  });

  $("#wnds-dlgs-settings").on("click", aEvent => {
    gDialogs.wndsDlgsOpts.showModal();
  });

  if (prefs.syncClippings) {
    $("#sync-settings").show();
    $("#sync-status").addClass("sync-status-on").text(browser.i18n.getMessage("syncStatusOn"));
    $("#toggle-sync").text(browser.i18n.getMessage("syncTurnOff"));
  }
  else {
    $("#sync-settings").hide();
    $("#sync-status").text(browser.i18n.getMessage("syncStatusOff"));
    $("#toggle-sync").text(browser.i18n.getMessage("syncTurnOn"));
  }

  $("#sync-settings").click(aEvent => {
    gDialogs.syncClippings.showModal();
  });

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
  
  $("#show-sync-help").click(aEvent => {
    gDialogs.syncClippingsHelp.showModal();
  });

  let cmds = await browser.commands.getAll();

  let keybShct = cmds[0].shortcut;
  let shctArr = keybShct.split("+");
  let key, keyModifiers = "";
  let isSupportedKey = false;
  let isSupportedKeyMod = false;

  if (shctArr.length > 1) {
    keyModifiers = keybShct.substring(0, keybShct.lastIndexOf("+"));
  }
  key = shctArr[shctArr.length - 1];

  if (gOS == "mac") {
    if (keyModifiers == "Command+Shift") {
      isSupportedKeyMod = true;
    }
  }
  else {
    if (keyModifiers == "Alt+Shift") {
      isSupportedKeyMod = true;
    }
  }

  let keySelectElt = $("#shortcut-key-selector")[0];
  let allKeys = keySelectElt.options;
  
  for (let i = 0; i < allKeys.length; i++) {
    if (allKeys[i].value == key) {
      keySelectElt.selectedIndex = i;
      isSupportedKey = true;
      break;
    }
  }

  if (!isSupportedKey || !isSupportedKeyMod) {
    // When the keyboard shortcut is not any of the combinations that can be
    // set from the extension preferences page, it may have been set from
    // Manage Extension Shortcuts in Add-ons Manager (Firefox 66+).
    $("#shortcut-key-note").text(browser.i18n.getMessage("prefsOutsideShct"));

    let keybPasteKeys = await browser.runtime.sendMessage({msgID: "get-shct-key-prefix-ui-str"});
    $("#shortcut-key-prefix-modifiers").text(keybPasteKeys);
  }
  else {
    $("#shortcut-key-note").html(sanitizeHTML(browser.i18n.getMessage("prefsShortcutKeyNote")));
    keySelectElt.style.display = "inline-block";

    $(keySelectElt).change(aEvent => {
      let modifierKeys = gOS == "mac" ? "Command+Shift" : "Alt+Shift"
      let keybShct = `${modifierKeys}+${aEvent.target.value}`;

      log("Clippings/wx::options.js: Keyboard shortcut changed. Updating command with new keyboard shortcut: " + keybShct);
      
      browser.commands.update({
        name: aeConst.CMD_CLIPPINGS_KEYBOARD_PASTE,
        shortcut: keybShct,
      });
    });
  }

  $(".hyperlink").click(aEvent => {
    aEvent.preventDefault();
    gotoURL(aEvent.target.href);
  });
}


$(window).keydown(aEvent => {
  if (aEvent.key == "Enter" && aeDialog.isOpen()) {
    aeDialog.acceptDlgs();

    // Don't trigger any further actions that would have occurred if the
    // ENTER key was pressed.
    aEvent.preventDefault();
  }
  else if (aEvent.key == "Escape" && aeDialog.isOpen()) {
    aeDialog.cancelDlgs();
  }
  else {
    aeInterxn.suppressBrowserShortcuts(aEvent, aeConst.DEBUG);
  }
});


function initDialogs()
{
  gDialogs.syncClippings = new aeDialog("#sync-clippings-dlg");
  gDialogs.syncClippings.oldShowSyncItemsOpt = null;
  gDialogs.syncClippings.isCanceled = false;
  gDialogs.syncClippings.onInit = () => {
    gDialogs.syncClippings.isCanceled = false;
    $("#sync-clippings-dlg .dlg-accept").hide();
    $("#sync-clippings-dlg .dlg-cancel").text(browser.i18n.getMessage("btnCancel"));
    $("#sync-err-detail").text("");
    
    let deckSyncChk = $("#sync-connection-check");
    let deckSyncConxnError = $("#sync-cxn-error");
    let deckSyncError = $("#generic-error");
    let deckSyncSettings = $("#sync-folder-location");

    deckSyncChk.show();
    deckSyncConxnError.hide();
    deckSyncError.hide();
    deckSyncSettings.hide();

    let lang = browser.i18n.getUILanguage();
    let msg = { msgID: "get-app-version" };
    let sendNativeMsg = browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);

    sendNativeMsg.then(aResp => {
      console.info("Sync Clippings helper app version: " + aResp.appVersion);

      if (aeVersionCmp(aResp.appVersion, "1.2b1") < 0) {
        $("#browse-sync-fldr").hide();
      }
      
      return aePrefs.getAllPrefs();

    }).then(aPrefs => {
      $("#sync-helper-app-update-check").prop("checked", aPrefs.syncHelperCheckUpdates);
      $("#show-only-sync-items").prop("checked", aPrefs.cxtMenuSyncItemsOnly);

      gDialogs.syncClippings.oldShowSyncItemsOpt = $("#show-only-sync-items").prop("checked");
      let msg = { msgID: "get-sync-dir" };
      return browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
      
    }).then(aResp => {
      $("#sync-clippings-dlg .dlg-accept").show();
      $("#sync-clippings-dlg .dlg-cancel").text(browser.i18n.getMessage("btnCancel"));

      deckSyncChk.hide();
      deckSyncSettings.show();
      $("#sync-fldr-curr-location").val(aResp.syncFilePath).focus().select();

    }).catch(aErr => {
      console.error("Clippings/wx::options.js: Error returned from syncClippings native app: " + aErr);
      
      $("#sync-clippings-dlg .dlg-cancel").text(browser.i18n.getMessage("btnClose"));

      if (aErr == aeConst.SYNC_ERROR_CONXN_FAILED) {
        // This would occur if Sync Clippings helper app won't start.
        deckSyncChk.hide();
        deckSyncConxnError.show();
      }
      else if (aErr == aeConst.SYNC_ERROR_UNKNOWN) {
        deckSyncChk.hide();
        deckSyncSettings.hide();
        deckSyncError.show();
        $("#sync-err-detail").text(browser.i18n.getMessage("errNoDetails"));
      }
      else {
        deckSyncChk.hide();
        deckSyncSettings.hide();
        deckSyncError.show();
        $("#sync-err-detail").text(browser.i18n.getMessage("errSyncOptsInit"));
      }
    });
  };
  gDialogs.syncClippings.onAccept = () => {
    let that = gDialogs.syncClippings;

    let syncFldrPath = $("#sync-fldr-curr-location").val();

    // Sanitize the sync folder path value.
    syncFldrPath = syncFldrPath.trim();
    syncFldrPath = syncFldrPath.replace(/\"/g, "");
    
    if (! syncFldrPath) {
      $("#sync-fldr-curr-location").focus();
      return;
    }

    aePrefs.setPrefs({
      syncHelperCheckUpdates: $("#sync-helper-app-update-check").prop("checked"),
      cxtMenuSyncItemsOnly: $("#show-only-sync-items").prop("checked"),
    });

    let rebuildClippingsMenu = $("#show-only-sync-items").prop("checked") != gDialogs.syncClippings.oldShowSyncItemsOpt;

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
            aePrefs.setPrefs({
              syncClippings: true,
              clippingsMgrShowSyncItemsOnlyRem: true,
            });
            $("#sync-settings").show();
            $("#toggle-sync").text(browser.i18n.getMessage("syncTurnOff"));
            $("#sync-status").addClass("sync-status-on").text(browser.i18n.getMessage("syncStatusOn"));

	    gIsActivatingSyncClippings = false;
	  }

          gClippings.refreshSyncedClippings(rebuildClippingsMenu);  // Asynchronous function.
          
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
  gDialogs.syncClippings.onUnload = () => {
    $("#sync-clippings-dlg").css({ height: "256px" });
    gDialogs.syncClippings.isCanceled = true;
  };

  // Dialog UI strings
  if (gOS == "win") {
    $("#example-sync-path").text(browser.i18n.getMessage("syncFileDirExWin"));
  }
  else if (gOS == "mac") {
    $("#example-sync-path").text(browser.i18n.getMessage("syncFileDirExMac"));
  }
  else {
    $("#example-sync-path").text(browser.i18n.getMessage("syncFileDirExLinux"));
  }
  $("#sync-conxn-error-detail").html(sanitizeHTML(browser.i18n.getMessage("errSyncConxnDetail")));

  gDialogs.turnOffSync = new aeDialog("#turn-off-sync-clippings-dlg");
  $("#turn-off-sync-clippings-dlg > .dlg-btns > .dlg-btn-yes").click(aEvent => {
    let that = gDialogs.turnOffSync;
    that.close();

    gClippings.enableSyncClippings(false).then(aOldSyncFldrID => {
      aePrefs.setPrefs({ syncClippings: false });
      $("#sync-settings").hide();
      $("#toggle-sync").text(browser.i18n.getMessage("syncTurnOn"));
      $("#sync-status").removeClass("sync-status-on").text(browser.i18n.getMessage("syncStatusOff"));

      let syncClippingsListeners = gClippings.getSyncClippingsListeners().getListeners();
      for (let listener of syncClippingsListeners) {
	listener.onDeactivate(aOldSyncFldrID);
      }

      gDialogs.turnOffSyncAck.oldSyncFldrID = aOldSyncFldrID;
      gDialogs.turnOffSyncAck.showModal();
    });
  });

  gDialogs.turnOffSyncAck = new aeDialog("#turn-off-sync-clippings-ack-dlg");
  gDialogs.turnOffSyncAck.oldSyncFldrID = null;
  gDialogs.turnOffSyncAck.onInit = () => {
    $("#delete-sync-fldr").prop("checked", true);
  };
  gDialogs.turnOffSyncAck.onAfterAccept = () => {
    let that = gDialogs.turnOffSyncAck;
    let removeSyncFldr = $("#delete-sync-fldr").prop("checked");
    let syncClippingsListeners = gClippings.getSyncClippingsListeners().getListeners();

    for (let listener of syncClippingsListeners) {
      listener.onAfterDeactivate(removeSyncFldr, that.oldSyncFldrID);
    }
  };

  gDialogs.wndsDlgsOpts = new aeDialog("#wnds-dlgs-opts-dlg");
  gDialogs.wndsDlgsOpts.isInitialized = false;
  gDialogs.wndsDlgsOpts.resetClpMgrWndPos = false;
  gDialogs.wndsDlgsOpts.onInit = async function ()
  {
    if (! this.isInitialized) {
      if (gOS != "win") {
        let os = gOS == "mac" ? browser.i18n.getMessage("macOS") : capitalize(gOS);
        $("#wnds-dlgs-opts-dlg").css({height: "320px"});
        $("#wnds-dlgs-opts-exp-warn-msg").text(browser.i18n.getMessage("wndsDlgsOptsExpWarn", os));
        $("#wnds-dlgs-opts-exp-warn").show();
      }

      $("#clpmgr-save-wnd-pos").on("click", aEvent => {
        $("#reset-clpmgr-wnd-pos").prop("disabled", !aEvent.target.checked);
      });

      $("#reset-clpmgr-wnd-pos").on("click", aEvent => {
        this.resetClpMgrWndPos = true;
        $("#reset-clpmgr-wnd-pos-ack").css({visibility: "visible"});
      });

      this.isInitialized = true;
    }

    let prefs = await aePrefs.getAllPrefs();
    $("#auto-pos-wnds").prop("checked", prefs.autoAdjustWndPos);
    $("#clpmgr-save-wnd-pos").prop("checked", prefs.clippingsMgrSaveWndGeom);
    $("#reset-clpmgr-wnd-pos").prop("disabled", !$("#clpmgr-save-wnd-pos").prop("checked"));
  };
  gDialogs.wndsDlgsOpts.onAccept = async function (aEvent)
  {
    let autoAdjustWndPos = $("#auto-pos-wnds").prop("checked");
    let clippingsMgrSaveWndGeom = $("#clpmgr-save-wnd-pos").prop("checked");
    await aePrefs.setPrefs({autoAdjustWndPos, clippingsMgrSaveWndGeom});
   
    let isClippingsMgrOpen;
    try {
      isClippingsMgrOpen = await browser.runtime.sendMessage({msgID: "ping-clippings-mgr"});
    }
    catch (e) {}

    if (isClippingsMgrOpen) {
      let saveWndGeom = this.resetClpMgrWndPos ? false : clippingsMgrSaveWndGeom;
      await browser.runtime.sendMessage({
        msgID: "toggle-save-clipman-wnd-geom",
        saveWndGeom,
      });

      if (! saveWndGeom) {
        await this._purgeSavedClpMgrWndGeom();
      }
    }
    else {
      if (this.resetClpMgrWndPos || !clippingsMgrSaveWndGeom) {
        await this._purgeSavedClpMgrWndGeom();
      }
    }

    this.close();
  };
  gDialogs.wndsDlgsOpts._purgeSavedClpMgrWndGeom = async function ()
  {   
    await aePrefs.setPrefs({
      clippingsMgrWndGeom: null,
      clippingsMgrTreeWidth: null,
    });
  };
  gDialogs.wndsDlgsOpts.onUnload = function ()
  {
    this.resetClpMgrWndPos = false;
    $("#reset-clpmgr-wnd-pos").prop("disabled", false);
    $("#reset-clpmgr-wnd-pos-ack").css({visibility: "hidden"});
  };

  gDialogs.about = new aeDialog("#about-dlg");
  gDialogs.about.extInfo = null;
  gDialogs.about.onInit = () => {
    let that = gDialogs.about;
    
    let diagDeck = $("#about-dlg > .dlg-content #diag-info .deck");
    diagDeck.children("#sync-diag-loading").show();
    diagDeck.children("#sync-diag").hide();
    $("#about-dlg > .dlg-content #diag-info #sync-diag-detail").hide();
    $("#about-dlg > .dlg-content #diag-info #sync-file-size").text("");

    if (! that.extInfo) {
      let extManifest = browser.runtime.getManifest();
      that.extInfo = {
        name: extManifest.name,
        version: extManifest.version,
        description: extManifest.description,
        homePgURL: extManifest.homepage_url,
      };
    }

    $("#about-dlg > .dlg-content #ext-name").text(that.extInfo.name);
    $("#about-dlg > .dlg-content #ext-ver").text(browser.i18n.getMessage("aboutExtVer", that.extInfo.version));
    $("#about-dlg > .dlg-content #ext-desc").text(that.extInfo.description);
    $("#about-dlg > .dlg-content #ext-home-pg").attr("href", that.extInfo.homePgURL);
  };
  gDialogs.about.onShow = () => {
    let msg = { msgID: "get-app-version" };
    let sendNativeMsg = browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
    sendNativeMsg.then(aResp => {
      $("#about-dlg > .dlg-content #diag-info #sync-ver").text(aResp.appVersion);     
      return aePrefs.getPref("syncClippings");

    }).then(aPrefSyncClpgs => {
      if (!!aPrefSyncClpgs) {
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
        $("#about-dlg > .dlg-content #diag-info #about-sync-status").text(browser.i18n.getMessage("syncStatusOff")).show();
      }
      
      $("#about-dlg > .dlg-content #diag-info #sync-diag-detail").show();

    }).catch(aErr => {
      // Native app is not installed.
      log("Clippings/wx: About dialog: Error returned from native app: " + aErr);
      $("#about-dlg > .dlg-content #diag-info #sync-ver").text(browser.i18n.getMessage("noSyncHelperApp"));
      
    }).finally(() => {
      let diagDeck = $("#about-dlg > .dlg-content #diag-info .deck");
      diagDeck.children("#sync-diag-loading").hide();
      diagDeck.children("#sync-diag").show();
    });
  };
  
  gDialogs.syncClippingsHelp = new aeDialog("#sync-clippings-help-dlg");

  // Sync Clippings help dialog content.
  $("#sync-clippings-help-dlg > .dlg-content").html(sanitizeHTML(browser.i18n.getMessage("syncHelp")));
}


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


function gotoURL(aURL)
{
  browser.tabs.create({ url: aURL });
}


async function closePage()
{
  let tab = await browser.tabs.getCurrent();
  browser.tabs.remove(tab.id);
}


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
