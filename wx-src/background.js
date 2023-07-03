/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const ROOT_FOLDER_NAME = "clippings-root";

let gOS = null;
let gHostAppName = null;
let gHostAppVer;
let gAutoIncrPlchldrs = null;
let gClippingMenuItemIDMap = {};
let gFolderMenuItemIDMap = {};
let gSyncFldrID = null;
let gBackupRemIntervalID = null;
let gPasteClippingTargetTabID = null;
let gIsReloadingSyncFldr = false;
let gSyncClippingsHelperDwnldPgURL;
let gForceShowFirstTimeBkupNotif = false;
let gPrefersColorSchemeMedQry;
let gIsFirstRun = false;
let gIsMajorVerUpdate = false;

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

  onDeactivate(aOldSyncFolderID)
  {
    log("Clippings/wx: gSyncClippingsListener.onDeactivate()");

    if (gPrefs.cxtMenuSyncItemsOnly) {
      return;
    }
    
    let syncFldrMenuID = gFolderMenuItemIDMap[aOldSyncFolderID];

    // Change the icon on the "Synced Clippings" folder to be a normal
    // folder icon.
    let mnuIco = {
      icons: {
        16: "img/folder.svg"
      }
    };
    browser.menus.update(syncFldrMenuID, mnuIco);
  },

  onAfterDeactivate(aRemoveSyncFolder, aOldSyncFolderID)
  {
    function resetCxtMenuSyncItemsOnlyOpt(aRebuildCxtMenu) {
      if (gPrefs.cxtMenuSyncItemsOnly) {
        aePrefs.setPrefs({ cxtMenuSyncItemsOnly: false });
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
    let isStaticIDsAdded = await addStaticIDs(gSyncFldrID);

    if (isStaticIDsAdded) {
      log("Clippings/wx: gSyncClippingsListener.onReloadFinish(): Static IDs added to synced items.  Saving sync file.");
      await pushSyncFolderUpdates();
    }
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

let gWndIDs = {
  newClipping: null,
  keyboardPaste: null,
  placeholderPrmt: null,
  clippingsMgr: null
};

let gPrefs = null;
let gSetDisplayOrderOnRootItems = false;


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
    }
  }
});


//
// Browser window and Clippings menu initialization
//

void async function ()
{
  log("Clippings/wx: WebExtension startup initiated.");
  
  gPrefs = await aePrefs.getAllPrefs();
  log("Clippings/wx: Successfully retrieved user preferences:");
  log(gPrefs);

  // Check for and set user prefs (if not already set) from all previous
  // versions of Clippings.  This needs to be performed at every startup since
  // it is not possible to determine if this function is called after the
  // WebExtension is installed, updated, reloaded, or loaded during host app
  // startup.
  if (! aePrefs.hasUserPrefs(gPrefs)) {
    log("Initializing Clippings user preferences.");
    gIsFirstRun = true;
    await aePrefs.setUserPrefs(gPrefs);
  }

  if (! aePrefs.hasSanDiegoPrefs(gPrefs)) {
    gSetDisplayOrderOnRootItems = true;
    log("Initializing 6.1 user preferences.");
    await aePrefs.setSanDiegoPrefs(gPrefs);
  }

  if (! aePrefs.hasBalboaParkPrefs(gPrefs)) {
    gForceShowFirstTimeBkupNotif = true;
    log("Initializing 6.1.2 user preferences.");
    await aePrefs.setBalboaParkPrefs(gPrefs);
  }

  if (! aePrefs.hasMalibuPrefs(gPrefs)) {
    log("Initializing 6.2 user preferences.");
    await aePrefs.setMalibuPrefs(gPrefs);
  }
  
  if (! aePrefs.hasTopangaPrefs(gPrefs)) {
    log("Initializing 6.2.1 user preferences.");
    await aePrefs.setTopangaPrefs(gPrefs);
  }

  if (! aePrefs.hasHuntingdonPrefs(gPrefs)) {
    log("Initializing 6.3 user preferences.");
    await aePrefs.setHuntingdonPrefs(gPrefs);
  }

  if (! aePrefs.hasSanClementePrefs(gPrefs)) {
    // This should be set when updating to the latest release.
    gIsMajorVerUpdate = true;

    log("Initializing 6.4 user preferences.");
    await aePrefs.setSanClementePrefs(gPrefs);
  }

  if (gPrefs.clippingsMgrDetailsPane) {
    gPrefs.clippingsMgrAutoShowDetailsPane = false;
  }

  init();
}();


