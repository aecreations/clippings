/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const ROOT_FOLDER_NAME = "clippings-root";

// These globals are used only briefly or during initialization, so they don't
// need to be saved to extension storage.
let gClippingMenuItemIDMap = {};
let gFolderMenuItemIDMap = {};
let gPrefersColorSchemeMedQry;
let gIsFirstRun = false;
let gSetDisplayOrderOnRootItems = false;
let gIsReloadingSyncFldr = false;
let gIsSyncPushFailed = false;
let gVerUpdateType = null;
let gShowUpdateBanner = false;

let gClippingsListener = {
  _isImporting: false,
  _isCopying: false,
  _isClippingsMgrDnDInProgress: false,
  origin: aeConst.ORIGIN_HOSTAPP,
  
  newClippingCreated: function (aID, aData, aOrigin)
  {
    if (this._isCopying) {
      log("Clippings/wx: gClippingsListener.newClippingCreated(): Copying in progress; ignoring DB changes.");
      return;
    }
    
    if (gIsReloadingSyncFldr) {
      log("Clippings/wx: gClippingsListener.newClippingCreated(): The Synced Clippings folder is being reloaded. Ignoring DB changes.");
      return;
    }

    rebuildContextMenu();
  },

  newFolderCreated: function (aID, aData, aOrigin)
  {
    if (this._isCopying) {
      log("Clippings/wx: gClippingsListener.newFolderCreated(): Copying in progress; ignoring DB changes.");
      return;
    }

    if (gIsReloadingSyncFldr || "isSync" in aData) {
      log("Clippings/wx: gClippingsListener.newFolderCreated(): The Synced Clippings folder is being reloaded. Ignoring DB changes.");
      return;
    }

    rebuildContextMenu();
  },

  clippingChanged: function (aID, aData, aOldData)
  {
    if (this._isClippingsMgrDnDInProgress) {
      return;
    }
    
    log("Clippings/wx: gClippingsListener.clippingChanged()");

    if (aData.name != aOldData.name || aData.parentFolderID != aOldData.parentFolderID
       || aData.label != aOldData.label) {
      rebuildContextMenu();
    }
  },

  folderChanged: function (aID, aData, aOldData)
  {
    if (this._isClippingsMgrDnDInProgress) {
      return;
    }

    log("Clippings/wx: gClippingsListener.folderChanged()");

    if ("isSync" in aOldData) {
      log("The Synced Clippings folder is being converted to a normal folder. Ignoring DB changes.");
      return;
    }
    
    if (aData.parentFolderID == aOldData.parentFolderID) {
      updateContextMenuForFolder(aID);
    }
    else {
      rebuildContextMenu();
    }
  },

  copyStarted: function ()
  {
    this._isCopying = true;
  },
  
  copyFinished: function (aItemCopyID)
  {
    this._isCopying = false;
    rebuildContextMenu();
  },

  dndMoveStarted: function ()
  {
    this._isClippingsMgrDnDInProgress = true;
  },

  dndMoveFinished: function ()
  {
    this._isClippingsMgrDnDInProgress = false;
  },
  
  importStarted: function ()
  {
    log("Clippings/wx: gClippingsListener.importStarted()");
    this._isImporting = true;
  },

  importFinished: function (aIsSuccess)
  {
    log("Clippings/wx: gClippingsListener.importFinished()");
    this._isImporting = false;

    if (aIsSuccess) {
      log("Import was successful - proceeding to rebuild Clippings menu.");
      rebuildContextMenu();
    }
  },
};

let gSyncClippingsListener = {
  onActivate(aSyncFolderID)
  {
    // No need to do anything here. The Clippings context menu is automatically
    // rebuilt when the Sync Clippings data is imported, which occurs after
    // turning on Sync Clippings from extension preferences.
  },

  async onDeactivate(aOldSyncFolderID)
  {
    log("Clippings/wx: gSyncClippingsListener.onDeactivate()");

    let cxtMenuSyncItemsOnly = await aePrefs.getPref("cxtMenuSyncItemsOnly");
    if (cxtMenuSyncItemsOnly) {
      return;
    }

    let fldrMenuItemIDMap = await aePrefs.getPref("_folderMenuItemIDMap");
    let syncFldrMenuID = fldrMenuItemIDMap[aOldSyncFolderID];

    // Change the icon on the "Synced Clippings" folder to be a normal
    // folder icon.
    let mnuIco = {
      icons: {
        16: "img/folder.svg"
      }
    };
    browser.menus.update(syncFldrMenuID, mnuIco);
  },

  async onAfterDeactivate(aRemoveSyncFolder, aOldSyncFolderID)
  {
    let prefs = await aePrefs.getAllPrefs();

    function resetCxtMenuSyncItemsOnlyOpt(aRebuildCxtMenu) {
      if (prefs.cxtMenuSyncItemsOnly) {
        aePrefs.setPrefs({cxtMenuSyncItemsOnly: false});
      }
      if (aRebuildCxtMenu) {
        rebuildContextMenu();
      }
    }

    log("Clippings/wx: gSyncClippingsListener.onAfterDeactivate(): Remove Synced Clippings folder: " + aRemoveSyncFolder);

    if (aRemoveSyncFolder) {
      log(`Removing old Synced Clippings folder (ID = ${aOldSyncFolderID})`);
      purgeFolderItems(aOldSyncFolderID, false).then(() => {
        resetCxtMenuSyncItemsOnlyOpt(true);
      });
    }
    else {
      resetCxtMenuSyncItemsOnlyOpt();
    }
  },

  onReloadStart()
  {
    log("Clippings/wx: gSyncClippingsListener.onReloadStart()");
    gIsReloadingSyncFldr = true;
  },
  
  async onReloadFinish()
  {
    log("Clippings/wx: gSyncClippingsListener.onReloadFinish(): Rebuilding Clippings menu");
    gIsReloadingSyncFldr = false;
    rebuildContextMenu();

    log("Clippings/wx: gSyncClippingsListener.onReloadFinish(): Setting static IDs on synced items that don't already have them.");
    let syncFldrID = await aePrefs.getPref("syncFolderID");
    let isStaticIDsAdded = await addStaticIDs(syncFldrID);

    if (isStaticIDsAdded) {
      log("Clippings/wx: gSyncClippingsListener.onReloadFinish(): Static IDs added to synced items.  Saving sync file.");
      await pushSyncFolderUpdates();
    }

    try {
      await browser.runtime.sendMessage({msgID: "sync-fldr-reload-finished"});
    }
    catch {}
  },
};

let gNewClipping = {
  _name: null,
  _content: null,
  _srcURL: null,

  set: function (aNewClipping) {
    this._name = aNewClipping.name;
    this._content = aNewClipping.content;
    this._srcURL = aNewClipping.url;
  },

  get: function () {
    let rv = this.copy();
    this.reset();

    return rv;
  },

  copy: function () {
    let rv = { name: this._name, content: this._content, url: this._srcURL };
    return rv;
  },
  
  reset: function () {
    this._name = null;
    this._content = null;
    this._srcURL = null;
  }
};

let gPlaceholders = {
  _clippingName: null,
  _plchldrs: null,
  _clpCtnt: null,
  _plchldrsWithDefVals: null,

  set: function (aClippingName, aPlaceholders, aPlaceholdersWithDefaultVals, aClippingText) {
    this._clippingName = aClippingName;
    this._plchldrs = aPlaceholders;
    this._plchldrsWithDefVals = aPlaceholdersWithDefaultVals;
    this._clpCtnt = aClippingText;
  },

  get: function () {
    let rv = this.copy();
    this.reset();

    return rv;
  },

  copy: function () {
    let rv = {
      clippingName: this._clippingName,
      placeholders: this._plchldrs.slice(),
      placeholdersWithDefaultVals: Object.assign({}, this._plchldrsWithDefVals),
      content: this._clpCtnt
    };
    return rv;
  },

  reset: function () {
    this._clippingName = null;
    this._plchldrs = null;
    this._plchldrsWithDefVals = null;
    this._clpCtnt = null;
  }
};


//
// Post-installation event handler
//

browser.runtime.onInstalled.addListener(async (aInstall) => {
  if (aInstall.reason == "install") {
    log("Clippings/wx: It appears that the WebExtension is newly installed.  Welcome to Clippings!");
  }
  else if (aInstall.reason == "update") {
    let oldVer = aInstall.previousVersion;
    let currVer = browser.runtime.getManifest().version;

    if (currVer == oldVer) {
      log("Clippings/wx: WebExtension reloaded.");
    }
    else {
      log(`Clippings/wx: Updating from version ${oldVer} to ${currVer}`);

      // Version updates can sometimes cause Clippings Sidebar to open
      // automatically, even if the user had closed it (WebExtension bug?).
      // When this happens, a message bar should appear in the sidebar,
      // informing the user that Clippings was just updated.
      // By default, any version update is classified as minor.
      // Specific version updates are considered major if it such that a CTA
      // button to the What's New page should appear in the message bar.
      if (aeVersionCmp(oldVer, aeConst.CURR_MAJOR_VER) < 0) {
        gVerUpdateType = aeConst.VER_UPDATE_TYPE_MAJOR;
        setFirstWhatsNewNotificationDelay();
      }
      else {
        gVerUpdateType = aeConst.VER_UPDATE_TYPE_MINOR;
      }
      gShowUpdateBanner = true;
    }
  }
});


//
// Browser startup
//

browser.runtime.onStartup.addListener(async () => {
  log("Clippings/wx: Resetting persistent background script data during browser startup");
  await aePrefs.setDefaultBkgdState();
  await aeClippingSubst.resetAllAutoIncrementVars();
});


//
// Browser window and Clippings menu initialization
//

