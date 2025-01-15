/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let gOS;
let gDialogs = {};
let gIsActivatingSyncClippings = false;


// Options page initialization
$(async () => {
  let platform = await browser.runtime.getPlatformInfo();
  document.body.dataset.os = gOS = platform.os;

  if (gOS == "win") {
    let prefPgTitleWin = browser.i18n.getMessage("prefsTitleWin");
    document.title = prefPgTitleWin;
    $("#pref-pg-hdr-text").text(prefPgTitleWin);
  }

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

  let tabGeneral = $("#preftab-general-btn");
  tabGeneral.on("click", switchPrefsPanel);
  tabGeneral.ariaSelected = true;

  let tabPaste = $("#preftab-paste-btn");
  tabPaste.on("click", switchPrefsPanel);
  tabPaste.ariaSelected = false;

  let tabSync = $("#preftab-sync-clippings-btn");
  tabSync.on("click", switchPrefsPanel);
  tabSync.ariaSelected = false;

  $("#sync-intro").html(sanitizeHTML(browser.i18n.getMessage("syncIntro")));

  let hostApp = browser.i18n.getMessage("hostAppFx");
  $("#ext-perm-native-msg").text(browser.i18n.getMessage("extPrmNativeMessaging", hostApp));
  $("#ext-perm-native-msg-detail").html(
    sanitizeHTML(browser.i18n.getMessage("syncPermReqDetail", aeConst.SYNC_CLIPPINGS_DWNLD_URL))
  );

  initDialogs();

  $("#brws-act-open-clippings-mgr, #brws-act-open-clippings-sidebar").click(aEvent => {
    aePrefs.setPrefs({browserAction: aEvent.target.value});
  });

  $("#paste-opt-formatted").click(aEvent => {
    $("#html-auto-line-break").prop("disabled", false);
    $("#html-paste-note").removeClass("disabled");
    aePrefs.setPrefs({htmlPaste: aEvent.target.value});
  });

  $("#paste-opt-raw-html").click(aEvent => {
    $("#html-auto-line-break").prop("disabled", true);
    $("#html-paste-note").addClass("disabled");
    aePrefs.setPrefs({htmlPaste: aEvent.target.value});
  });
  
  $("#toggle-sync").click(async (aEvent) => {
    let syncClippings = await aePrefs.getPref("syncClippings");
    if (syncClippings) {
      gDialogs.turnOffSync.showModal();
    }
    else {
      // Check if the optional extension permission "nativeMessaging"
      // was granted.
      let perms = await browser.permissions.getAll();
      if (perms.permissions.includes("nativeMessaging")) {
        gIsActivatingSyncClippings = true;
        gDialogs.syncClippings.showModal();
      }
      else {
        gDialogs.reqNativeAppConxnPerm.showModal();
      }
    }
  });

  $("#about-btn").click(aEvent => {
    gDialogs.about.showModal();
  });

  // About dialog.
  let usrContribCTA = $("#usr-contrib-cta");
  usrContribCTA.append(sanitizeHTML(`<label id="usr-contrib-cta-hdg">${browser.i18n.getMessage("aboutContribHdg")}</label>&nbsp;`));
  usrContribCTA.append(sanitizeHTML(`<a href="${aeConst.DONATE_URL}" class="hyperlink">${browser.i18n.getMessage("aboutDonate")}</a>&nbsp;`));
  usrContribCTA.append(sanitizeHTML(`<label id="usr-contrib-cta-conj">${browser.i18n.getMessage("aboutContribConj")}</label>`));
  usrContribCTA.append(sanitizeHTML(`<a href="${aeConst.L10N_URL}" class="hyperlink">${browser.i18n.getMessage("aboutL10n")}</a>`));
  
  // Sync Clippings help dialog content.
  let syncHlpTxt = browser.i18n.getMessage("syncHelp", aeConst.SYNC_CLIPPINGS_HELP_URL);
  $("#sync-clippings-help-dlg > .dlg-content").html(sanitizeHTML(syncHlpTxt));

  let prefs = await aePrefs.getAllPrefs();
  
  if (prefs.browserAction == aeConst.BRWSACT_OPEN_CLIPPINGS_MGR) {
    $("#brws-act-open-clippings-mgr").prop("checked", true);
  }
  else if (prefs.browserAction == aeConst.BRWSACT_OPEN_SIDEBAR) {
    $("#brws-act-open-clippings-sidebar").prop("checked", true);
  }

  if (prefs.htmlPaste == aeConst.HTMLPASTE_AS_FORMATTED) {
    $("#paste-opt-formatted").prop("checked", true);
    $("#paste-opt-raw-html").prop("checked", false);
    $("#html-auto-line-break").prop("disabled", false);
    $("#html-paste-note").removeClass("disabled");
  }
  else if (prefs.htmlPaste == aeConst.HTMLPASTE_AS_IS) {
    $("#paste-opt-formatted").prop("checked", false);
    $("#paste-opt-raw-html").prop("checked", true);
    $("#html-auto-line-break").prop("disabled", true);
    $("#html-paste-note").addClass("disabled");
  }
  
  $("#html-auto-line-break").prop("checked", prefs.autoLineBreak).click(aEvent => {
    aePrefs.setPrefs({ autoLineBreak: aEvent.target.checked });
  });

  $("#enable-shortcut-key").prop("checked", prefs.keyboardPaste).click(aEvent => {
    aePrefs.setPrefs({ keyboardPaste: aEvent.target.checked })
  });

  $("#auto-inc-plchldrs-start-val").val(prefs.autoIncrPlcHldrStartVal).click(aEvent => {
    aePrefs.setPrefs({ autoIncrPlcHldrStartVal: aEvent.target.valueAsNumber });
  });

  $("#always-save-src-url").prop("checked", prefs.alwaysSaveSrcURL).click(aEvent => {
    aePrefs.setPrefs({ alwaysSaveSrcURL: aEvent.target.checked });
  });

  $("#check-spelling").prop("checked", prefs.checkSpelling).click(aEvent => {
    aePrefs.setPrefs({ checkSpelling: aEvent.target.checked });
  });

  $("#backup-filename-with-date").prop("checked", prefs.backupFilenameWithDate).click(aEvent => {
    aePrefs.setPrefs({ backupFilenameWithDate: aEvent.target.checked });
  });

  $("#backup-reminder").prop("checked", (prefs.backupRemFrequency != aeConst.BACKUP_REMIND_NEVER)).click(async (aEvent) => {
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
      $("#skip-backup-label").prop("disabled", true);
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

  $("#skip-backup-if-no-chg").prop("checked", prefs.skipBackupRemIfUnchg).click(aEvent => {
    aePrefs.setPrefs({skipBackupRemIfUnchg: aEvent.target.checked});
  });

  $("#show-shct-key-in-menu").prop("checked", prefs.showShctKey).click(async (aEvent) => {
    await aePrefs.setPrefs({showShctKey: aEvent.target.checked});
    $("#shct-key-in-menu-opt").prop("disabled", !aEvent.target.checked);
    if (aEvent.target.checked) {
      $("#shct-key-in-menu-opt-label").removeClass("disabled");
    }
    else {
      $("#shct-key-in-menu-opt-label").addClass("disabled");
    }
    browser.runtime.sendMessage({msgID: "rebuild-cxt-menu"});
  });

  if (prefs.showShctKey) {
    $("#shct-key-in-menu-opt-label").removeClass("disabled");
    $("#shct-key-in-menu-opt").val(prefs.showShctKeyDispStyle).prop("disabled", false);  
  }
  else {
    $("#shct-key-in-menu-opt-label").addClass("disabled");
    $("#shct-key-in-menu-opt").val(prefs.showShctKeyDispStyle).prop("disabled", true);
  }

  $("#shct-key-in-menu-opt").change(async (aEvent) => {
    await aePrefs.setPrefs({showShctKeyDispStyle: Number(aEvent.target.value)});
    browser.runtime.sendMessage({msgID: "rebuild-cxt-menu"});
  });

  $("#wnds-dlgs-settings").on("click", aEvent => {
    gDialogs.wndsDlgsOpts.showModal();
  });

  $("#sidebar-paste-opts").on("click", aEvent => {
    gDialogs.clippingsSidebar.showModal();
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

  $("#sync-settings").click(async (aEvent) => {
    let perms = await browser.permissions.getAll();
    if (! perms.permissions.includes("nativeMessaging")) {
      gDialogs.reqNativeAppConxnPerm.showModal();
      return;
    }
    
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
        name: "ae-clippings-paste-clipping",
        shortcut: keybShct,
      });
    });
  }

  $(".hyperlink").click(aEvent => {
    aEvent.preventDefault();
    gotoURL(aEvent.target.href);
  });

  aeInterxn.init(gOS);
  if (prefs.defDlgBtnFollowsFocus) {
    aeInterxn.initDialogButtonFocusHandlers();
  }

  aeVisual.init(gOS);
  aeVisual.cacheIcons(
    "pref-general-checked.svg",
    "pref-paste-checked.svg",
    "pref-sync-clippings-checked.svg",
    "pref-general-checked-dk.svg",
    "pref-paste-checked-dk.svg",
    "pref-sync-clippings-checked-dk.svg"
  );
  aeVisual.preloadMsgBoxIcons(true);
});


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


function switchPrefsPanel(aEvent)
{
  let id = aEvent.target.id;

  if (id == "preftab-general-btn") {
    $("#preftab-paste-btn, #preftab-sync-clippings-btn").removeClass("active-tab")
      .attr("aria-selected", "false");
    $("#prefpane-paste, #prefpane-sync-clippings").removeClass("active-tab-panel");
    $("#prefpane-general").addClass("active-tab-panel");
  }
  else if (id == "preftab-paste-btn") {
    $("#preftab-general-btn, #preftab-sync-clippings-btn").removeClass("active-tab")
      .attr("aria-selected", "false");
    $("#prefpane-general, #prefpane-sync-clippings").removeClass("active-tab-panel");
    $("#prefpane-paste").addClass("active-tab-panel");
  }
  else if (id == "preftab-sync-clippings-btn") {   
    $("#preftab-general-btn, #preftab-paste-btn").removeClass("active-tab")
      .attr("aria-selected", "false");
    $("#prefpane-general, #prefpane-paste").removeClass("active-tab-panel");
    $("#prefpane-sync-clippings").addClass("active-tab-panel");
  }
  aEvent.target.classList.add("active-tab");
  aEvent.target.ariaSelected = true;
}


function initDialogs()
{
  gDialogs.clippingsSidebar = new aeDialog("#sidebar-opts-dlg");
  gDialogs.clippingsSidebar.onInit = async function ()
  {
    let pasteFromSidebar = await aePrefs.getPref("pasteFromSidebar");
    $("#enbl-sidebar-paste").prop("checked", pasteFromSidebar);
  };

  gDialogs.clippingsSidebar.onAccept = function ()
  {
    aePrefs.setPrefs({pasteFromSidebar: $("#enbl-sidebar-paste").prop("checked")});
    this.close();
  };

  gDialogs.reqNativeAppConxnPerm = new aeDialog("#request-native-app-conxn-perm-dlg");
  gDialogs.reqNativeAppConxnPerm.onAccept = async function ()
  {
    this.close();
    
    let permGranted = await browser.permissions.request({
      permissions: ["nativeMessaging"],
    });

    if (permGranted) {
      gIsActivatingSyncClippings = true;
      gDialogs.syncClippings.showModal();
    }
  };

  gDialogs.syncClippings = new aeDialog("#sync-clippings-dlg");
  gDialogs.syncClippings.setProps({
    oldShowSyncItemsOpt: null,
    oldCheckSyncAppUpdatesOpt: null,
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

  gDialogs.syncClippings._initHyperlinksWithin = function (aEltStor)
  {
    this.find(aEltStor).find(".hyperlink").on("click", aEvent => {
      aEvent.preventDefault();
      gotoURL(aEvent.target.href);
    });
  };
  
  gDialogs.syncClippings.onFirstInit = function ()
  {
    $("#sync-conxn-error-detail").html(sanitizeHTML(browser.i18n.getMessage("errSyncConxnDetail")));
    $("#sync-fldr-curr-location").on("focus", aEvent => { aEvent.target.select() });

    this._initHyperlinksWithin("#sync-conxn-error-detail");
  };
  
  gDialogs.syncClippings.onInit = async function ()
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
    let resp;
    try {
      resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, {msgID: "get-app-version"});
    }
    catch (e) {
      console.error("Clippings/wx::options.js: Error returned from syncClippings native app: " + e);
      $("#sync-clippings-dlg .dlg-cancel").text(browser.i18n.getMessage("btnClose"));

      if (e == aeConst.SYNC_ERROR_CONXN_FAILED
          || e == aeConst.SYNC_ERROR_NAT_APP_NOT_FOUND) {
        // This would occur if Sync Clippings helper app won't start.
        deckSyncChk.hide();
        deckSyncConxnError.show();
      }
      else if (e == aeConst.SYNC_ERROR_UNKNOWN) {
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
      return;
    }

    console.info("Sync Clippings helper app version: " + resp.appVersion);

    if (aeVersionCmp(resp.appVersion, "1.2b1") < 0) {
      $("#browse-sync-fldr").hide();
      isBrwsSyncFldrVisible = false;
    }

    if (aeVersionCmp(resp.appVersion, "2.0b1") < 0) {
      $("#sync-clippings-dlg").addClass("expanded");
      $("#cmprs-sync-data-reqmt").html(
        browser.i18n.getMessage("cmprsSyncReqmt", aeConst.SYNC_CLIPPINGS_DWNLD_URL)
      ).show();
      this._initHyperlinksWithin("#cmprs-sync-data-reqmt");
    }
      
    let prefs = await aePrefs.getAllPrefs();
    $("#sync-helper-app-update-check").prop("checked", prefs.syncHelperCheckUpdates);
    $("#show-only-sync-items").prop("checked", prefs.cxtMenuSyncItemsOnly);
    $("#cmprs-sync-data").prop("checked", prefs.compressSyncData);

    this.oldShowSyncItemsOpt = $("#show-only-sync-items").prop("checked");
    this.oldCheckSyncAppUpdatesOpt = $("#sync-helper-app-update-check").prop("checked");

    resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, {msgID: "get-sync-dir"});

    $("#sync-fldr-curr-location").val(resp.syncFilePath);
    $("#sync-clippings-dlg .dlg-accept").show();
    $("#sync-clippings-dlg .dlg-cancel").text(browser.i18n.getMessage("btnCancel"));

    deckSyncChk.hide();
    deckSyncSettings.show();
    this._initKeyboardNav("sync-folder-location", isBrwsSyncFldrVisible);
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
      compressSyncData: $("#cmprs-sync-data").prop("checked"),
    });

    let rebuildClippingsMenu = $("#show-only-sync-items").prop("checked") != this.oldShowSyncItemsOpt;

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

    // Sync Clippings Helper app update checking.
    let isCheckSyncAppUpdatesEnabled = $("#sync-helper-app-update-check").prop("checked");
    let isCheckSyncAppUpdates = (
      gIsActivatingSyncClippings && isCheckSyncAppUpdatesEnabled
        || isCheckSyncAppUpdatesEnabled != this.oldCheckSyncAppUpdatesOpt
    );

    if (isCheckSyncAppUpdates) {
      browser.runtime.sendMessage({
        msgID: "set-sync-clippings-app-upd-chk",
        enable: isCheckSyncAppUpdatesEnabled,
      });
    }

    // Check if the sync file is read only.
    resp = null;
    resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, {
      msgID: "get-sync-file-info",
    });
    let isSyncReadOnly = !!resp.readOnly;
    aePrefs.setPrefs({isSyncReadOnly});

    let syncFolderID = await browser.runtime.sendMessage({
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
    browser.runtime.sendMessage({
      msgID: "sync-activated",
      syncFolderID,
    });

    this.close();
  };
  
  gDialogs.syncClippings.onUnload = function ()
  {
    $("#sync-clippings-dlg").removeClass("expanded");
    $("#cmprs-sync-data-reqmt").text("").hide();
    gDialogs.syncClippings.isCanceled = true;
    this.lastFocusedElt?.focus();
  };

  gDialogs.turnOffSync = new aeDialog("#turn-off-sync-clippings-dlg");
  gDialogs.turnOffSync.onFirstInit = function ()
  {
    this.find(".dlg-btns > .dlg-btn-yes").click(async (aEvent) => {
      this.close();

      let msg = {
        msgID: "enable-sync-clippings",
        isEnabled: false,
      };
      let oldSyncFolderID = await browser.runtime.sendMessage(msg);

      aePrefs.setPrefs({syncClippings: false});
      $("#sync-settings").hide();
      $("#toggle-sync").text(browser.i18n.getMessage("syncTurnOn"));
      $("#sync-status").removeClass("sync-status-on").text(browser.i18n.getMessage("syncStatusOff"));

      browser.runtime.sendMessage({
        msgID: "sync-deactivated",
        oldSyncFolderID,
      });

      gDialogs.turnOffSyncAck.oldSyncFldrID = oldSyncFolderID;
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
    let removeSyncFolder = $("#delete-sync-fldr").prop("checked");

    browser.runtime.sendMessage({
      msgID: "sync-deactivated-after",
      removeSyncFolder,
      oldSyncFolderID: this.oldSyncFldrID,
    });
  };

  gDialogs.wndsDlgsOpts = new aeDialog("#wnds-dlgs-opts-dlg");
  gDialogs.wndsDlgsOpts.setProps({resetClpMgrWndPos: false});
  gDialogs.wndsDlgsOpts.onFirstInit = function ()
  {
    if (! ["win", "mac"].includes(gOS)) {
      let os = gOS == "mac" ? browser.i18n.getMessage("macOS") : capitalize(gOS);
      $("#wnds-dlgs-opts-dlg").css({height: "308px"});
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
    let diagDeck = this.find("#diag-info .deck");
    diagDeck.children("#sync-diag-loading").show();
    diagDeck.children("#sync-diag").hide();
    this.find("#sync-diag-detail").hide();
    this.find("#sync-file-size").text("");

    if (! this.extInfo) {
      let extManifest = browser.runtime.getManifest();
      this.extInfo = {
        name: extManifest.name,
        version: aeMozVersion.getExtendedVersion(extManifest.version),
        description: extManifest.description,
        homePgURL: extManifest.homepage_url,
      };
    }

    this.find("#ext-name").text(this.extInfo.name);
    this.find("#ext-ver").text(browser.i18n.getMessage("aboutExtVer", this.extInfo.version));
    this.find("#ext-desc").text(this.extInfo.description);
    this.find(".dlg-content #ext-home-pg").prop("href", this.extInfo.homePgURL);
  };
  
  gDialogs.about.onShow = async function ()
  {
    let perms = await browser.permissions.getAll();
    if (perms.permissions.includes("nativeMessaging")) {
      this.find("#diag-info").show();
      // Resize dialog to show the Sync Clippings status.
      this._dlgElt.attr("data-expanded", "true");
    }
    else {
      this.find("#diag-info").hide();
      return;
    }

    let resp;
    try {
      resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, {
        msgID: "get-app-version"
      });
    }
    catch (e) {
      // Native app is not installed.
      log("Clippings/wx: About dialog: Error returned from native app: " + e);
      this.find("#sync-ver").text(browser.i18n.getMessage("noSyncHelperApp"));
    }

    let diagDeck = this.find("#diag-info .deck");
    diagDeck.children("#sync-diag-loading").hide();
    diagDeck.children("#sync-diag").show();

    if (! resp) {
      return;
    }

    this.find("#sync-ver").text(resp.appVersion);
    let syncClippings = await aePrefs.getPref("syncClippings");
    resp = null;

    if (syncClippings) {
      resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, {
        msgID: "get-sync-file-info"
      });

      let syncFileSize;
      if (resp.fileSizeKB == "") {
        // Sync Clippings is turned on, but sync file is not yet created.
        syncFileSize = "-";
      }
      else {
        syncFileSize = `${resp.fileSizeKB} KiB`;
      }
      this.find("#about-sync-status").hide();
      this.find("#sync-file-size-label").show();
      this.find("#sync-file-size").text(syncFileSize);
    }
    else {
      // Sync Clippings is inactive.
      this.find("#sync-file-size-label").hide();
      this.find("#about-sync-status").text(browser.i18n.getMessage("syncStatusOff")).show();
    }
    
    this.find("#sync-diag-detail").show();
  };

  gDialogs.about.onUnload = function ()
  {
    this._dlgElt.removeAttr("data-expanded");
  };

  gDialogs.syncClippingsHelp = new aeDialog("#sync-clippings-help-dlg");
}

$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


function gotoURL(aURL)
{
  browser.tabs.create({url: aURL});
}


async function closePage()
{
  let tab = await browser.tabs.getCurrent();
  browser.tabs.remove(tab.id);
}


//
// Utilities
//

function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, {SAFE_FOR_JQUERY: true});
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


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