async function init()
{
  log("Clippings/wx: Initializing integration with host app...");
  
  aeClippings.init();

  let [brws, platform] = await Promise.all([
    browser.runtime.getBrowserInfo(),
    browser.runtime.getPlatformInfo(),
  ]);
  
  gHostAppName = brws.name;
  gHostAppVer = brws.version;
  log(`Clippings/wx: Host app: ${gHostAppName} (version ${gHostAppVer})`);

  gOS = platform.os;
  log("Clippings/wx: OS: " + gOS);

  if (gOS == "linux" && gPrefs.clippingsMgrMinzWhenInactv === null) {
    await aePrefs.setPrefs({ clippingsMgrMinzWhenInactv: true });
  }

  if (gPrefs.autoAdjustWndPos === null) {
    let autoAdjustWndPos = gOS == "win";
    let clippingsMgrSaveWndGeom = autoAdjustWndPos;
    await aePrefs.setPrefs({autoAdjustWndPos, clippingsMgrSaveWndGeom});
  }

  // Handle changes to Dark Mode system setting.
  gPrefersColorSchemeMedQry = window.matchMedia("(prefers-color-scheme: dark)");
  handlePrefersColorSchemeChange(gPrefersColorSchemeMedQry);
  gPrefersColorSchemeMedQry.addEventListener("change", handlePrefersColorSchemeChange);
  
  if (gPrefs.syncClippings) {
    gSyncFldrID = gPrefs.syncFolderID;

    // The context menu will be built when refreshing the sync data.
    refreshSyncedClippings(true);
  }
  else {
    buildContextMenu();
  }
  
  aeClippingSubst.init(navigator.userAgent, gPrefs.autoIncrPlcHldrStartVal);
  gAutoIncrPlchldrs = new Set();

  if (gPrefs.backupRemFirstRun && !gPrefs.lastBackupRemDate) {
    aePrefs.setPrefs({
      lastBackupRemDate: new Date().toString(),
    });
  }

  if (gIsMajorVerUpdate && !gIsFirstRun) {
    setWhatsNewNotificationDelay();
  }
  else {
    if (gPrefs.upgradeNotifCount > 0) {
      // Show post-update notification in 1 minute.
      browser.alarms.create("show-upgrade-notifcn", {
        delayInMinutes: aeConst.POST_UPGRADE_NOTIFCN_DELAY_MS / 60000
      });
    }
  }
      
  // Check in 5 minutes whether to show backup reminder notification.
  browser.alarms.create("show-backup-notifcn", {
    delayInMinutes: aeConst.BACKUP_REMINDER_DELAY_MS / 60000
  });

  if (gPrefs.syncClippings && gPrefs.syncHelperCheckUpdates) {
    // Check for updates to Sync Clippings Helper native app in 10 minutes.
    browser.alarms.create("show-sync-helper-upd-notifcn", {
      delayInMinutes: aeConst.SYNC_HELPER_CHECK_UPDATE_DELAY_MS / 60000
    });
  }

  if (gPrefs.tabModalMsgBox) {
    let tabs = await browser.tabs.query({});
    tabs.forEach(aTab => {initContentCSS(aTab.id)});
  }

  if (gPrefs.showWelcome) {
    openWelcomePage();
    aePrefs.setPrefs({showWelcome: false});
  }

  if (gSetDisplayOrderOnRootItems) {
    await setDisplayOrderOnRootItems();
    log("Clippings/wx: Display order on root folder items have been set.\nClippings initialization complete.");
  }
  else {
    log("Clippings/wx: Initialization complete.");   
  }
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

  if (aIsEnabled) {
    log("Clippings/wx: enableSyncClippings(): Turning ON");

    if (gSyncFldrID === null) {
      log("Clippings/wx: enableSyncClippings(): Creating the Synced Clippings folder."); 
      let syncFldr = {
        name: browser.i18n.getMessage("syncFldrName"),
        parentFolderID: aeConst.ROOT_FOLDER_ID,
        displayOrder: 0,
        isSync: true,
      };
      try {
        gSyncFldrID = await clippingsDB.folders.add(syncFldr);
      }
      catch (e) {
        console.error("Clippings/wx: enableSyncClippings(): Failed to create the Synced Clipping folder: " + e);
      }

      await aePrefs.setPrefs({ syncFolderID: gSyncFldrID });
      log("Clippings/wx: enableSyncClippings(): Synced Clippings folder ID: " + gSyncFldrID);
      return gSyncFldrID;
    }
  }
  else {
    log("Clippings/wx: enableSyncClippings(): Turning OFF");
    let oldSyncFldrID = gSyncFldrID;

    let numUpd = await clippingsDB.folders.update(gSyncFldrID, { isSync: undefined });
    await aePrefs.setPrefs({ syncFolderID: null });
    gSyncFldrID = null;
    return oldSyncFldrID;
  }
}