void async function ()
{
  log("Clippings/wx: WebExtension startup initiated.");
  
  let prefs = await aePrefs.getAllPrefs();
  log("Clippings/wx: Successfully retrieved user preferences:");
  log(prefs);

  // Check for and set user prefs (if not already set) from all previous
  // versions of Clippings.  This needs to be performed at every startup since
  // it is not possible to determine if this function is called after the
  // WebExtension is installed, updated, reloaded, or loaded during host app
  // startup.
  if (! aePrefs.hasUserPrefs(prefs)) {
    log("Initializing Clippings user preferences.");
    gIsFirstRun = true;
    await aePrefs.setUserPrefs(prefs);
  }

  if (! aePrefs.hasSanDiegoPrefs(prefs)) {
    gSetDisplayOrderOnRootItems = true;
    log("Initializing 6.1 user preferences.");
    await aePrefs.setSanDiegoPrefs(prefs);
  }

  if (! aePrefs.hasBalboaParkPrefs(prefs)) {
    log("Initializing 6.1.2 user preferences.");
    await aePrefs.setBalboaParkPrefs(prefs);
  }

  if (! aePrefs.hasMalibuPrefs(prefs)) {
    log("Initializing 6.2 user preferences.");
    await aePrefs.setMalibuPrefs(prefs);
  }
  
  if (! aePrefs.hasTopangaPrefs(prefs)) {
    log("Initializing 6.2.1 user preferences.");
    await aePrefs.setTopangaPrefs(prefs);
  }

  if (! aePrefs.hasHuntingdonPrefs(prefs)) {
    log("Initializing 6.3 user preferences.");
    await aePrefs.setHuntingdonPrefs(prefs);
  }

  if (! aePrefs.hasSanClementePrefs(prefs)) {
    log("Initializing 6.4 user preferences.");
    await aePrefs.setSanClementePrefs(prefs);
  }

  if (! aePrefs.hasModestoPrefs(prefs)) {
    log("Initializing 6.5.2 user preferences.");
    await aePrefs.setModestoPrefs(prefs);
  }

  if (! aePrefs.hasSanFranciscoPrefs(prefs)) {
    log("Initializing 7.0 user preferences and MV3 background script state persistence.");
    await aePrefs.setSanFranciscoPrefs(prefs);

    let platform = await browser.runtime.getPlatformInfo();
    if (platform.os == "linux") {
      aePrefs.setPrefs({clippingsMgrAutoShowStatusBar: true});
    }

    // Starting in Clippings 7.0, window positioning prefs are turned on
    // by default for macOS.
    // They were previously turned off due to a bug occurring on systems with
    // multiple displays in older versions of macOS.
    if (platform.os == "mac") {
      aePrefs.setPrefs({
        autoAdjustWndPos: true,
        clippingsMgrSaveWndGeom: true,
      });
    }
  }

  if (prefs.clippingsMgrDetailsPane) {
    aePrefs.setPrefs({clippingsMgrAutoShowDetailsPane: false});
  }

  init(prefs);
}();


async function init(aPrefs)
{
  log("Clippings/wx: Initializing integration with host app...");
  
  aeClippings.init();

  let [brws, platform] = await Promise.all([
    browser.runtime.getBrowserInfo(),
    browser.runtime.getPlatformInfo(),
  ]);
  
  log(`Clippings/wx: Host app: ${brws.name} (version ${brws.version})`);
  log("Clippings/wx: OS: " + platform.os);

  aeVisual.init(platform.os);

  if (platform.os == "linux" && aPrefs.clippingsMgrMinzWhenInactv === null) {
    await aePrefs.setPrefs({clippingsMgrMinzWhenInactv: false});
  }

  if (aPrefs.autoAdjustWndPos === null) {
    let autoAdjustWndPos = ["win", "mac"].includes(platform.os);
    let clippingsMgrSaveWndGeom = autoAdjustWndPos;
    await aePrefs.setPrefs({autoAdjustWndPos, clippingsMgrSaveWndGeom});
  }

  // Handle changes to Dark Mode system setting.
  gPrefersColorSchemeMedQry = window.matchMedia("(prefers-color-scheme: dark)");
  await handlePrefersColorSchemeChange(gPrefersColorSchemeMedQry);
  gPrefersColorSchemeMedQry.addEventListener("change", handlePrefersColorSchemeChange);
  
  if (aPrefs.syncClippings) {
    log("Clippings: init(): Sync Clippings turned on - initializing Synced Clippings folder.");
    let isSyncReadOnly = await isSyncedClippingsReadOnly();
    log(`Clippings/wx: It is ${isSyncReadOnly} that the sync data is read only.`);

    // The context menu will be built when refreshing the sync data, via the
    // onReloadFinish event handler of the Sync Clippings listener.
    try {
      await refreshSyncedClippings(true);
    }
    catch (e) {
      // Build the context menu anyway, since that won't happen in the above
      // event handler due to the error.
      rebuildContextMenu();
    }
    aePrefs.setPrefs({isSyncReadOnly});
  }
  else {
    log("Clippings: init(): Sync Clippings turned off.");
    rebuildContextMenu();
  }
  
  if (aPrefs.backupRemFirstRun && !aPrefs.lastBackupRemDate) {
    aePrefs.setPrefs({
      lastBackupRemDate: new Date().toString(),
    });
  }

  let upgradeNotifcnAlarm = await browser.alarms.get("show-upgrade-notifcn");
  if (!upgradeNotifcnAlarm && aPrefs.upgradeNotifCount > 0) {
    // Show post-update notification in 1 minute.
    browser.alarms.create("show-upgrade-notifcn", {
      delayInMinutes: aeConst.POST_UPGRADE_NOTIFCN_DELAY_MS / 60000,
      periodInMinutes: aeConst.DEFAULT_ALARM_INTERVAL_MINS,
    });
  }

  let backupNotifcnAlarm = await browser.alarms.get("show-backup-notifcn");
  if (! backupNotifcnAlarm) {
    // Show backup reminder notification in 5 minutes.
    // Thereafter, calculate the next notification appearance every 15 minutes.
    browser.alarms.create("show-backup-notifcn", {
      delayInMinutes: aeConst.BACKUP_REMINDER_DELAY_MS / 60000,
      periodInMinutes: aeConst.DEFAULT_ALARM_INTERVAL_MINS,
    });
  }

  // Sync Clippings Helper app update check.
  if (aPrefs.syncClippings && aPrefs.syncHelperCheckUpdates) {
    await setSyncHelperUpdateNotificationDelay(true);
  }

  if (aPrefs.showWelcome) {
    openWelcomePage();
    aePrefs.setPrefs({showWelcome: false});
  }

  localStorage.setItem("browserAction", aPrefs.browserAction);

  if (gSetDisplayOrderOnRootItems) {
    await setDisplayOrderOnRootItems();
    log("Clippings/wx: Display order on root folder items have been set");
  }

  aePrefs.setPrefs({_isInitialized: true});
  log("Clippings/wx: Initialization complete.");   
}


function setDisplayOrderOnRootItems()
{
  let clippingsDB = aeClippings.getDB();
  
  return new Promise((aFnResolve, aFnReject) => {
    let seq = 1;

    clippingsDB.transaction("rw", clippingsDB.clippings, clippingsDB.folders, () => {
      clippingsDB.folders.where("parentFolderID").equals(aeConst.ROOT_FOLDER_ID).each((aItem, aCursor) => {
        log(`Clippings/wx: setDisplayOrderOnRootItems(): Folder "${aItem.name}" (id=${aItem.id}): display order = ${seq}`);
        let numUpd = clippingsDB.folders.update(aItem.id, { displayOrder: seq++ });

      }).then(() => {
        return clippingsDB.clippings.where("parentFolderID").equals(aeConst.ROOT_FOLDER_ID).each((aItem, aCursor) => {
          log(`Clippings/wx: setDisplayOrderOnRootItems(): Clipping "${aItem.name}" (id=${aItem.id}): display order = ${seq}`);
          let numUpd = clippingsDB.clippings.update(aItem.id, { displayOrder: seq++ });
        });

      }).then(() => {
        aFnResolve();
      });     

    }).catch(aErr => {
      console.error("Clippings/wx: setDisplayOrderOnRootItems(): " + aErr);
      aFnReject(aErr);
    });
  }); 
}


function addStaticIDs(aFolderID)
{
  let rv = false;
  let clippingsDB = aeClippings.getDB();
  
  return new Promise((aFnResolve, aFnReject) => {
    clippingsDB.transaction("rw", clippingsDB.clippings, clippingsDB.folders, () => {
      clippingsDB.folders.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
        if (! ("sid" in aItem)) {
          let sid = aeUUID();
          clippingsDB.folders.update(aItem.id, {sid});
          log(`Clippings/wx: addStaticIDs(): Static ID added to folder ${aItem.id} - "${aItem.name}"`);
          rv = true;
        }
        addStaticIDs(aItem.id);
      }).then(() => {
        return clippingsDB.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
          if (! ("sid" in aItem)) {
            let sid = aeUUID();
            clippingsDB.clippings.update(aItem.id, {sid});
            log(`Clippings/wx: addStaticIDs(): Static ID added to clipping ${aItem.id} - "${aItem.name}"`);
            rv = true;
          }
        });
      }).then(() => {
        aFnResolve(rv);
      });
    }).catch(aErr => { aFnReject(aErr) });
  });
}


async function enableSyncClippings(aIsEnabled)
{
  let clippingsDB = aeClippings.getDB();
  let syncFolderID = await aePrefs.getPref("syncFolderID");

  if (aIsEnabled) {
    log("Clippings/wx: enableSyncClippings(): Turning ON");

    if (syncFolderID === null) {
      log("Clippings/wx: enableSyncClippings(): Creating the Synced Clippings folder."); 
      let syncFldr = {
        name: browser.i18n.getMessage("syncFldrName"),
        parentFolderID: aeConst.ROOT_FOLDER_ID,
        displayOrder: 0,
        isSync: true,
      };
      try {
        syncFolderID = await clippingsDB.folders.add(syncFldr);
      }
      catch (e) {
        console.error("Clippings/wx: enableSyncClippings(): Failed to create the Synced Clipping folder: " + e);
      }

      await aePrefs.setPrefs({syncFolderID});
      log("Clippings/wx: enableSyncClippings(): Synced Clippings folder ID: " + syncFolderID);
      return syncFolderID;
    }
  }
  else {
    log("Clippings/wx: enableSyncClippings(): Turning OFF");
    let oldSyncFldrID = syncFolderID;

    let numUpd = await clippingsDB.folders.update(syncFolderID, { isSync: undefined });
    await aePrefs.setPrefs({syncFolderID: null});
    return oldSyncFldrID;
  }
}


async function isSyncedClippingsReadOnly()
{
  let rv = null;
  let perms = await browser.permissions.getAll();
  if (! perms.permissions.includes("nativeMessaging")) {
    return rv;
  }

  let resp;
  try {
    resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, {
      msgID: "get-sync-file-info",
    });
  }
  catch (e) {
    console.error("Clippings/wx: isSyncedClippingsReadOnly(): Error sending native message to Sync Clippings Helper: " + e);
    return rv;
  }

  rv = !!resp.readOnly;

  return rv;
}


