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

  $("#browse-sync-fldr").click(async (aEvent) => {
    let natMsg = {msgID: "sync-dir-folder-picker"};
    let resp;
    try {
      resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, natMsg);
    }
    catch (e) {
      window.alert("The Sync Clippings helper app responded with an error.\n\n" + e);
      return;
    }
    
    if (resp.syncFilePath) {
      $("#sync-fldr-curr-location").val(resp.syncFilePath);
    }
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
  if (aEvent.key == "Enter") {
    if (aeDialog.isOpen()) {
      if (aEvent.target.tagName == "BUTTON" && !aEvent.target.classList.contains("default")) {
        aEvent.target.click();
      }
      else {
        aeDialog.acceptDlgs();
      }
    }
    else {
      if (aEvent.target.tagName == "BUTTON") {
        aEvent.target.click();
      }
    }
    aEvent.preventDefault();
  }
  else if (aEvent.key == "Escape" && aeDialog.isOpen()) {
    aeDialog.cancelDlgs();
  }
  else if (aEvent.key == " ") {
    if (aEvent.target.tagName == "A") {
      aEvent.target.click();
    }
  }
  else {
    aeInterxn.suppressBrowserShortcuts(aEvent, aeConst.DEBUG);
  }
});


function initDialogs()
{
  gDialogs.syncClippings = new aeDialog("#sync-clippings-dlg");
  gDialogs.syncClippings.setProps({
    oldShowSyncItemsOpt: null,
    isCanceled: false,
    lastFocusedElt: null,
  });

  gDialogs.syncClippings._initKeyboardNav = function (aVisibleDeckID, aIsBrwsSyncFldrBtnVisible)
  {
    let focusableElts = [];
    
    if (aVisibleDeckID == "sync-folder-location") {
      focusableElts.push(
        $("#sync-fldr-curr-location")[0],
        $("#sync-helper-app-update-check")[0],
        $("#show-only-sync-items")[0],
        $("#sync-clippings-dlg .dlg-accept")[0],
        $("#sync-clippings-dlg .dlg-cancel")[0],
      );

      if (aIsBrwsSyncFldrBtnVisible) {
        focusableElts.splice(1, 0, $("#browse-sync-fldr")[0]);
      }
    }
    else {
      // Only the "Close" button appears for errors.
      focusableElts.push($("#sync-clippings-dlg .dlg-cancel")[0]);
    }

    this.initKeyboardNavigation(focusableElts);
  };
  
  gDialogs.syncClippings.onFirstInit = function ()
  {
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

    $("#sync-fldr-curr-location").on("focus", aEvent => { aEvent.target.select() });
  };
  
  gDialogs.syncClippings.onInit = function ()
  {
    this.isCanceled = false;
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

    let isBrwsSyncFldrVisible = true;
    let lang = browser.i18n.getUILanguage();
    let natMsg = {msgID: "get-app-version"};
    browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, natMsg).then(aResp => {
      console.info("Sync Clippings helper app version: " + aResp.appVersion);

      if (aeVersionCmp(aResp.appVersion, "1.2b1") < 0) {
        $("#browse-sync-fldr").hide();
        isBrwsSyncFldrVisible = false;
      }
      
      return aePrefs.getAllPrefs();

    }).then(aPrefs => {
      $("#sync-helper-app-update-check").prop("checked", aPrefs.syncHelperCheckUpdates);
      $("#show-only-sync-items").prop("checked", aPrefs.cxtMenuSyncItemsOnly);

      this.oldShowSyncItemsOpt = $("#show-only-sync-items").prop("checked");
      let natMsg = {msgID: "get-sync-dir"};
      return browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, natMsg);
      
    }).then(aResp => {
      $("#sync-fldr-curr-location").val(aResp.syncFilePath);
      $("#sync-clippings-dlg .dlg-accept").show();
      $("#sync-clippings-dlg .dlg-cancel").text(browser.i18n.getMessage("btnCancel"));

      deckSyncChk.hide();
      deckSyncSettings.show();

      this._initKeyboardNav("sync-folder-location", isBrwsSyncFldrVisible);

    }).catch(aErr => {
      console.error("Clippings/wx::options.js: Error returned from syncClippings native app: " + aErr);
      
      $("#sync-clippings-dlg .dlg-cancel").text(browser.i18n.getMessage("btnClose"));

      if (aErr == aeConst.SYNC_ERROR_CONXN_FAILED
          || aErr == aeConst.SYNC_ERROR_NAT_APP_NOT_FOUND) {
        // This would occur if Sync Clippings helper app won't start.
        deckSyncChk.hide();
        deckSyncConxnError.show();
      }
      else if (aErr == aeConst.SYNC_ERROR_UNKNOWN) {
        deckSyncChk.hide();
        deckSyncSettings.hide();        
        deckSyncError.show();
        $("#sync-clippings-dlg .dlg-accept").hide();
        $("#sync-err-detail").text(browser.i18n.getMessage("errNoDetails"));
      }
      else {
        deckSyncChk.hide();
        deckSyncSettings.hide();
        deckSyncError.show();
        $("#sync-clippings-dlg .dlg-accept").hide();
        $("#sync-err-detail").text(browser.i18n.getMessage("errSyncOptsInit"));
      }

      this._initKeyboardNav(null, false);
    });
  };
  
  gDialogs.syncClippings.onAccept = async function ()
  {
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

    let natMsg = {
      msgID: "set-sync-dir",
      filePath: syncFldrPath
    };
    log("Sending message 'set-sync-dir' with params:");
    log(natMsg);

    let resp;
    try {
      resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, natMsg);
    }
    catch (e) {
      console.error("Error received from Sync Clippings Helper app: " + e);
      return;
    }

    log("Received response to 'set-sync-dir':");
    log(resp);

    if (resp.status != "ok") {
      window.alert(`The Sync Clippings helper app responded with an error.\n\nStatus: ${resp.status}\nDetails: ${resp.details}`);
      this.close();
      return;
    }     

    let syncFldrID = await browser.runtime.sendMessage({
      msgID: "enable-sync-clippings",
      isEnabled: true,
    });
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

    browser.runtime.sendMessage({
      msgID: "refresh-synced-clippings",
      rebuildClippingsMenu,
    });
    
    let syncClippingsLstrs = gClippings.getSyncClippingsListeners().getListeners();
    for (let listener of syncClippingsLstrs) {
      listener.onActivate(syncFldrID);
    }    
    this.close();
  };
  
  gDialogs.syncClippings.onUnload = function ()
  {
    $("#sync-clippings-dlg").css({ height: "256px" });
    gDialogs.syncClippings.isCanceled = true;
    this.lastFocusedElt?.focus();
  };

  gDialogs.turnOffSync = new aeDialog("#turn-off-sync-clippings-dlg");
  gDialogs.turnOffSync.onFirstInit = function ()
  {
    $("#turn-off-sync-clippings-dlg > .dlg-btns > .dlg-btn-yes").click(async (aEvent) => {
      this.close();

      let msg = {
        msgID: "enable-sync-clippings",
        isEnabled: false,
      };
      let oldSyncFldrID = await browser.runtime.sendMessage(msg);

      aePrefs.setPrefs({syncClippings: false});
      $("#sync-settings").hide();
      $("#toggle-sync").text(browser.i18n.getMessage("syncTurnOn"));
      $("#sync-status").removeClass("sync-status-on").text(browser.i18n.getMessage("syncStatusOff"));

      let syncClippingsLstrs = gClippings.getSyncClippingsListeners().getListeners();
      for (let listener of syncClippingsLstrs) {
	listener.onDeactivate(oldSyncFldrID);
      }

      gDialogs.turnOffSyncAck.oldSyncFldrID = oldSyncFldrID;
      gDialogs.turnOffSyncAck.showModal();
    });
  };
  gDialogs.turnOffSync.onShow = function ()
  {
    setTimeout(() => {
      $("#turn-off-sync-clippings-dlg > .dlg-btns > .dlg-accept")[0].focus();
    }, 10);
  };

  gDialogs.turnOffSyncAck = new aeDialog("#turn-off-sync-clippings-ack-dlg");
  gDialogs.turnOffSyncAck.setProps({oldSyncFldrID: null});
  gDialogs.turnOffSyncAck.onInit = function ()
  {
    $("#delete-sync-fldr").prop("checked", true);
  };
  gDialogs.turnOffSyncAck.onAfterAccept = function ()
  {
    let removeSyncFldr = $("#delete-sync-fldr").prop("checked");
    let syncClippingsLstrs = gClippings.getSyncClippingsListeners().getListeners();

    for (let listener of syncClippingsLstrs) {
      listener.onAfterDeactivate(removeSyncFldr, this.oldSyncFldrID);
    }
  };

  gDialogs.wndsDlgsOpts = new aeDialog("#wnds-dlgs-opts-dlg");
  gDialogs.wndsDlgsOpts.setProps({resetClpMgrWndPos: false});
  gDialogs.wndsDlgsOpts.onFirstInit = function ()
  {
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
  };
  gDialogs.wndsDlgsOpts.onInit = async function ()
  {
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
  gDialogs.about.setProps({extInfo: null});
  gDialogs.about.onInit = function ()
  {
    let diagDeck = $("#about-dlg > .dlg-content #diag-info .deck");
    diagDeck.children("#sync-diag-loading").show();
    diagDeck.children("#sync-diag").hide();
    $("#about-dlg > .dlg-content #diag-info #sync-diag-detail").hide();
    $("#about-dlg > .dlg-content #diag-info #sync-file-size").text("");

    if (! this.extInfo) {
      let extManifest = browser.runtime.getManifest();
      this.extInfo = {
        name: extManifest.name,
        version: extManifest.version,
        description: extManifest.description,
        homePgURL: extManifest.homepage_url,
      };
    }

    $("#about-dlg > .dlg-content #ext-name").text(this.extInfo.name);
    $("#about-dlg > .dlg-content #ext-ver").text(browser.i18n.getMessage("aboutExtVer", this.extInfo.version));
    $("#about-dlg > .dlg-content #ext-desc").text(this.extInfo.description);
    $("#about-dlg > .dlg-content #ext-home-pg").attr("href", this.extInfo.homePgURL);
  };
  
  gDialogs.about.onShow = function ()
  {
    let natMsg = {msgID: "get-app-version"};
    browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, natMsg).then(aResp => {
      $("#about-dlg > .dlg-content #diag-info #sync-ver").text(aResp.appVersion);
      return aePrefs.getPref("syncClippings");

    }).then(aPrefSyncClpgs => {
      if (!!aPrefSyncClpgs) {
        let natMsg = {msgID: "get-sync-file-info"};
        return browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, natMsg);
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
  gDialogs.syncClippingsHelp.onFirstInit = function ()
  {
    // Sync Clippings help dialog content.
    let hlpCont = browser.i18n.getMessage("syncHelp", aeConst.SYNC_CLIPPINGS_HELP_URL);
    $("#sync-clippings-help-dlg > .dlg-content").html(sanitizeHTML(hlpCont));
  };
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