function refreshSyncedClippings(aRebuildClippingsMenu)
{
  log("Clippings/wx: refreshSyncedClippings(): Retrieving synced clippings from the Sync Clippings helper app...");

  let clippingsDB = aeClippings.getDB();
  let natMsg = {msgID: "get-synced-clippings"};
  let getSyncedClippings = browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, natMsg);
  let syncJSONData = "";

  getSyncedClippings.then(aResp => {
    if (aResp) {
      syncJSONData = aResp;
    }
    else {
      throw new Error("Clippings/wx: refreshSyncedClippings(): Response data from native app is invalid");
    }
    
    if (gSyncFldrID === null) {
      log("Clippings/wx: The Synced Clippings folder is missing. Creating it...");
      let syncFldr = {
        name: browser.i18n.getMessage("syncFldrName"),
        parentFolderID: aeConst.ROOT_FOLDER_ID,
        displayOrder: 0,
      };
      
      return clippingsDB.folders.add(syncFldr);
    }

    log("Clippings/wx: refreshSyncedClippings(): Synced Clippings folder ID: " + gSyncFldrID);
    return gSyncFldrID;

  }).then(aSyncFldrID => {
    if (gSyncFldrID === null) {
      gSyncFldrID = aSyncFldrID;
      log("Clippings/wx: Synced Clippings folder ID: " + gSyncFldrID);
      return aePrefs.setPrefs({ syncFolderID: gSyncFldrID });
    }
      
    gSyncClippingsListener.onReloadStart();

    log("Clippings/wx: Purging existing items in the Synced Clippings folder...");
    return purgeFolderItems(gSyncFldrID, true);

  }).then(() => {
    log("Clippings/wx: Importing clippings data from sync file...");

    // Method aeImportExport.importFromJSON() is asynchronous, so the import
    // may not yet be finished when this function has finished executing!
    aeImportExport.setDatabase(clippingsDB);
    aeImportExport.importFromJSON(syncJSONData, false, false, gSyncFldrID);

    setTimeout(function () {
      gSyncClippingsListener.onReloadFinish();
    }, gPrefs.afterSyncFldrReloadDelay);
    
  }).catch(aErr => {
    console.error("Clippings/wx: refreshSyncedClippings(): " + aErr);
    if (aErr == aeConst.SYNC_ERROR_CONXN_FAILED) {
      showSyncErrorNotification();
    }

    // Sync errors should not prevent building the Clippings menu on startup.
    if (aRebuildClippingsMenu) {
      buildContextMenu();
    }
  });
}