async function refreshSyncedClippings(aRebuildClippingsMenu)
{
  let perms = await browser.permissions.getAll();
  if (! perms.permissions.includes("nativeMessaging")) {
    showNoNativeMsgPermNotification();
    return;
  }

  let prefs = await aePrefs.getAllPrefs();
  let resp;
  try {
    resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, {
      msgID: "get-app-version",
    });
  }
  catch (e) {
    console.error("Clippings/wx: refreshSyncedClippings(): Error sending native message to Sync Clippings Helper: " + e);
    if (e == aeConst.SYNC_ERROR_CONXN_FAILED
        || e == aeConst.SYNC_ERROR_NAT_APP_NOT_FOUND) {
      showSyncAppErrorNotification();
    }
    else if (aErr == aeConst.SYNC_ERROR_UNEXPECTED) {
      // This error occurs if Sync Clippings was uninstalled and then
      // reinstalled, but the sync folder location isn't set.
    }
    
    throw e;
  }

  log(`Clippings/wx: refreshSyncedClippings(): Sync Clippings Helper version: ${resp.appVersion}`);

  let isCompressedSyncData = false;
  let natMsg = {msgID: "get-synced-clippings"};
  if (aeVersionCmp(resp.appVersion, "2.0b1") >= 0 && prefs.compressSyncData) {
    isCompressedSyncData = true;
    natMsg.msgID = "get-compressed-synced-clippings";
  }
  
  log(`Clippings/wx: refreshSyncedClippings(): Retrieving synced clippings from Sync Clippings Helper by sending native message "${natMsg.msgID}"`);

  let syncJSONData = "";
  resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, natMsg);

  if (resp) {
    if (isCompressedSyncData) {
      log("Clippings/wx: refreshSyncedClippings(): Received Sync Clippings Helper 2.0 response (base64-encoded gzip format)");
      if (resp.status == "ok") {
        let zipData = aeCompress.base64ToBytes(resp.data);
        syncJSONData = await aeCompress.decompress(zipData);
      }
      else {
        console.error("Sync Clippings Helper is unable to read the sync file.  Error details:\n" + resp.details);
        showSyncReadErrorNotification();
        throw new Error("Sync Clippings Helper is unable to read the sync file: " + resp.details);
      }
    }
    else {
      log("Clippings/wx: refreshSyncedClippings(): Received Sync Clippings Helper 1.x response");
      syncJSONData = resp;
    }
  }
  else {
    throw new Error("Clippings/wx: refreshSyncedClippings(): Response data from native app is invalid");
  }

  let clippingsDB = aeClippings.getDB();
  let syncFolderID = prefs.syncFolderID;

  if (syncFolderID === null) {
    log("Clippings/wx: The Synced Clippings folder is missing. Creating it...");
    let syncFldr = {
      name: browser.i18n.getMessage("syncFldrName"),
      parentFolderID: aeConst.ROOT_FOLDER_ID,
      displayOrder: 0,
    };
    
    syncFolderID = await clippingsDB.folders.add(syncFldr);
  }
  log("Clippings/wx: refreshSyncedClippings(): Synced Clippings folder ID: " + syncFolderID);
  
  await aePrefs.setPrefs({syncFolderID});
  gSyncClippingsListener.onReloadStart();

  log("Clippings/wx: Purging existing items in the Synced Clippings folder...");
  await purgeFolderItems(syncFolderID, true);

  log("Clippings/wx: Importing clippings data from sync file...");

  // Method aeImportExport.importFromJSON() is asynchronous, so the import
  // may not yet be finished when this function has finished executing!
  aeImportExport.setDatabase(clippingsDB);
  aeImportExport.importFromJSON(syncJSONData, false, false, syncFolderID);

  setTimeout(function () {
    gSyncClippingsListener.onReloadFinish();
  }, prefs.afterSyncFldrReloadDelay);
}


async function pushSyncFolderUpdates()
{
  let prefs = await aePrefs.getAllPrefs();
  if (!prefs.syncClippings || prefs.syncFolderID === null) {
    throw new Error("Sync Clippings is not turned on!");
  }

  let perms = await browser.permissions.getAll();
  if (! perms.permissions.includes("nativeMessaging")) {
    return;
  }

  let clippingsDB = aeClippings.getDB();
  aeImportExport.setDatabase(clippingsDB);

  let syncData = await aeImportExport.exportToJSON(true, true, prefs.syncFolderID, false, true, true);
  let natMsg = {
    msgID: "set-synced-clippings",
    syncData: syncData.userClippingsRoot,
  };

  info("Clippings/wx: pushSyncFolderUpdates(): Pushing Synced Clippings folder updates to the Sync Clippings helper app. Message data:");
  log(natMsg);

  let resp;
  try {
    resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, natMsg);
  }
  catch (e) {
    console.error("Clippings/wx: pushSyncFolderUpdates(): " + e);
    throw e;
  }

  log("Clippings/wx: pushSyncFolderUpdates(): Response from native app:");
  log(resp);

  if (resp.status == "error") {
    // An error may occur if the push failed because the sync file is
    // read only.
    if (resp.details.search(/TypeError/) != -1 && !gIsSyncPushFailed) {
      showSyncPushReadOnlyNotification();
      gIsSyncPushFailed = true;
    }
  }
}


function purgeFolderItems(aFolderID, aKeepFolder)
{
  let clippingsDB = aeClippings.getDB();

  return new Promise((aFnResolve, aFnReject) => {
    clippingsDB.transaction("rw", clippingsDB.clippings, clippingsDB.folders, () => {
      clippingsDB.folders.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
        purgeFolderItems(aItem.id, false).then(() => {});

      }).then(() => {
        if (!aKeepFolder && aFolderID != aeConst.DELETED_ITEMS_FLDR_ID) {
          log("Clippings/wx: purgeFolderItems(): Deleting folder: " + aFolderID);
          return clippingsDB.folders.delete(aFolderID);
        }
        return null;
        
      }).then(() => {
        return clippingsDB.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
          log("Clippings/wx: purgeFolderItems(): Deleting clipping: " + aItem.id);
          clippingsDB.clippings.delete(aItem.id);
        });
      }).then(() => {
        aFnResolve();
      });
    }).catch(aErr => {
      aFnReject(aErr);
    });
  });
}


async function getShortcutKeyPrefixStr()
{
  let rv = "";
  let platform = await browser.runtime.getPlatformInfo();
  let isMacOS = platform.os == "mac";
  let [cmd] = await browser.commands.getAll();
  let shct = cmd.shortcut;
  let keybPasteKey = shct.substring(shct.lastIndexOf("+") + 1);
  let keybPasteMods = shct.substring(0, shct.lastIndexOf("+"));

  let keys = [
    "Home", "End", "PageUp", "PageDown", "Space", "Insert", "Delete",
    "Up", "Down", "Left", "Right"
  ];
  let localizedKey = "";

  if (keys.includes(keybPasteKey)) {
    if (keybPasteKey == "Delete" && isMacOS) {
      localizedKey = browser.i18n.getMessage("keyMacDel");
    }
    else {
      localizedKey = browser.i18n.getMessage(`key${keybPasteKey}`);
    }
  }
  else {
    if (keybPasteKey == "Period") {
      localizedKey = ".";
    }
    else if (keybPasteKey == "Comma") {
      localizedKey = ",";
    }
    else {
      localizedKey = keybPasteKey;
    }
  }

  let modifiers = keybPasteMods.split("+");

  // On macOS, always put the primary modifier key (e.g. Command) at the end.
  if (isMacOS && modifiers.length > 1 && modifiers[1] == "Shift") {
    let modPrimary = modifiers.shift();
    modifiers.push(modPrimary);
  }
  
  let localizedMods = "";

  for (let i = 0; i < modifiers.length; i++) {
    let modifier = modifiers[i];
    let localzMod;
    
    if (isMacOS) {
      if (modifier == "Alt") {
        localzMod = browser.i18n.getMessage("keyOption");
      }
      else if (modifier == "Ctrl") {
        localzMod = browser.i18n.getMessage("keyCommand");
      }
      else if (modifier == "Shift") {
        localzMod = browser.i18n.getMessage("keyMacShift");
      }
      else {
        localzMod = browser.i18n.getMessage(`key${modifier}`);
      }
    }
    else {
      localzMod = browser.i18n.getMessage(`key${modifier}`);
      localzMod += "+";
    }
    localizedMods += localzMod;
  }

  rv = `${localizedMods}${localizedKey}`;
  return rv;
}


function getContextMenuData(aFolderID, aPrefs)
{
  function fnSortMenuItems(aItem1, aItem2)
  {
    let rv = 0;
    if ("displayOrder" in aItem1 && "displayOrder" in aItem2) {
      rv = aItem1.displayOrder - aItem2.displayOrder;
    }
    return rv;    
  }
  // END nested functions

  let rv = [];
  let clippingsDB = aeClippings.getDB();

  return new Promise((aFnResolve, aFnReject) => {
    clippingsDB.transaction("r", clippingsDB.folders, clippingsDB.clippings, () => {
      clippingsDB.folders.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
        let fldrMenuItemID = "ae-clippings-folder-" + aItem.id + "_" + Date.now();
        gFolderMenuItemIDMap[aItem.id] = fldrMenuItemID;

        let submenuItemData = {
          id: fldrMenuItemID,
          title: sanitizeMenuTitle(aItem.name),
        };

        // Submenu icon
        let iconPath = "img/folder.svg";
        if (aItem.id == aPrefs.syncFolderID) {
          // Firefox bug on macOS:
          // Dark Mode setting isn't applied to the browser context menu when
          // a Firefox dark color theme is used.
          if (getContextMenuData.isDarkMode) {
            if (aPrefs.isSyncReadOnly) {
              iconPath = "img/synced-clippings-readonly-dk.svg";
            }
            else {
              iconPath = "img/synced-clippings-dk.svg";
            }
          }
          else {
            if (aPrefs.isSyncReadOnly) {
              iconPath = "img/synced-clippings-readonly.svg";
            }
            else {
              iconPath = "img/synced-clippings.svg";
            }
          }
        }
        submenuItemData.icons = {16: iconPath};

        if (! ("displayOrder" in aItem)) {
          submenuItemData.displayOrder = 0;
        }
        else {
          submenuItemData.displayOrder = aItem.displayOrder;
        }

        if (aFolderID != aeConst.ROOT_FOLDER_ID) {
          let parentFldrMenuItemID = gFolderMenuItemIDMap[aFolderID];
          submenuItemData.parentId = parentFldrMenuItemID;
        }
        getContextMenuData(aItem.id, aPrefs).then(aSubmenuData => {
          aSubmenuData.sort(fnSortMenuItems);
          submenuItemData.submenuItems = aSubmenuData;
          rv.push(submenuItemData);
        });

      }).then(() => {
        return clippingsDB.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
          let menuItemData;
          if (aItem.separator) {
            menuItemData = {separator: true};

            if ("displayOrder" in aItem) {
              menuItemData.displayOrder = aItem.displayOrder;
            }
            else {
              menuItemData.displayOrder = 0;
            }
          }
          else {
            let menuItemID = "ae-clippings-clipping-" + aItem.id + "_" + Date.now();
            gClippingMenuItemIDMap[aItem.id] = menuItemID;

            menuItemData = {
              id: menuItemID,
              title: sanitizeMenuTitle(aItem.name),
              icons: {
                16: "img/" + (aItem.label ? `clipping-${aItem.label}.svg` : "clipping.svg")
              },
            };

            if (aItem.label) {
              menuItemData.label = aItem.label;
            }

            if ("shortcutKey" in aItem && aItem.shortcutKey != "" && aPrefs.showShctKey) {
              let shctKey = "";
              if (aPrefs.showShctKeyDispStyle == aeConst.SHCTKEY_DISPLAY_SQ_BRKT) {
                shctKey = ` [${aItem.shortcutKey}]`;
              }
              else {
                shctKey = ` (${aItem.shortcutKey})`;
              }
              menuItemData.title += shctKey;
            }

            if ("displayOrder" in aItem) {
              menuItemData.displayOrder = aItem.displayOrder;
            }
            else {
              menuItemData.displayOrder = 0;
            }
          }
          
          if (aFolderID != aeConst.ROOT_FOLDER_ID) {
            let fldrMenuItemID = gFolderMenuItemIDMap[aFolderID];
            menuItemData.parentId = fldrMenuItemID;
          }

          rv.push(menuItemData);
        });
      }).then(() => {
        rv.sort(fnSortMenuItems);
        aFnResolve(rv);
      });
    }).catch(aErr => {
      aFnReject(aErr);
    });
  });
}
getContextMenuData.isDarkMode = null;


async function buildContextMenu(aPlatformOS, aPrefs)
{
  log("Clippings/wx: buildContextMenu()");
  
  // Context menus for browser action button.
  browser.menus.create({
    id: "ae-clippings-reset-autoincr-plchldrs",
    title: browser.i18n.getMessage("baMenuResetAutoIncrPlaceholders"),
    enabled: false,
    contexts: ["action"],
    documentUrlPatterns: ["<all_urls>"]
  });

  let prefsMnuStrKey = "mnuPrefs";
  if (aPlatformOS == "win") {
    prefsMnuStrKey = "mnuPrefsWin";
  }
  browser.menus.create({
    id: "ae-clippings-prefs",
    title: browser.i18n.getMessage(prefsMnuStrKey),
    contexts: ["action"],
  });

  // Context menu for web page textbox or HTML editor.
  browser.menus.create({
    id: "ae-clippings-new",
    title: browser.i18n.getMessage("cxtMenuNew"),
    contexts: ["editable", "selection"],
    documentUrlPatterns: ["<all_urls>"]
  });
  browser.menus.create({
    id: "ae-clippings-manager",
    title: browser.i18n.getMessage("cxtMenuOpenClippingsMgr"),
    contexts: ["editable", "selection"],
    documentUrlPatterns: ["<all_urls>"]
  });

  let rootFldrID = aeConst.ROOT_FOLDER_ID;
  if (aPrefs.syncClippings && aPrefs.cxtMenuSyncItemsOnly) {
    rootFldrID = aPrefs.syncFolderID;
  }

  gFolderMenuItemIDMap = aPrefs._clippingMenuItemIDMap;
  gClippingMenuItemIDMap = aPrefs._folderMenuItemIDMap;

  let menuData = await getContextMenuData(rootFldrID, aPrefs);
  if (aeConst.DEBUG) {
    console.log("buildContextMenu(): Menu data: ");
    console.log(menuData);
  }

  aePrefs.setPrefs({
    _clippingMenuItemIDMap: gClippingMenuItemIDMap,
    _folderMenuItemIDMap: gFolderMenuItemIDMap,
  });
  
  if (menuData.length > 0) {
    browser.menus.create({
      id: "ae-clippings-submenu-separator",
      type: "separator",
      contexts: ["editable"],
      documentUrlPatterns: ["<all_urls>"]
    });

    buildContextMenuHelper(menuData);
  }

  await rebuildAutoIncrementPlchldrResetMenu();
}


function buildContextMenuHelper(aMenuData)
{
  for (let i = 0; i < aMenuData.length; i++) {
    let menuData = aMenuData[i];
    let menuItem;

    if (menuData.separator) {
      menuItem = {
        // MV3 extensions need to have IDs on all menu items, even separators.
        id: `aesep_${aeUUID()}`,
        type: "separator",
        contexts: ["editable"],
        documentUrlPatterns: ["<all_urls>"]
      };
    }
    else {
      menuItem = {
        id: menuData.id,
        title: menuData.title,
        icons: menuData.icons,
        contexts: ["editable"],
        documentUrlPatterns: ["<all_urls>"]
      };
    }
    
    if ("parentId" in menuData && menuData.parentId != aeConst.ROOT_FOLDER_ID) {
      menuItem.parentId = menuData.parentId;
    }

    browser.menus.create(menuItem);
    
    if (menuData.submenuItems) {
      buildContextMenuHelper(menuData.submenuItems);
    }
  }
}


async function updateContextMenuForFolder(aUpdatedFolderID)
{
  let id = Number(aUpdatedFolderID);
  let clippingsDB = aeClippings.getDB();

  let folder = await clippingsDB.folders.get(id);
  let fldrMenuItemIDMap = await aePrefs.getPref("_folderMenuItemIDMap");
  let menuItemID = fldrMenuItemIDMap[id];
  if (menuItemID) {
    browser.menus.update(menuItemID, {title: sanitizeMenuTitle(folder.name)});
  }
}


async function rebuildContextMenu()
{
  log("Clippings/wx: rebuildContextMenu(): Removing all Clippings context menu items and rebuilding the menu...");
  await browser.menus.removeAll();

  gClippingMenuItemIDMap = {};
  gFolderMenuItemIDMap = {};
  await aePrefs.setPrefs({
    _clippingMenuItemIDMap: {},
    _folderMenuItemIDMap: {},
  });

  let platform = await browser.runtime.getPlatformInfo();
  let prefs = await aePrefs.getAllPrefs();
  await buildContextMenu(platform.os, prefs);
}


async function handlePrefersColorSchemeChange(aMediaQuery)
{
  log("Clippings: handlePrefersColorSchemeChange() event handler");

  getContextMenuData.isDarkMode = aMediaQuery.matches;

  let syncClippings = await aePrefs.getPref("syncClippings");

  // Changes to the Dark Mode setting only affects the Synced Clippings folder
  // menu icon.
  if (syncClippings) {
    await rebuildContextMenu();
  }
}


async function buildAutoIncrementPlchldrResetMenu(aAutoIncrPlchldrs)
{
  let autoIncrPlchldrs = await aePrefs.getPref("_autoIncrPlchldrs");
  let autoIncrPlchldrsSet = new Set(autoIncrPlchldrs);
  let enabledResetMenu = false;
  
  aAutoIncrPlchldrs.forEach(async (aItem, aIndex, aArray) => {
    if (! autoIncrPlchldrsSet.has(aItem)) {
      autoIncrPlchldrsSet.add(aItem);
      await aePrefs.setPrefs({_autoIncrPlchldrs: [...autoIncrPlchldrsSet]});

      let menuItem = {
        id: `ae-clippings-reset-autoincr-${aItem}`,
        title: `#[${aItem}]`,
        parentId: "ae-clippings-reset-autoincr-plchldrs",
        contexts: ["action"],
        documentUrlPatterns: ["<all_urls>"]
      };
      
      await browser.menus.create(menuItem);
      if (! enabledResetMenu) {
        await browser.menus.update("ae-clippings-reset-autoincr-plchldrs", {
          enabled: true
        });
        enabledResetMenu = true;
      }
    }
  });
}


async function rebuildAutoIncrementPlchldrResetMenu()
{
  let autoIncrPlchldrs = await aePrefs.getPref("_autoIncrPlchldrs");

  if (autoIncrPlchldrs.length > 0) {
    await browser.menus.update("ae-clippings-reset-autoincr-plchldrs", {
      enabled: true,
    });
    autoIncrPlchldrs.forEach(async (aItem) => {
      let menuItem = {
        id: `ae-clippings-reset-autoincr-${aItem}`,
        title: `#[${aItem}]`,
        parentId: "ae-clippings-reset-autoincr-plchldrs",
        contexts: ["action"],
        documentUrlPatterns: ["<all_urls>"]
      };
      await browser.menus.create(menuItem);
    });
  }
}


async function resetAutoIncrPlaceholder(aPlaceholder)
{
  log(`Clippings/wx: resetAutoIncrPlaceholder(): Resetting placeholder: #[${aPlaceholder}]`);

  await aeClippingSubst.resetAutoIncrementVar(aPlaceholder);
  let autoIncrPlchldrs = await aePrefs.getPref("_autoIncrPlchldrs");
  let autoIncrPlchldrsSet = new Set(autoIncrPlchldrs);
  autoIncrPlchldrsSet.delete(aPlaceholder);
  await browser.menus.remove(`ae-clippings-reset-autoincr-${aPlaceholder}`);
  aePrefs.setPrefs({_autoIncrPlchldrs: [...autoIncrPlchldrsSet]});
  
  if (autoIncrPlchldrsSet.size == 0) {
    browser.menus.update("ae-clippings-reset-autoincr-plchldrs", {enabled: false});
  }
}