async function pushSyncFolderUpdates()
{
  if (!gPrefs.syncClippings || gSyncFldrID === null) {
    throw new Error("Sync Clippings is not turned on!");
  }
  
  let syncData = await aeImportExport.exportToJSON(true, true, gSyncFldrID, false, true);
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
  let isMacOS = getOS() == "mac";
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


function getContextMenuData(aFolderID)
{
  function fnSortMenuItems(aItem1, aItem2)
  {
    let rv = 0;
    if ("displayOrder" in aItem1 && "displayOrder" in aItem2) {
      rv = aItem1.displayOrder - aItem2.displayOrder;
    }
    return rv;    
  }

  function sanitizeMenuTitle(aTitle)
  {
    // Escape the ampersand character, which would normally be used to denote
    // the access key for the menu item.
    let rv = aTitle.replace(/&/g, "&&");

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
        if (aItem.id == gSyncFldrID) {
          // Firefox bug on macOS:
          // Dark Mode setting isn't applied to the browser context menu when
          // a Firefox dark color theme is used.
          if (getContextMenuData.isDarkMode) {
            iconPath = "img/synced-clippings-dk.svg";
          }
          else {
            iconPath = "img/synced-clippings.svg";
          }
        }
        submenuItemData.icons = { 16: iconPath };

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

        getContextMenuData(aItem.id).then(aSubmenuData => {
          aSubmenuData.sort(fnSortMenuItems);
          submenuItemData.submenuItems = aSubmenuData;
          rv.push(submenuItemData);
        });

      }).then(() => {
        return clippingsDB.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
          let menuItemID = "ae-clippings-clipping-" + aItem.id + "_" + Date.now();
          gClippingMenuItemIDMap[aItem.id] = menuItemID;

          let menuItemData = {
            id: menuItemID,
            title: sanitizeMenuTitle(aItem.name),
            icons: {
              16: "img/" + (aItem.label ? `clipping-${aItem.label}.svg` : "clipping.svg")
            },
          };

          if (! ("displayOrder" in aItem)) {
            menuItemData.displayOrder = 0;
          }
          else {
            menuItemData.displayOrder = aItem.displayOrder;
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


function buildContextMenu()
{
  log("Clippings/wx: buildContextMenu()");
  
  // Context menus for browser action button.
  browser.menus.create({
    id: "ae-clippings-reset-autoincr-plchldrs",
    title: browser.i18n.getMessage("baMenuResetAutoIncrPlaceholders"),
    enabled: false,
    contexts: ["browser_action"],
    documentUrlPatterns: ["<all_urls>"]
  });

  let prefsMnuStrKey = "mnuPrefs";
  if (gOS == "win") {
    prefsMnuStrKey = "mnuPrefsWin";
  }
  browser.menus.create({
    id: "ae-clippings-prefs",
    title: browser.i18n.getMessage(prefsMnuStrKey),
    contexts: ["browser_action"],
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
  if (gPrefs.syncClippings && gPrefs.cxtMenuSyncItemsOnly) {
    rootFldrID = gSyncFldrID;
  }

  getContextMenuData(rootFldrID).then(aMenuData => {
    if (aeConst.DEBUG) {
      console.log("buildContextMenu(): Menu data: ");
      console.log(aMenuData);
    }
    
    if (aMenuData.length > 0) {
      browser.menus.create({
        type: "separator",
        contexts: ["editable"],
        documentUrlPatterns: ["<all_urls>"]
      });

      buildContextMenuHelper(aMenuData);
    }
  }).catch(aErr => { onError(aErr) });
}


function buildContextMenuHelper(aMenuData)
{
  for (let i = 0; i < aMenuData.length; i++) {
    let menuData = aMenuData[i];
    let menuItem = {
      id: menuData.id,
      title: menuData.title,
      icons: menuData.icons,
      contexts: ["editable"],
      documentUrlPatterns: ["<all_urls>"]
    };

    if ("parentId" in menuData && menuData.parentId != aeConst.ROOT_FOLDER_ID) {
      menuItem.parentId = menuData.parentId;
    }

    browser.menus.create(menuItem);
    
    if (menuData.submenuItems) {
      buildContextMenuHelper(menuData.submenuItems);
    }
  }
}


function updateContextMenuForClipping(aUpdatedClippingID)
{
  let id = Number(aUpdatedClippingID);
  let clippingsDB = aeClippings.getDB();

  clippingsDB.clippings.get(id).then(aResult => {
    let updatePpty = {
      title: aResult.name,
      icons: {
        16: "img/" + (aResult.label ? `clipping-${aResult.label}.svg` : "clipping.svg")
      }
    };
    
    try {
      // This will fail due to the 'icons' property not supported on the
      // 'updateProperties' parameter to contextMenus.update().
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=1414566
      let menuItemID = gClippingMenuItemIDMap[id];
      browser.menus.update(menuItemID, updatePpty);
    }
    catch (e) {
      console.error("Clippings/wx: updateContextMenuForClipping(): " + e);
    }
  });
}


function updateContextMenuForFolder(aUpdatedFolderID)
{
  let id = Number(aUpdatedFolderID);
  let clippingsDB = aeClippings.getDB();

  clippingsDB.folders.get(id).then(aResult => {
    let menuItemID = gFolderMenuItemIDMap[id];
    if (menuItemID) {
      browser.menus.update(menuItemID, {title: aResult.name});
    }
  });
}


function removeContextMenuForClipping(aRemovedClippingID)
{
  let menuItemID = gClippingMenuItemIDMap[aRemovedClippingID];
  browser.menus.remove(menuItemID);
  delete gClippingMenuItemIDMap[aRemovedClippingID];
}


function removeContextMenuForFolder(aRemovedFolderID)
{
  let menuItemID = gFolderMenuItemIDMap[aRemovedFolderID];
  browser.menus.remove(menuItemID);
  delete gFolderMenuItemIDMap[aRemovedFolderID];
}


async function rebuildContextMenu()
{
  log("Clippings/wx: rebuildContextMenu(): Removing all Clippings context menu items and rebuilding the menu...");
  await browser.menus.removeAll();

  gClippingMenuItemIDMap = {};
  gFolderMenuItemIDMap = {};
  buildContextMenu();
}


function handlePrefersColorSchemeChange(aMediaQuery)
{
  getContextMenuData.isDarkMode = aMediaQuery.matches;

  // Changes to the Dark Mode setting only affects the Synced Clippings folder
  // menu icon.
  if (gPrefs.syncClippings) {
    rebuildContextMenu();
  }
}


function buildAutoIncrementPlchldrResetMenu(aAutoIncrPlchldrs)
{
  let enabledResetMenu = false;
  
  aAutoIncrPlchldrs.forEach(async (aItem, aIndex, aArray) => {
    if (! gAutoIncrPlchldrs.has(aItem)) {
      gAutoIncrPlchldrs.add(aItem);

      let menuItem = {
        id: `ae-clippings-reset-autoincr-${aItem}`,
        title: `#[${aItem}]`,
        parentId: "ae-clippings-reset-autoincr-plchldrs",
        contexts: ["browser_action"],
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


async function resetAutoIncrPlaceholder(aPlaceholder)
{
  log(`Clippings/wx: resetAutoIncrPlaceholder(): Resetting placeholder: #[${aPlaceholder}]`);

  aeClippingSubst.resetAutoIncrementVar(aPlaceholder);
  gAutoIncrPlchldrs.delete(aPlaceholder);
  await browser.menus.remove(`ae-clippings-reset-autoincr-${aPlaceholder}`);
  
  if (gAutoIncrPlchldrs.size == 0) {
    browser.menus.update("ae-clippings-reset-autoincr-plchldrs", {enabled: false});
  }
}


async function showBackupNotification()
{
  if (gPrefs.backupRemFrequency == aeConst.BACKUP_REMIND_NEVER) {
    return;
  }

  let today = new Date();
  let lastBackupRemDate = new Date(gPrefs.lastBackupRemDate);
  let diff = new aeDateDiff(today, lastBackupRemDate);
  let numDays = 0;

  switch (gPrefs.backupRemFrequency) {
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

  if (diff.days >= numDays || gForceShowFirstTimeBkupNotif) {
    if (gPrefs.backupRemFirstRun) {
      info("Clippings/wx: showBackupNotification(): Showing first-time backup reminder.");

      await browser.notifications.create("backup-reminder-firstrun", {
        type: "basic",
        title: browser.i18n.getMessage("backupNotifyTitle"),
        message: browser.i18n.getMessage("backupNotifyFirstMsg"),
        iconUrl: "img/notifIcon.svg",
      });

      aePrefs.setPrefs({
        backupRemFirstRun: false,
        backupRemFrequency: aeConst.BACKUP_REMIND_WEEKLY,
        lastBackupRemDate: new Date().toString(),
      });

      if (gForceShowFirstTimeBkupNotif) {
        setBackupNotificationInterval();
        gForceShowFirstTimeBkupNotif = false;
      }
    }
    else {
      info("Clippings/wx: showBackupNotification(): Last backup reminder: " + gPrefs.lastBackupRemDate);

      if (gPrefs.skipBackupRemIfUnchg && gPrefs.clippingsUnchanged) {
        log("Clippings/wx: No changes to clippings since last backup; skipping backup notification.");
      }
      else {
        await browser.notifications.create("backup-reminder", {
          type: "basic",
          title: browser.i18n.getMessage("backupNotifyTitle"),
          message: browser.i18n.getMessage("backupNotifyMsg"),
          iconUrl: "img/notifIcon.svg",
        });

        setBackupNotificationInterval();
        aePrefs.setPrefs({ lastBackupRemDate: new Date().toString() });
      }
    }
  }
  else {
    setBackupNotificationInterval();
  }
}   


function setBackupNotificationInterval()
{
  log("Clippings/wx: Setting backup notification interval (every 24 hours).");

  browser.alarms.create("show-backup-notificn", {
    periodInMinutes: aeConst.BACKUP_REMINDER_INTERVAL_MS / 60000
  });
}


async function clearBackupNotificationInterval()
{
  log("Clippings/wx: Clearing backup notification interval.");
  await browser.alarms.clear("show-backup-notificn");
}


async function setWhatsNewNotificationDelay()
{
  log("Clippings/wx: Turning on post-update notification.");
  await aePrefs.setPrefs({
    upgradeNotifCount: aeConst.MAX_NUM_POST_UPGRADE_NOTIFICNS
  });

  // Show post-update notification in 1 minute.
  browser.alarms.create("show-upgrade-notifcn", {
    delayInMinutes: aeConst.POST_UPGRADE_NOTIFCN_DELAY_MS / 60000
  });
}


async function showWhatsNewNotification()
{
  log("Clippings/wx: Showing post-update notification.");

  let extName = browser.i18n.getMessage("extName");
  await browser.notifications.create("whats-new", {
    type: "basic",
    title: extName,
    message: browser.i18n.getMessage("upgradeNotifcn", extName),
    iconUrl: "img/notifIcon.svg",
  });

  let upgradeNotifCount = gPrefs.upgradeNotifCount - 1;
  aePrefs.setPrefs({upgradeNotifCount});
}


async function showSyncHelperUpdateNotification()
{
  if (!gPrefs.syncClippings || !gPrefs.syncHelperCheckUpdates) {
    return;
  }

  let today, lastUpdateCheck, diff;
  if (gPrefs.lastSyncHelperUpdChkDate) {
    today = new Date();
    lastUpdateCheck = new Date(gPrefs.lastSyncHelperUpdChkDate);
    diff = new aeDateDiff(today, lastUpdateCheck);
  }

  if (!gPrefs.lastSyncHelperUpdChkDate || diff.days >= aeConst.SYNC_HELPER_CHECK_UPDATE_FREQ_DAYS) {
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
      
      gSyncClippingsHelperDwnldPgURL = updateInfo.downloadPageURL;
      browser.notifications.create("sync-helper-update", {
        type: "basic",
        title: browser.i18n.getMessage("syncUpdateTitle"),
        message: browser.i18n.getMessage("syncUpdateMsg"),
        iconUrl: "img/syncClippingsApp.svg",
      });

      aePrefs.setPrefs({
        lastSyncHelperUpdChkDate: new Date().toString()
      });
    }
  }
}


async function openWelcomePage()
{
  let url = browser.runtime.getURL("pages/welcome.html");
  let tab = await browser.tabs.create({url});
  browser.history.deleteUrl({url});
}


async function openClippingsManager(aBackupMode)
{
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
    let wndGeom = gPrefs.clippingsMgrWndGeom;

    if (gPrefs.clippingsMgrSaveWndGeom && wndGeom) {
      width  = wndGeom.w - 1;  // Compensate for workaround to popup window bug.
      height = wndGeom.h;
      left   = wndGeom.x;
      top    = wndGeom.y;
    }
    else {
      if (gPrefs.autoAdjustWndPos) {
        wndGeom = await getWndGeometryFromBrwsTab();
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
    gWndIDs.clippingsMgr = wnd.id;
    browser.history.deleteUrl({ url: clippingsMgrURL });

    // Workaround to bug where window position isn't set when calling
    // `browser.windows.create()`. If unable to get window geometry, then
    // default to centering on screen.
    if (wndGeom) {
      browser.windows.update(wnd.id, { left, top });
    }
  }
  // END nested function

  // The `gPrefs` object is null if the "Run in Private Windows" setting was
  // turned on or off.  This renders Clippings unusable until Firefox is
  // restarted.
  if (! (gPrefs instanceof Object)) {
    alertEx("msgRunInPrivateChg", true);
    return;
  }
    
  if (gWndIDs.clippingsMgr) {
    try {
      let wnd = await browser.windows.get(gWndIDs.clippingsMgr);
      browser.windows.update(gWndIDs.clippingsMgr, {focused: true});
    }
    catch {
      // Handle dangling ref to previously-closed Clippings Manager window
      // because it was closed before it finished initializing.
      gWndIDs.clippingsMgr = null;
      openClippingsMgrHelper();
    }
  }
  else {
    openClippingsMgrHelper();
  }
}


function openNewClippingDlg()
{
  let url = browser.runtime.getURL("pages/new.html");
  let height = 416;
  if (gOS == "win") {
    height = 448;
  }
  openDlgWnd(url, "newClipping", {type: "popup", width: 432, height});
}


function openKeyboardPasteDlg()
{
  // TO DO: Check first if the cursor is in a web page textbox or HTML editor.
  // If not, then don't do anything.

  let url = browser.runtime.getURL("pages/keyboardPaste.html");
  openDlgWnd(url, "keyboardPaste", {
    type: "popup",
    width: 500,
    height: 164,
    topOffset: 256,
  });
}


function openPlaceholderPromptDlg()
{
  // TO DO: Same checking for cursor location as in the preceding function.

  let url = browser.runtime.getURL("pages/placeholderPrompt.html");
  openDlgWnd(url, "placeholderPrmt", {
    type: "popup",
    width: 536,
    height: 228,
    topOffset: 256,
  });
}


function openBackupDlg()
{
  let url = browser.runtime.getURL("pages/backup.html");
  let lang = browser.i18n.getUILanguage();
  let height = 412;

  if (lang == "uk" || (lang == "fr" && gOS == "mac")) {
    height = 450;
  }
  
  openDlgWnd(url, "backupFirstRun", { type: "popup", width: 590, height });
}


async function openDlgWnd(aURL, aWndKey, aWndPpty)
{
  async function openDlgWndHelper()
  {
    let width = aWndPpty.width;
    let height = aWndPpty.height;
    let left, top, wndGeom;
    
    if (gPrefs.autoAdjustWndPos) {
      wndGeom = await getWndGeometryFromBrwsTab();
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

    gWndIDs[aWndKey] = wnd.id;
    browser.history.deleteUrl({ url: aURL });

    // Workaround to bug where window position isn't set when calling
    // `browser.windows.create()`. If unable to get window geometry, then
    // default to centering on screen.
    if (wndGeom) {
      browser.windows.update(wnd.id, { left, top });
    }
  }
  // END nested function

  if (gWndIDs[aWndKey]) {
    try {
      await browser.windows.get(gWndIDs[aWndKey]);
      browser.windows.update(gWndIDs[aWndKey], { focused: true });
    }
    catch (e) {
      gWndIDs[aWndKey] = null;
      openDlgWndHelper();
    };
  }
  else {
    openDlgWndHelper();
  }
}


async function getWndGeometryFromBrwsTab()
{
  let rv = null;

  let brwsTabs = await browser.tabs.query({currentWindow: true, discarded: false});
  if (!brwsTabs || brwsTabs.length == 0) {
    return rv;
  }
  
  let wndGeom;

  for (let tab of brwsTabs) {
    try {
      log("Clippings/wx: getWndGeometryFromBrwsTab(): Sending message \"get-wnd-geometry\" to content script; tab ID: " + tab.id);
      wndGeom = await browser.tabs.sendMessage(tab.id, { msgID: "get-wnd-geometry" });
    }
    catch (e) {}

    if (wndGeom) {
      log("Successfully retrieved window geometry from browser tab " + tab.id);
      rv = wndGeom;
      break;
    }
  }

  return rv;
}


function pasteClippingByID(aClippingID, aExternalRequest)
{
  let clippingsDB = aeClippings.getDB();

  clippingsDB.transaction("r", clippingsDB.clippings, clippingsDB.folders, () => {
    let clipping = null;
    
    clippingsDB.clippings.get(aClippingID).then(aClipping => {
      if (! aClipping) {
        throw new Error("Cannot find clipping with ID = " + aClippingID);
      }

      if (aClipping.parentFolderID == -1) {
        throw new Error("Attempting to paste a deleted clipping!");
      }

      clipping = aClipping;
      log(`Pasting clipping named "${clipping.name}"\nid = ${clipping.id}`);
        
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

      pasteClipping(clippingInfo, aExternalRequest);
    });
  }).catch(aErr => {
    console.error("Clippings/wx: pasteClippingByID(): " + aErr);
  });
}


function pasteClippingByShortcutKey(aShortcutKey)
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

      pasteClipping(clippingInfo);
    });
  }).catch(aErr => {
    console.error("Clippings/wx: pasteClippingByShortcutKey(): " + aErr);
  });
}


async function pasteClipping(aClippingInfo, aExternalRequest)
{
  let queryInfo = {
    active: true,
  };

  if (aExternalRequest) {
    queryInfo.lastFocusedWindow = true;
  }
  else {
    queryInfo.currentWindow = true;
  }
  
  let [tabs] = await browser.tabs.query(queryInfo);
  if (! tabs) {
    // This should never happen...
    alertEx("msgNoActvBrwsTab");
    return;
  }

  let activeTabID = tabs.id;
  let processedCtnt = "";

  log("Clippings/wx: pasteClipping(): Active tab ID: " + activeTabID);

  if (gPasteClippingTargetTabID === null) {
    gPasteClippingTargetTabID = activeTabID;
  }
  else {
    if (activeTabID != gPasteClippingTargetTabID) {
      warn(`Clippings/wx: pasteClipping(): Detected mismatch between active tab ID and what it was before the keyboard paste dialog.\nPrevious active tab ID = ${gPasteClippingTargetTabID}, current active tab ID = ${activeTabID}`);
      activeTabID = gPasteClippingTargetTabID;
    }
  }

  if (aeClippingSubst.hasNoSubstFlag(aClippingInfo.name)) {
    processedCtnt = aClippingInfo.text;
  }
  else {
    processedCtnt = aeClippingSubst.processStdPlaceholders(aClippingInfo);

    let autoIncrPlchldrs = aeClippingSubst.getAutoIncrPlaceholders(processedCtnt);
    if (autoIncrPlchldrs.length > 0) {
      buildAutoIncrementPlchldrResetMenu(autoIncrPlchldrs);
      processedCtnt = aeClippingSubst.processAutoIncrPlaceholders(processedCtnt);
    }

    let plchldrs = aeClippingSubst.getCustomPlaceholders(processedCtnt);
    if (plchldrs.length > 0) {
      let plchldrsWithDefaultVals = aeClippingSubst.getCustomPlaceholderDefaultVals(processedCtnt, aClippingInfo);
      gPlaceholders.set(aClippingInfo.name, plchldrs, plchldrsWithDefaultVals, processedCtnt);

      setTimeout(openPlaceholderPromptDlg, 100);
      return;
    }
  }

  pasteProcessedClipping(processedCtnt, activeTabID);
}


function pasteProcessedClipping(aClippingContent, aActiveTabID)
{
  let msgParams = {
    msgID: "paste-clipping",
    content: aClippingContent,
    htmlPaste: gPrefs.htmlPaste,
    autoLineBreak: gPrefs.autoLineBreak,
    dispatchInputEvent: gPrefs.dispatchInputEvent,
  };

  log(`Clippings/wx: Extension sending message "paste-clipping" to content script (active tab ID = ${aActiveTabID})`);
  
  setTimeout(async () => {
    try {
      await browser.tabs.sendMessage(aActiveTabID, msgParams);
    }
    catch (e) {
      console.error("Clippings/wx: pasteProcessedClipping(): Failed to paste clipping: " + e);
    }
    finally {
      gPasteClippingTargetTabID = null;
    };
  }, 150);    
}


function showSyncErrorNotification()
{
  browser.notifications.create("sync-error", {
    type: "basic",
    title: browser.i18n.getMessage("syncStartupFailedHdg"),
    message: browser.i18n.getMessage("syncStartupFailed"),
    iconUrl: "img/error.svg",
  });
}


//
// Utility functions
//

function getOS()
{
  return gOS;
}


async function initContentCSS(aTabID)
{
  try {
    browser.tabs.insertCSS(aTabID, {file: "/style/tmLightbox.css"});
  }
  catch (e) {
    console.error("Clippings/wx: Failed to inject lightbox CSS into tab content: %s", e);
  }  
}


async function alertEx(aMessageID, aUsePopupWnd=false)
{
  let message = browser.i18n.getMessage(aMessageID);
  info("Clippings/wx: " + message);

  let [tab] = await browser.tabs.query({active: true, currentWindow: true});
  if (gPrefs && gPrefs.tabModalMsgBox && tab && !aUsePopupWnd) {
    let activeTabID = tab.id;
    let tabInfo = await browser.tabs.get(activeTabID);

    if (tabInfo.status == "complete") {
      let msg = {
        msgID: "show-lightbox",
        strKey: aMessageID,
      };
      let resp;
      try {
        resp = await browser.tabs.sendMessage(activeTabID, msg);
      }
      catch (e) {
        console.error("Clippings/wx: alertEx(): Error sending message to content script\n%s", e);
      }

      if (resp) {
        return;
      }
      else {
        // Reached here if the tab URL is in a restricted domain (mozilla.org or
        // mozilla.com), the tab is displaying Firefox settings, Add-ons Manager
        // or other internal page, or if the content script couldn't be loaded
        // (e.g. because the page is still loading).
        // In this case, we could fall back to displaying the message box in an
        // ordinary popup window.
        warn("Clippings/wx: No response was received from content script for message 'show-lightbox'.");
      }
    }
  }

  let url = "pages/msgbox.html?msgid=" + aMessageID;

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

  if (gPrefs && gPrefs.autoAdjustWndPos) {
    wndGeom = await getWndGeometryFromBrwsTab();

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

  gWndIDs[wndKey] = wnd.id;
  browser.history.deleteUrl({ url });

  // Workaround to bug where window position isn't correctly set when calling
  // `browser.windows.create()`. If unable to get window geometry, then default
  // to centering on screen.
  if (wndGeom) {
    browser.windows.update(wnd.id, { left, top });
  }
}


//
// Event handlers
//

browser.browserAction.onClicked.addListener(aTab => {
  openClippingsManager();
});


browser.commands.onCommand.addListener(async (aCmdName) => {
  info(`Clippings/wx: Command "${aCmdName}" invoked!`);

  if (aCmdName == aeConst.CMD_CLIPPINGS_KEYBOARD_PASTE && gPrefs.keyboardPaste) {
    let [tabs] = await browser.tabs.query({ active: true, currentWindow: true });
    let activeTabID = tabs.id;
    gPasteClippingTargetTabID = activeTabID;
    log(`Clippings/wx: Active tab ID: ${activeTabID} - opening keyboard paste dialog.`);
    openKeyboardPasteDlg();
  }
});


browser.menus.onClicked.addListener(async (aInfo, aTab) => {
  switch (aInfo.menuItemId) {
  case "ae-clippings-new":
    let [tabs] = await browser.tabs.query({ active: true, currentWindow: true });
    if (! tabs) {
      alertEx("msgBrwsWndNotFocused");
      return;
    }

    let activeTabID = tabs.id;
    let url = tabs.url;
      
    let tabInfo = await browser.tabs.get(activeTabID);
    if (tabInfo.status == "loading") {
      console.warn("Clippings/wx: The active tab (ID = %s) is still loading or busy. Messages sent to it now may not receive a response.", activeTabID);
    }
      
    log("Clippings/wx: Extension sending message \"new-clipping\" to content script; active tab ID: " + activeTabID);

    let resp;
    try {
      resp = await browser.tabs.sendMessage(activeTabID, { msgID: "new-clipping" });
    }
    catch (e) {
      alertEx("msgRetryPgNotLoaded");
      break;
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

    gNewClipping.set({name, content, url});
    openNewClippingDlg();
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
      pasteClippingByID(id);
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
    browser.tabs.create({url: gSyncClippingsHelperDwnldPgURL});
    break;

  case "whats-new":
    browser.tabs.create({url: browser.runtime.getURL("pages/whatsnew.html")});
    aePrefs.setPrefs({upgradeNotifCount: 0});
    break;

  default:
    break;
  }
});
  

browser.storage.onChanged.addListener((aChanges, aAreaName) => {
  let changedPrefs = Object.keys(aChanges);

  for (let pref of changedPrefs) {
    gPrefs[pref] = aChanges[pref].newValue;

    if (pref == "autoIncrPlcHldrStartVal") {
      aeClippingSubst.setAutoIncrementStartValue(aChanges[pref].newValue);
    }
  }
});


browser.runtime.onMessage.addListener(aRequest => {
  log(`Clippings/wx: Received message "${aRequest.msgID}"`);
  
  switch (aRequest.msgID) {
  case "get-env-info":
    let envInfo = {
      os: gOS,
      hostAppName: gHostAppName,
      hostAppVer:  gHostAppVer,
    };
    return Promise.resolve(envInfo);

  case "init-new-clipping-dlg":
    let newClipping = gNewClipping.get();
    if (newClipping !== null) {
      newClipping.saveSrcURL = gPrefs.alwaysSaveSrcURL;
      newClipping.checkSpelling = gPrefs.checkSpelling;
      return Promise.resolve(newClipping);
    }   
    break;

  case "init-placeholder-prmt-dlg":
    return Promise.resolve(gPlaceholders.get());

  case "close-new-clipping-dlg":
    gWndIDs.newClipping = null;
    break;

  case "close-clippings-mgr-wnd":
    gWndIDs.clippingsMgr = null;
    break;

  case "close-keybd-paste-dlg":
    gWndIDs.keyboardPaste = null;
    break;

  case "paste-shortcut-key":
    let shortcutKey = aRequest.shortcutKey;
    if (! shortcutKey) {
      return;
    }
    log(`Clippings/wx: Key '${shortcutKey}' was pressed.`);
    pasteClippingByShortcutKey(shortcutKey);
    break;

  case "paste-clipping-by-name":
    let externReq = aRequest.fromClippingsMgr;
    pasteClippingByID(aRequest.clippingID, externReq);
    break;

  case "paste-clipping-with-plchldrs":
    let content = aRequest.processedContent;
    setTimeout(async () => {
      let [tabs] = await browser.tabs.query({active: true, currentWindow: true});
      if (! tabs) {
        // This could happen if the browser tab was closed while the
        // placeholder prompt dialog was open.
        alertEx("msgNoActvBrwsTab");
        return;
      }

      let activeTabID = tabs.id;
      if (activeTabID != gPasteClippingTargetTabID) {
        warn(`Clippings/wx: Detected mismatch between currently-active browser tab ID and what it was when invoking clipping paste.\nPrevious active tab ID = ${gPasteClippingTargetTabID}, active tab ID = ${activeTabID}`);
        activeTabID = gPasteClippingTargetTabID;
      }
      pasteProcessedClipping(content, activeTabID);
    }, 60);
    break;

  case "close-placeholder-prmt-dlg":
    gWndIDs.placeholderPrmt = null;
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
    refreshSyncedClippings(aRequest.rebuildClippingsMenu);
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