async function showBackupNotification()
{
  let prefs = await aePrefs.getAllPrefs();
  if (prefs.backupRemFrequency == aeConst.BACKUP_REMIND_NEVER) {
    return;
  }

  let today = new Date();
  let lastBackupRemDate = new Date(prefs.lastBackupRemDate);
  let diff = new aeDateDiff(today, lastBackupRemDate);
  let numDays = 0;

  switch (prefs.backupRemFrequency) {
  case aeConst.BACKUP_REMIND_DAILY:
    numDays = 1;
    break;

  case aeConst.BACKUP_REMIND_TWODAYS:
    numDays = 2;
    break;

  case aeConst.BACKUP_REMIND_THREEDAYS:
    numDays = 3;
    break;

  case aeConst.BACKUP_REMIND_FIVEDAYS:
    numDays = 5;
    break;

  case aeConst.BACKUP_REMIND_TWOWEEKS:
    numDays = 14;
    break;

  case aeConst.BACKUP_REMIND_MONTHLY:
    numDays = 30;
    break;

  case aeConst.BACKUP_REMIND_WEEKLY:
  default:
    numDays = 7;
    break;
  }

  if (diff.days >= numDays || prefs._forceShowFirstTimeBkupNotif) {
    if (prefs.backupRemFirstRun) {
      info("Clippings/wx: showBackupNotification(): Showing first-time backup reminder.");

      await browser.notifications.create("backup-reminder-firstrun", {
        type: "basic",
        title: browser.i18n.getMessage("backupNotifyTitle"),
        message: browser.i18n.getMessage("backupNotifyFirstMsg"),
        iconUrl: "img/notifIcon.svg",
      });

      await aePrefs.setPrefs({
        backupRemFirstRun: false,
        backupRemFrequency: aeConst.BACKUP_REMIND_WEEKLY,
        lastBackupRemDate: new Date().toString(),
      });

      if (prefs._forceShowFirstTimeBkupNotif) {
        aePrefs.setPrefs({_forceShowFirstTimeBkupNotif: false});
      }
    }
    else {
      info("Clippings/wx: showBackupNotification(): Last backup reminder: " + prefs.lastBackupRemDate);

      if (prefs.skipBackupRemIfUnchg && prefs.clippingsUnchanged) {
        log("Clippings/wx: No changes to clippings since last backup; skipping backup notification.");
      }
      else {
        await browser.notifications.create("backup-reminder", {
          type: "basic",
          title: browser.i18n.getMessage("backupNotifyTitle"),
          message: browser.i18n.getMessage("backupNotifyMsg"),
          iconUrl: "img/notifIcon.svg",
        });

        aePrefs.setPrefs({lastBackupRemDate: new Date().toString()});
      }
    }
  }
}   


function setBackupNotificationInterval()
{
  log("Clippings/wx: Setting backup notification interval (every 15 minutes).");

  browser.alarms.create("show-backup-notifcn", {
    periodInMinutes: aeConst.DEFAULT_ALARM_INTERVAL_MINS,
  });
}


async function clearBackupNotificationInterval()
{
  log("Clippings/wx: Clearing backup notification interval.");
  await browser.alarms.clear("show-backup-notifcn");
}


async function setFirstWhatsNewNotificationDelay()
{
  log("Clippings/wx: Turning on post-update notification.");
  await aePrefs.setPrefs({
    upgradeNotifCount: aeConst.MAX_NUM_POST_UPGRADE_NOTIFICNS,
    lastWhatsNewNotifcnDate: null,
  });

  // Show post-update notification in 1 minute.
  browser.alarms.create("show-upgrade-notifcn", {
    delayInMinutes: aeConst.POST_UPGRADE_NOTIFCN_DELAY_MS / 60000,
    periodInMinutes: aeConst.DEFAULT_ALARM_INTERVAL_MINS,
  });
}


async function showWhatsNewNotification()
{
  let prefs = await aePrefs.getAllPrefs();

  // Workaround to alarm sometimes not clearing.
  if (prefs.upgradeNotifCount <= 0) {
    let alarm = await browser.alarms.get("show-upgrade-notifcn");
    if (!!alarm) {
      warn("Clippings: showWhatsNewNotification(): Alarm failed to clear.  Attempting to clear it again and resetting prefs.");

      let isCleared = await browser.alarms.clear("show-upgrade-notifcn");
      if (! isCleared) {
        warn(`Alarm "show-upgrade-notifcn" is still active and NOT cleared.`);
      }
      await aePrefs.setPrefs({
        upgradeNotifCount: 0,
        lastWhatsNewNotifcnDate: null,
      });
    }
    return;
  }

  let today = new Date();
  let lastWhatsNewNotifcnDate = prefs.lastWhatsNewNotifcnDate;
  if (typeof lastWhatsNewNotifcnDate == "string") {
    lastWhatsNewNotifcnDate = new Date(prefs.lastWhatsNewNotifcnDate);

    log(`Clippings: showWhatsNewNotification(): Date of last post-upgrade notification: ${lastWhatsNewNotifcnDate}\nNumber of post-upgrade notification occurrences remaining: ${prefs.upgradeNotifCount}`);
  }
  else {
    // Default to the start of the Unix epoch to force notification to appear.
    lastWhatsNewNotifcnDate = new Date(0);

    log("Clippings: showWhatsNewNotification(): Forcing post-upgrade notification to appear.");
  }

  let diff = new aeDateDiff(today, lastWhatsNewNotifcnDate);
  if (diff.days >= aeConst.POST_UPGRADE_NOTIFCN_FREQ_DAYS) {
    log("Clippings/wx: Showing post-update notification.");

    let extName = browser.i18n.getMessage("extName");
    await browser.notifications.create("whats-new", {
      type: "basic",
      title: extName,
      message: browser.i18n.getMessage("upgradeNotifcn", extName),
      iconUrl: "img/notifIcon.svg",
    });

    let upgradeNotifCount = Number(prefs.upgradeNotifCount) - 1;
    if (upgradeNotifCount == 0) {
      // Maximum number of occurrences is reached.
      log("Maximum number of notification occurrences has been reached.");
      lastWhatsNewNotifcnDate = null;
      let isCleared = await browser.alarms.clear("show-upgrade-notifcn");
      if (! isCleared) {
        warn(`Alarm "show-upgrade-notifcn" was NOT cleared.`);
      }
    }
    else {
      log(`There are now ${upgradeNotifCount} notification occurrences remaining.`);
      lastWhatsNewNotifcnDate = new Date().toString();
    }
    
    aePrefs.setPrefs({
      upgradeNotifCount,
      lastWhatsNewNotifcnDate,
    });
  }
}


async function setSyncHelperUpdateNotificationDelay(aEnableNotifcn)
{
  log("Clippings: setSyncHelperUpdateNotificationDelay(): " + aEnableNotifcn);

  if (aEnableNotifcn) {
    // Check for updates to Sync Clippings Helper native app in 10 minutes.
    browser.alarms.create("show-sync-helper-upd-notifcn", {
      delayInMinutes: aeConst.SYNC_HELPER_CHECK_UPDATE_DELAY_MS / 60000
    });

    let lastSyncHelperUpdChkDate = await aePrefs.getPref("lastSyncHelperUpdChkDate");
    if (! lastSyncHelperUpdChkDate) {
      // Sync Clippings Helper app update check was just turned on.
      // Default to the start of the Unix epoch to force app update check.
      await aePrefs.setPrefs({lastSyncHelperUpdChkDate: new Date(0).toString()});
    }
  }
  else {
    await browser.alarms.clear("show-sync-helper-upd-notifcn");
    await aePrefs.setPrefs({lastSyncHelperUpdChkDate: null});
  }
}


async function showSyncHelperUpdateNotification()
{
  let prefs = await aePrefs.getAllPrefs();
  if (!prefs.syncClippings || !prefs.syncHelperCheckUpdates) {
    return;
  }

  // Don't bother proceeding if the native messaging optional permission
  // wasn't granted.
  let perms = await browser.permissions.getAll();
  if (! perms.permissions.includes("nativeMessaging")) {
    return;
  }

  log("Clippings: showSyncHelperUpdateNotification(): Last update check: " + prefs.lastSyncHelperUpdChkDate);
  
  let today, lastUpdateCheck, diff;
  if (prefs.lastSyncHelperUpdChkDate) {
    today = new Date();
    lastUpdateCheck = new Date(prefs.lastSyncHelperUpdChkDate);
    diff = new aeDateDiff(today, lastUpdateCheck);
  }

  if (!prefs.lastSyncHelperUpdChkDate || diff.days >= aeConst.SYNC_HELPER_CHECK_UPDATE_FREQ_DAYS) {
    let currVer = "";
    let natMsg = {msgID: "get-app-version"};
    let resp;
    try {
      resp = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, natMsg);
    }
    catch (e) {
      console.error("Clippings/wx: showSyncHelperUpdateNotification(): Unable to connect to Sync Clippings Helper App\n" + e);
      return;
    }
    
    currVer = resp.appVersion;
    log("Clippings/wx: showSyncHelperUpdateNotification(): Current version of the Sync Clippings Helper app: " + currVer);

    let fetchResp;
    try {
      fetchResp = await fetch(aeConst.SYNC_HELPER_CHECK_UPDATE_URL);
    }
    catch (e) {
      console.error("Clippings/wx: showSyncHelperUpdateNotification(): Unable to check for updates to the Sync Clippings Helper app at this time.\n" + e);
      return;
    }

    if (! fetchResp.ok) {
      console.error(`Clippings/wx: showSyncHelperUpdateNotification(): HTTP status ${fetchResp.status} (${fetchResp.statusText}) received from URL ${fetchResp.url}`);
      return;
    }
    
    let updateInfo = await fetchResp.json();

    if (aeVersionCmp(currVer, updateInfo.latestVersion) < 0) {
      info(`Clippings/wx: showSyncHelperUpdateNotification(): Found a newer version of Sync Clippings Helper!  Current version: ${currVer}; new version found: ${updateInfo.latestVersion}`);
      
      await aePrefs.setPrefs({
        _syncClippingsHelperDwnldPgURL: updateInfo.downloadPageURL,
        lastSyncHelperUpdChkDate: new Date().toString(),
      });

      browser.notifications.create("sync-helper-update", {
        type: "basic",
        title: browser.i18n.getMessage("syncUpdateTitle"),
        message: browser.i18n.getMessage("syncUpdateMsg"),
        iconUrl: "img/syncClippingsApp.svg",
      });
    }
    else {
      await aePrefs.setPrefs({lastSyncHelperUpdChkDate: new Date().toString()});
    }
  }
}


async function openWelcomePage()
{
  let url = browser.runtime.getURL("pages/welcome.html");
  let tab = await browser.tabs.create({url});
}


async function openClippingsManager(aBackupMode)
{
  let prefs = await aePrefs.getAllPrefs();
  let clippingsMgrURL = browser.runtime.getURL("pages/clippingsMgr.html");

  let wnd = await browser.windows.getCurrent();
  clippingsMgrURL += "?openerWndID=" + wnd.id;

  if (aBackupMode) {
    clippingsMgrURL += "&backupMode=1";
  }
  
  async function openClippingsMgrHelper()
  {
    let width = 760;
    let height = 410;
    let topOffset = 200;
    let left, top;
    let wndGeom = prefs.clippingsMgrWndGeom;
    let [tab] = await browser.tabs.query({currentWindow: true, discarded: false});

    if (prefs.clippingsMgrSaveWndGeom && wndGeom) {
      width  = wndGeom.w - 1;  // Compensate for workaround to popup window bug.
      height = wndGeom.h;
      left   = wndGeom.x;
      top    = wndGeom.y;
    }
    else {
      if (prefs.autoAdjustWndPos) {
        wndGeom = await getWndGeometryFromBrwsTab(tab.id);
        log("Clippings/wx: openClippingsManager() > openClippingsMgrHelper(): Calculating initial geometry of Clippings Manager. Retrieved window geometry of browser window:");
        log(wndGeom);

        if (wndGeom) {
          if (wndGeom.w < width) {
            left = null;
          }
          else {
            left = Math.ceil((wndGeom.w - width) / 2) + wndGeom.x;
          }

          if ((wndGeom.h + topOffset) < height) {
            top = null;
          }
          else {
            top = wndGeom.y + topOffset;
          }
        }
        else {
          left = 64;
          top = 128;
        }
      }
      else {
        left = Math.ceil((window.screen.availWidth - width) / 2);
        top = Math.ceil((window.screen.availHeight - height) / 2);
      }
    }
    
    let wndInfo = {
      url: clippingsMgrURL,
      type: "popup",
      width, height,
      left, top
    };

    let wnd = await browser.windows.create(wndInfo);
    let wndIDs = await aePrefs.getPref("_wndIDs");
    wndIDs.clippingsMgr = wnd.id;
    aePrefs.setPrefs({_wndIDs: wndIDs});

    // Workaround to bug where window position isn't set when calling
    // `browser.windows.create()`. If unable to get window geometry, then
    // default to centering on screen.
    if (wndGeom) {
      browser.windows.update(wnd.id, {left, top});
    }
  }
  // END nested function

  let wndIDs = await aePrefs.getPref("_wndIDs");
  if (wndIDs.clippingsMgr) {
    try {
      let wnd = await browser.windows.get(wndIDs.clippingsMgr);
      browser.windows.update(wndIDs.clippingsMgr, {focused: true});
    }
    catch {
      // Handle dangling ref to previously-closed Clippings Manager window
      // because it was closed before it finished initializing.
      wndIDs.clippingsMgr = null;
      aePrefs.setPrefs({_wndIDs: wndIDs});
      openClippingsMgrHelper();
    }
  }
  else {
    openClippingsMgrHelper();
  }
}


async function newClipping(aActiveTab)
{
  if (aActiveTab.status == "loading") {
    console.warn("Clippings/wx: The active tab (ID = %s) is still loading or busy. Messages sent to it now may not receive a response.", aActiveTab.id);
  }
  
  log("Clippings/wx: Extension sending message \"new-clipping\" to content script; active tab ID: " + aActiveTab.id);

  let resp;
  try {
    resp = await browser.tabs.sendMessage(aActiveTab.id, {msgID: "new-clipping"});
  }
  catch (e) {
    alertEx("msgRetryPgNotLoaded");
    return;
  }

  if (! resp) {
    // This may occur when the "new-clipping" message was sent to an <iframe>
    // containing an <input type="text"> or <textarea> element, in which case
    // it is safe to ignore.
    return;
  }

  let content;
  if (resp.content) {
    content = resp.content;
  }
  else {
    alertEx("msgNoTextSel");
    return;
  }

  let name = aeClippings.createClippingNameFromText(content);
  let url = aActiveTab.url;
  gNewClipping.set({name, content, url});

  let platform = await browser.runtime.getPlatformInfo();
  openNewClippingDlg(platform.os, aActiveTab.id);
}


function openNewClippingDlg(aPlatformOS, aTabID)
{
  let url = browser.runtime.getURL("pages/new.html");
  let height = 410;
  if (aPlatformOS == "win") {
    height = 434;
  }
  openDlgWnd(url, "newClipping", {type: "popup", width: 432, height}, aTabID);
}


function getNewClippingData()
{
  let rv = null;
  let newClipping = gNewClipping.get();
  if (newClipping !== null) {
    rv = newClipping;
  }

  return rv;
}


function openKeyboardPasteDlg(aTabID)
{
  // TO DO: Check first if the cursor is in a web page textbox or HTML editor.
  // If not, then don't do anything.

  let url = browser.runtime.getURL("pages/keyboardPaste.html?tabID=" + aTabID);
  let wndPpty = {
    type: "popup",
    width: 500,
    height: 164,
    topOffset: 256,
  };
  openDlgWnd(url, "keyboardPaste", wndPpty, aTabID);
}


function openPlaceholderPromptDlg(aTabID, aDlgMode)
{
  // TO DO: Same checking for cursor location as in the preceding function.

  let url = browser.runtime.getURL(`pages/placeholderPrompt.html?tabID=${aTabID}&mode=${aDlgMode}`);
  let wndPpty = {
    type: "popup",
    width: 536,
    height: 228,
    topOffset: 256,
  };

  openDlgWnd(url, "placeholderPrmt", wndPpty, aTabID, (aDlgMode > 0));
}


async function openBackupDlg()
{
  let url = browser.runtime.getURL("pages/backup.html");
  let lang = browser.i18n.getUILanguage();
  let height = 412;
  let platform = await browser.runtime.getPlatformInfo();

  if (lang == "uk" || (lang == "fr" && platform.os == "mac")) {
    height = 450;
  }
  
  openDlgWnd(url, "backupFirstRun", {type: "popup", width: 590, height});
}


async function openSidebarHelpDlg()
{
  let url = browser.runtime.getURL("pages/sidebarHelp.html");
  let height = 406;
  let platform = await browser.runtime.getPlatformInfo();

  if (platform.os == "mac") {
    height = 404;
  }

  let wndPpty = {
    type: "popup",
    width: 600,
    height,
  };

  openDlgWnd(url, "sidebarHlp", wndPpty);
}


async function openDlgWnd(aURL, aWndKey, aWndPpty, aTabID=null, aAlwaysCalcWndPosFromBrwsWnd=false)
{
  if (! aTabID) {
    let [tab] = await browser.tabs.query({currentWindow: true, discarded: false});
    aTabID = tab.id;    
  }

  if (aAlwaysCalcWndPosFromBrwsWnd) {
    // Get the window ID of the browser window. If there are multiple browser
    // windows open, get the window ID of the first one.
    let wnds = await browser.windows.getAll({windowTypes: ["normal"]});

    if (wnds.length > 0) {
      let tabs = await browser.tabs.query({
        discarded: false,
        windowId: wnds[0].id,
      });
      if (tabs.length > 0) {
        aTabID = tabs[0].id;
      }
    }
    else {
      // If no browser windows are open, then position dialog relative to the
      // screen (see helper function below).
      aTabID = null;
    }
  }

  async function openDlgWndHelper()
  {
    let autoAdjustWndPos = await aePrefs.getPref("autoAdjustWndPos");
    let width = aWndPpty.width;
    let height = aWndPpty.height;
    let left, top, wndGeom;

    if (autoAdjustWndPos && typeof aTabID == "number") {
      wndGeom = await getWndGeometryFromBrwsTab(aTabID);
      log("Clippings/wx: openDlgWnd() > openDlgWndHelper(): Window geometry of browser window:");
      log(wndGeom);
      
      let topOffset = aWndPpty.topOffset ?? 200;

      if (wndGeom) {
        if (wndGeom.w < width) {
          left = null;
        }
        else {
          left = Math.ceil((wndGeom.w - width) / 2) + wndGeom.x;
        }

        if ((wndGeom.h + topOffset) < height) {
          top = null;
        }
        else {
          top = wndGeom.y + topOffset;
        }
      }
      else {
        left = 64;
        top = 128;
      }
    }
    else {
      left = Math.ceil((window.screen.availWidth - width) / 2);
      top = Math.ceil((window.screen.availHeight - height) / 2);
    }

    log(`Opening popup window at coordinates (${left}, ${top}); screen size: width ${window.screen.availWidth}; height ${window.screen.availHeight}`);

    let wnd = await browser.windows.create({
      url: aURL,
      type: aWndPpty.type,
      width, height,
      left, top,
    });

    let wndIDs = await aePrefs.getPref("_wndIDs");
    wndIDs[aWndKey] = wnd.id;
    aePrefs.setPrefs({_wndIDs: wndIDs});

    // Workaround to bug where window position isn't set when calling
    // `browser.windows.create()`. If unable to get window geometry, then
    // default to centering on screen.
    if (wndGeom) {
      browser.windows.update(wnd.id, {left, top});
    }
  }
  // END nested function

  let wndIDs = await aePrefs.getPref("_wndIDs");
  if (wndIDs[aWndKey]) {
    try {
      await browser.windows.get(wndIDs[aWndKey]);
      browser.windows.update(wndIDs[aWndKey], {focused: true});
    }
    catch (e) {
      wndIDs[aWndKey] = null;
      aePrefs.setPrefs({_wndIDs: wndIDs});
      openDlgWndHelper();
    };
  }
  else {
    openDlgWndHelper();
  }
}


async function getWndGeometryFromBrwsTab(aTabID)
{
  let rv = null;
  let tab = await browser.tabs.get(aTabID);
  let wnd = await browser.windows.get(tab.windowId);
  
  rv = {
    w: wnd.width,
    h: wnd.height,
    x: wnd.left,
    y: wnd.top
  };

  return rv;
}


function copyClippingText(aClippingID, aCopyMode)
{
  log("Clippings: copyClippingText(): Copy mode (1=copy as HTML-formatted, 2=copy as plain with HTML, 3=copy as plain): " + aCopyMode);
  pasteOrCopyClippingByID(aClippingID, true, null, aCopyMode);
}


function pasteClippingByID(aClippingID, aIsExternalRequest, aTabID)
{
  pasteOrCopyClippingByID(aClippingID, aIsExternalRequest, aTabID, pasteOrCopyClippingByID.MODE_PASTE);
}


function pasteOrCopyClippingByID(aClippingID, aIsExternalRequest, aTabID, aMode)
{
  let clippingsDB = aeClippings.getDB();

  clippingsDB.transaction("r", clippingsDB.clippings, clippingsDB.folders, () => {
    let clipping = null;
    
    clippingsDB.clippings.get(aClippingID).then(aClipping => {
      if (! aClipping) {
        throw new Error("Cannot find clipping with ID = " + aClippingID);
      }

      if (aClipping.parentFolderID == -1) {
        throw new Error("Attempting to copy or paste a deleted clipping!");
      }

      clipping = aClipping;
      log(`Copying/pasting the clipping named "${clipping.name}"\nid = ${clipping.id}`);
        
      return clippingsDB.folders.get(aClipping.parentFolderID);
    }).then(aFolder => {
      let parentFldrName = "";
      if (aFolder) {
        parentFldrName = aFolder.name;
      }
      else {
        parentFldrName = ROOT_FOLDER_NAME;
      }
      let clippingInfo = {
        id: clipping.id,
        name: clipping.name,
        text: clipping.content,
        parentFolderName: parentFldrName
      };

      processClipping(clippingInfo, aIsExternalRequest, aTabID, aMode);
    });
  }).catch(aErr => {
    console.error("Clippings/wx: pasteOrCopyClippingByID(): " + aErr);
  });
}
pasteOrCopyClippingByID.MODE_PASTE = 0;


function pasteClippingByShortcutKey(aShortcutKey, aTabID)
{
  let clippingsDB = aeClippings.getDB();

  clippingsDB.transaction("r", clippingsDB.clippings, clippingsDB.folders, () => {
    let results = clippingsDB.clippings.where("shortcutKey").equals(aShortcutKey.toUpperCase());
    let clipping = {};
    
    results.first().then(aClipping => {
      if (! aClipping) {
        log(`Cannot find clipping with shortcut key '${aShortcutKey}'`);
        return null;
      }

      if (aClipping.parentFolderID == -1) {
        throw new Error(`Shortcut key '${aShortcutKey}' is assigned to a deleted clipping!`);
      }

      clipping = aClipping;
      log(`Pasting clipping named "${clipping.name}"\nid = ${clipping.id}`);

      return clippingsDB.folders.get(aClipping.parentFolderID);
    }).then(aFolder => {
      if (aFolder === null) {
        return;
      }

      let parentFldrName = "";

      if (aFolder) {
        parentFldrName = aFolder.name;
      }
      else {
        parentFldrName = ROOT_FOLDER_NAME;
      }
      let clippingInfo = {
        id: clipping.id,
        name: clipping.name,
        text: clipping.content,
        parentFolderName: parentFldrName
      };

      processClipping(clippingInfo, false, aTabID, pasteOrCopyClippingByID.MODE_PASTE);
    });
  }).catch(aErr => {
    console.error("Clippings/wx: pasteClippingByShortcutKey(): " + aErr);
  });
}


async function processClipping(aClippingInfo, aIsExternalRequest, aTabID, aMode)
{
  let activeTabID = aTabID;
  if (aIsExternalRequest) {
    let [tab] = await browser.tabs.query({active: true, lastFocusedWindow: true});
    if (! tab) {
      // This should never happen...
      alertEx("msgNoActvBrwsTab");
      return;
    }
    activeTabID = tab.id;
  }

  let processedCtnt = "";
  log("Clippings/wx: processClipping(): Active tab ID: " + activeTabID);

  let autoIncrPlcHldrStartVal = await aePrefs.getPref("autoIncrPlcHldrStartVal");
  await aeClippingSubst.init(navigator.userAgent, autoIncrPlcHldrStartVal);

  if (aeClippingSubst.hasNoSubstFlag(aClippingInfo.name)) {
    processedCtnt = aClippingInfo.text;
  }
  else {
    processedCtnt = await aeClippingSubst.processStdPlaceholders(aClippingInfo);
    let failedPlchldrs = aeClippingSubst.getFailedPlaceholders();
    if (failedPlchldrs.length > 0) {
      // TO DO: Show dialog giving the user the option to edit the clipping in
      // Clippings Manager, paste anyway, or cancel.
      warn(`Clipping: ${aClippingInfo.name}\nOne or more placeholders could not be filled in.`);
      log(failedPlchldrs.toString());
    }

    let autoIncrPlchldrs = aeClippingSubst.getAutoIncrPlaceholders(processedCtnt);
    if (autoIncrPlchldrs.length > 0) {
      buildAutoIncrementPlchldrResetMenu(autoIncrPlchldrs);
      processedCtnt = await aeClippingSubst.processAutoIncrPlaceholders(processedCtnt);
      await aeClippingSubst.saveAutoIncrementVars();
    }

    let plchldrs = aeClippingSubst.getCustomPlaceholders(processedCtnt);
    if (plchldrs.length > 0) {
      let plchldrsWithDefaultVals = aeClippingSubst.getCustomPlaceholderDefaultVals(processedCtnt, aClippingInfo);
      gPlaceholders.set(aClippingInfo.name, plchldrs, plchldrsWithDefaultVals, processedCtnt);

      openPlaceholderPromptDlg(activeTabID, aMode);
      return;
    }
  }

  if (aMode == pasteOrCopyClippingByID.MODE_PASTE) {
    await pasteProcessedClipping(processedCtnt, activeTabID);
  }
  else {
    await copyProcessedClipping(processedCtnt, aMode);
  }
}


async function pasteProcessedClipping(aClippingContent, aTabID)
{
  // Focus the target window and tab to ensure that the clipping is
  // successfully pasted into the web page.
  let tab;
  try {
    tab = await browser.tabs.get(aTabID);
  }
  catch (e) {
    // Browser tab was closed.
    warn("Clippings/wx: pasteProcessedClipping(): Can't find browser tab " + aTabID);
    return;
  }
  await browser.windows.update(tab.windowId, {focused: true});

  let prefs = await aePrefs.getAllPrefs();
  let msg = {
    msgID: "paste-clipping",
    content: aClippingContent,
    htmlPaste: prefs.htmlPaste,
    autoLineBreak: prefs.autoLineBreak,
    dispatchInputEvent: prefs.dispatchInputEvent,
    useInsertHTMLCmd: prefs.useInsertHTMLCmd,
  };

  log(`Clippings/wx: Extension sending message "paste-clipping" to content script (active tab ID = ${aTabID})`);
  log(msg);
  
  await browser.tabs.sendMessage(aTabID, msg);
}


async function copyProcessedClipping(aClippingContent, aCopyMode)
{
  let type = "text/plain";
  if (aCopyMode == aeConst.COPY_AS_HTML) {
    type = "text/html";

    let autoLineBreak = await aePrefs.getPref("autoLineBreak");
    let hasLineBreakTags = aClippingContent.search(/<br|<p/i) != -1;
    if (autoLineBreak && !hasLineBreakTags) {
      aClippingContent = aClippingContent.replace(/\n/g, "<br>");
    }
  }
  else if (aCopyMode == aeConst.COPY_AS_PLAIN && aeClippings.hasHTMLTags(aClippingContent)) {
    let isConvFailed = false;
    try {
      aClippingContent = jQuery(aClippingContent).text();
    }
    catch (e) {
      // Clipping text may contain partial HTML. Try again by enclosing the
      // content in HTML tags.
      isConvFailed = true;
    }

    if (isConvFailed) {
      let content = "<div>" + aClippingContent + "</div>";
      try {
        aClippingContent = jQuery(content).text();
      }
      catch (e) {
        // Clipping text contains unrecognized markup, e.g. PHP or ASP.net tags.
        // In this case, keep the clipping content intact.
        console.warn("Clippings: copyProcessedClipping(): Unable to strip HTML tags from clipping content!\n" + e);
      }
    }
  }
  
  let blob = new Blob([aClippingContent], {type});
  let data = [new ClipboardItem({[type]: blob})];
  try {
    await navigator.clipboard.write(data);
  }
  catch (e) {
    console.warn("Clippings: copyProcessedClipping(): Error copying clipping to clipboard\n" + e);
  }
}


async function openSyncClippingsDownloadPage()
{
  let syncClippingsHelperDwnldPgURL = await aePrefs.getPref("_syncClippingsHelperDwnldPgURL");
  browser.tabs.create({url: syncClippingsHelperDwnldPgURL});
}


function showSyncAppErrorNotification()
{
  browser.notifications.create("sync-error", {
    type: "basic",
    title: browser.i18n.getMessage("syncStartupFailedHdg"),
    message: browser.i18n.getMessage("syncStartupFailed"),
    iconUrl: aeVisual.getErrorIconPath(),
  });
}


function showSyncReadErrorNotification()
{
  browser.notifications.create("sync-read-error", {
    type: "basic",
    title: browser.i18n.getMessage("syncStartupFailedHdg"),
    message: browser.i18n.getMessage("syncGetFailed"),
    iconUrl: aeVisual.getErrorIconPath(),
  });
}


function showSyncPushReadOnlyNotification()
{
  browser.notifications.create("sync-push-read-only-error", {
    type: "basic",
    title: browser.i18n.getMessage("syncStartupFailedHdg"),
    message: browser.i18n.getMessage("syncFldrRdOnly"),
    iconUrl: aeVisual.getErrorIconPath(),
  });
}


function showNoNativeMsgPermNotification()
{
  browser.notifications.create("native-msg-perm-error", {
    type: "basic",
    title: browser.i18n.getMessage("syncStartupFailedHdg"),
    message: browser.i18n.getMessage("syncPermNotif"),
    iconUrl: aeVisual.getErrorIconPath(),
  });
}


//
// Utility functions
//

function sanitizeMenuTitle(aTitle)
{
  // Escape the ampersand character, which would normally be used to denote
  // the access key for the menu item.
  let rv = aTitle.replace(/&/g, "&&");

  return rv;
}


async function alertEx(aMessageName, aUsePopupWnd=false)
{
  let message = browser.i18n.getMessage(aMessageName);
  info("Clippings/wx: " + message);

  let prefs = await aePrefs.getAllPrefs();
  let [tab] = await browser.tabs.query({active: true, currentWindow: true});
  let url = "pages/msgbox.html?msgid=" + aMessageName;

  // Center the common message box popup within originating browser window,
  // both horizontally and vertically.
  let wndGeom = null;
  let width = 520;
  let height = 170;

  // Default popup window coords.  Unless replaced by window geometry calcs,
  // these coords will be ignored - popup window will always be centered
  // on screen due to a WebExtension API bug; see next comment.
  let left = 256;
  let top = 64;

  if (prefs.autoAdjustWndPos) {
    wndGeom = await getWndGeometryFromBrwsTab(tab.id);

    if (wndGeom) {
      if (wndGeom.w < width) {
        left = null;
      }
      else {
        left = Math.ceil((wndGeom.w - width) / 2) + wndGeom.x;
      }

      if ((wndGeom.h) < height) {
        top = null;
      }
      else {
        top = Math.ceil((wndGeom.h - height) / 2) + wndGeom.y;
      }
    }
  }

  let wndKey = "ae_clippings_msgbox";
  let wnd = await browser.windows.create({
    url,
    type: "popup",
    width, height,
    left, top,
  });

  let wndIDs = prefs._wndIDs;
  wndIDs[wndKey] = wnd.id;
  aePrefs.setPrefs({_wndIDs: wndIDs});

  // Workaround to bug where window position isn't correctly set when calling
  // `browser.windows.create()`. If unable to get window geometry, then default
  // to centering on screen.
  if (wndGeom) {
    browser.windows.update(wnd.id, {left, top});
  }
}


async function resetWndID(aWndID)
{
  let wndIDs = await aePrefs.getPref("_wndIDs");
  wndIDs[aWndID] = null;
  await aePrefs.setPrefs({_wndIDs: wndIDs});
}



//
// Event handlers
//

browser.action.onClicked.addListener(aTab => {
  let browserAction = localStorage.getItem("browserAction");
  if (browserAction == aeConst.BRWSACT_OPEN_CLIPPINGS_MGR) {
    openClippingsManager();
  }
  else if (browserAction == aeConst.BRWSACT_OPEN_SIDEBAR) {
    browser.sidebarAction.toggle();
  }
});


browser.commands.onCommand.addListener(async (aCmdName, aTab) => {
  info(`Clippings/wx: Command "${aCmdName}" invoked!`);

  let keyboardPaste = await aePrefs.getPref("keyboardPaste");

  if (aCmdName == "ae-clippings-paste-clipping" && keyboardPaste) {
    log(`Clippings/wx: Active tab ID: ${aTab.id} - opening keyboard paste dialog.`);
    openKeyboardPasteDlg(aTab.id);
  }
});


browser.menus.onClicked.addListener(async (aInfo, aTab) => {
  switch (aInfo.menuItemId) {
  case "ae-clippings-new":
    newClipping(aTab);
    break;

  case "ae-clippings-manager":
    openClippingsManager();
    break;

  case "ae-clippings-prefs":
    browser.runtime.openOptionsPage();
    break;

  default:
    if (aInfo.menuItemId.startsWith("ae-clippings-clipping-")) {
      let id = Number(aInfo.menuItemId.substring(aInfo.menuItemId.lastIndexOf("-") + 1, aInfo.menuItemId.indexOf("_")));
      pasteClippingByID(id, false, aTab.id);
    }
    else if (aInfo.menuItemId.startsWith("ae-clippings-reset-autoincr-")) {
      let plchldr = aInfo.menuItemId.substr(28);
      resetAutoIncrPlaceholder(plchldr);
    }
    break;
  }
});


browser.alarms.onAlarm.addListener(aAlarm => {
  info(`Clippings/wx: Alarm "${aAlarm.name}" was triggered.`);

  switch (aAlarm.name) {
  case "show-backup-notifcn":
    showBackupNotification();
    break;

  case "show-sync-helper-upd-notifcn":
    showSyncHelperUpdateNotification();
    break;

  case "show-upgrade-notifcn":
    showWhatsNewNotification();
    break;

  default:
    break;
  }
});


browser.notifications.onClicked.addListener(aNotifID => {
  switch (aNotifID) {
  case "backup-reminder":
    // Open Clippings Manager in backup mode.
    openClippingsManager(true);
    break;

  case "backup-reminder-firstrun":
    openBackupDlg();
    break;

  case "sync-helper-update":
    openSyncClippingsDownloadPage();
    break;

  case "whats-new":
    browser.tabs.create({url: browser.runtime.getURL("pages/whatsnew.html")});
    aePrefs.setPrefs({
      upgradeNotifCount: 0,
      lastWhatsNewNotifcnDate: null,
    });
    break;

  default:
    break;
  }
});
  

browser.storage.onChanged.addListener((aChanges, aAreaName) => {
  let changedPrefs = Object.keys(aChanges);

  for (let pref of changedPrefs) {
    if (pref == "autoIncrPlcHldrStartVal") {
      aeClippingSubst.setAutoIncrementStartValue(aChanges[pref].newValue);
    }
    else if (pref == "browserAction") {
      localStorage.setItem("browserAction", aChanges[pref].newValue);
    }
  }
});


browser.runtime.onMessage.addListener(aRequest => {
  log(`Clippings/wx: Received message "${aRequest.msgID}"`);
  
  switch (aRequest.msgID) {
  case "init-new-clipping-dlg":
    return Promise.resolve(getNewClippingData());
    break;

  case "init-placeholder-prmt-dlg":
    return Promise.resolve(gPlaceholders.get());

  case "close-new-clipping-dlg":
    resetWndID("newClipping");
    break;

  case "open-clippings-mgr":
    openClippingsManager(false);
    break;

  case "close-clippings-mgr-wnd":
    resetWndID("clippingsMgr");
    break;

  case "close-keybd-paste-dlg":
    resetWndID("keyboardPaste");
    break;

  case "paste-shortcut-key":
    if (! aRequest.shortcutKey) {
      return;
    }
    log(`Clippings/wx: Key '${aRequest.shortcutKey}' was pressed.`);
    pasteClippingByShortcutKey(aRequest.shortcutKey, aRequest.browserTabID);
    break;

  case "paste-clipping-by-name":
    pasteClippingByID(aRequest.clippingID, aRequest.fromClippingsMgr, aRequest.browserTabID);
    break;

  case "paste-clipping-with-plchldrs":
    return Promise.resolve(pasteProcessedClipping(aRequest.processedContent, aRequest.browserTabID));

  case "copy-clipping":
    copyClippingText(aRequest.clippingID, aRequest.copyFormat);
    break;

  case "copy-clipping-with-plchldrs":
    return Promise.resolve(copyProcessedClipping(aRequest.processedContent, aRequest.copyMode));

  case "close-placeholder-prmt-dlg":
    resetWndID("placeholderPrmt");
    break;
    
  case "get-shct-key-prefix-ui-str":
    return Promise.resolve(getShortcutKeyPrefixStr());

  case "clear-backup-notifcn-intv":
    return clearBackupNotificationInterval();

  case "set-backup-notifcn-intv":
    setBackupNotificationInterval();
    break;

  case "backup-clippings":
    openClippingsManager(true);
    break;

  case "enable-sync-clippings":
    return enableSyncClippings(aRequest.isEnabled);

  case "refresh-synced-clippings":
    refreshSyncedClippings(aRequest.rebuildClippingsMenu).catch(aErr => {});
    break;
    
  case "push-sync-fldr-updates":
    return pushSyncFolderUpdates();

  case "purge-fldr-items":
    return purgeFolderItems(aRequest.folderID);
    
  case "rebuild-cxt-menu":
    return rebuildContextMenu();

  case "import-started":
    gClippingsListener.importStarted();
    break;

  case "import-finished":
    gClippingsListener.importFinished(aRequest.isSuccess);
    break;

  case "sync-deactivated":
    gSyncClippingsListener.onDeactivate(aRequest.oldSyncFolderID);
    break;

  case "sync-deactivated-after":
    gSyncClippingsListener.onAfterDeactivate(aRequest.removeSyncFolder, aRequest.oldSyncFolderID);
    break;

  case "set-sync-clippings-app-upd-chk":
    return setSyncHelperUpdateNotificationDelay(aRequest.enable);

  case "new-clipping-created":
    gClippingsListener.newClippingCreated(aRequest.newClippingID, aRequest.newClipping, aRequest.origin);
    break;

  case "new-folder-created":
    gClippingsListener.newFolderCreated(aRequest.newFolderID, aRequest.newFolder, aRequest.origin);
    break;

  case "clipping-changed":
    gClippingsListener.clippingChanged(aRequest.clippingID, aRequest.clippingData, aRequest.oldClippingData);
    break;
    
  case "folder-changed":
    gClippingsListener.folderChanged(aRequest.folderID, aRequest.folderData, aRequest.oldFolderData);
    break;

  case "copy-started":
    gClippingsListener.copyStarted();
    break;

  case "copy-finished":
    gClippingsListener.copyFinished(aRequest.itemCopyID);
    break;

  case "dnd-move-started":
    gClippingsListener.dndMoveStarted();
    break;

  case "dnd-move-finished":
    gClippingsListener.dndMoveFinished();
    break;

  case "open-sidebar-help":
    openSidebarHelpDlg();
    break;

  case "whats-new-pg-opened":
    browser.alarms.clear("show-upgrade-notifcn");
    gShowUpdateBanner = false;
    // Clearing the alarm may fail.  Reset prefs to their defaults to ensure
    // that the What's New notification doesn't appear unnecessarily.
    aePrefs.setPrefs({
      upgradeNotifCount: 0,
      lastWhatsNewNotifcnDate: null,
    });
    break;

  case "get-ver-update-info":
    let showBanner = false;
    if (gVerUpdateType && gShowUpdateBanner) {
      // Only show the sidebar post-update banner once.
      gShowUpdateBanner = false;
      showBanner = true;
    }
    return Promise.resolve({
      verUpdateType: gVerUpdateType,
      showBanner,
    });
    break;

  default:
    break;
  }
});


// Catch any unhandled promise rejections from 3rd-party libs
window.addEventListener("unhandledrejection", aEvent => {
  aEvent.preventDefault();
});


//
// Error reporting and debugging output
//

function onError(aError)
{
  console.error("Clippings/wx: " + aError);
}


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}


function info(aMessage)
{
  if (aeConst.DEBUG) { console.info(aMessage); }
}


function warn(aMessage)
{
  if (aeConst.DEBUG) { console.warn(aMessage); }
}
