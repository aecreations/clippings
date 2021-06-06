/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const MAX_NAME_LENGTH = 64;
const ROOT_FOLDER_NAME = "clippings-root";
const PASTE_ACTION_SHORTCUT_KEY = 1;
const PASTE_ACTION_SEARCH_CLIPPING = 2;

let gClippingsDB = null;
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
let gClippingsMgrRootFldrReseq = false;

let gClippingsListeners = {
  _listeners: [],

  add: function (aNewListener) {
    this._listeners.push(aNewListener);
  },

  remove: function (aTargetListener) {
    this._listeners = this._listeners.filter(aListener => aListener != aTargetListener);
  },

  getListeners: function () {
    return this._listeners;
  }
};

let gClippingsListener = {
  _isImporting: false,
  _isCopying: false,
  _isClippingsMgrDnDInProgress: false,
  origin: null,
  
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

  clippingDeleted: function (aID, aOldData) {},
  folderDeleted: function (aID, aOldData) {},

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

let gSyncClippingsListeners = {
  _listeners: [],

  add(aNewListener) {
    this._listeners.push(aNewListener)
  },

  remove(aTargetListener) {
    this._listeners = this._listeners.filter(aListener => aListener != aTargetListener);
  },

  getListeners() {
    return this._listeners;
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
    browser.contextMenus.update(syncFldrMenuID, { icons: { 16: "img/folder.svg" }});
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

    log("Clippings/wx: gSyncClippingsListeners.onAfterDeactivate(): Remove Synced Clippings folder: " + aRemoveSyncFolder);

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
    log("Clippings/wx: gSyncClippingsListeners.onReloadStart()");
    gIsReloadingSyncFldr = true;
  },
  
  onReloadFinish()
  {
    log("Clippings/wx: gSyncClippingsListeners.onReloadFinish(): Rebuilding Clippings menu");
    gIsReloadingSyncFldr = false;
    rebuildContextMenu();
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
  _plchldrs: null,
  _clpCtnt: null,
  _plchldrsWithDefVals: null,

  set: function (aPlaceholders, aPlaceholdersWithDefaultVals, aClippingText) {
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
      placeholders: this._plchldrs.slice(),
      placeholdersWithDefaultVals: Object.assign({}, this._plchldrsWithDefVals),
      content: this._clpCtnt
    };
    return rv;
  },

  reset: function () {
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
let gIsInitialized = false;
let gSetDisplayOrderOnRootItems = false;

let gMsgBoxStr = {
  MSG_UNKNOWN: "msgUnknown",
  MSG_UNAVAILABLE: "msgUnavail",
  MSG_NO_TEXT_SELECTED: "msgNoTextSel",
  MSG_BROWSER_WND_NOT_FOCUSED: "msgBrwsWndNotFocused",
  MSG_CLIPPING_NOT_FOUND: "msgClpgNotFound",
  MSG_NO_ACTIVE_BROWSER_TAB: "msgNoActvBrwsTab",
  MSG_RETRY_PAGE_BUSY: "msgRetryPgBusy",
  MSG_RETRY_PAGE_NOT_LOADED: "msgRetryPgNotLoaded",
};


//
// First-run initialization
//

browser.runtime.onInstalled.addListener(async (aInstall) => {
  if (aInstall.reason == "install") {
    log("Clippings/wx: It appears that the extension is newly installed.  Welcome to Clippings 6!");

    // We can't detect if the previous install is the same version, so always
    // initialize user prefs with default values.
    await setDefaultPrefs();
    init();
  }
  else if (aInstall.reason == "update") {
    let oldVer = aInstall.previousVersion;
    let currVer = browser.runtime.getManifest().version;
    log(`Clippings/wx: Upgrading from version ${oldVer} to ${currVer}`);

    gPrefs = await aePrefs.getAllPrefs();

    if (! hasSanDiegoPrefs()) {
      gSetDisplayOrderOnRootItems = true;
      log("Initializing 6.1 user preferences.");
      await setSanDiegoPrefs();
    }

    if (! hasBalboaParkPrefs()) {
      gForceShowFirstTimeBkupNotif = true;
      log("Initializing 6.1.2 user preferences.");
      await setBalboaParkPrefs();
    }

    if (! hasMalibuPrefs()) {
      log("Initializing 6.2 user preferences.");
      await setMalibuPrefs();
    }
    
    if (! hasTopangaPrefs()) {
      log("Initializing 6.2.1 user preferences.");
      await setTopangaPrefs();
    }

    if (! hasHuntingdonPrefs()) {
      log("Initializing 6.3 user preferences.");
      await setHuntingdonPrefs();
    }

    if (gPrefs.clippingsMgrDetailsPane) {
      gPrefs.clippingsMgrAutoShowDetailsPane = false;
    }
      
    init();
  }
});


async function setDefaultPrefs()
{
  let defaultPrefs = aePrefs.getDefaultPrefs();

  gPrefs = defaultPrefs;
  await aePrefs.setPrefs(defaultPrefs);
}


function hasSanDiegoPrefs()
{
  // Version 6.1
  return gPrefs.hasOwnProperty("syncClippings");
}


async function setSanDiegoPrefs()
{
  let newPrefs = {
    syncClippings: false,
    syncFolderID: null,
    pasteShortcutKeyPrefix: "",
    lastBackupRemDate: null,
    backupRemFirstRun: true,
    backupRemFrequency: aeConst.BACKUP_REMIND_WEEKLY,
    afterSyncFldrReloadDelay: 3000,
  };
  
  for (let pref in newPrefs) {
    gPrefs[pref] = newPrefs[pref];
  }

  await aePrefs.setPrefs(newPrefs);
}


function hasBalboaParkPrefs()
{
  // Version 6.1.2
  return gPrefs.hasOwnProperty("syncHelperCheckUpdates");
}


async function setBalboaParkPrefs()
{
  let newPrefs = {
    syncHelperCheckUpdates: true,
    lastSyncHelperUpdChkDate: null,
  };

  for (let pref in newPrefs) {
    gPrefs[pref] = newPrefs[pref];
  }

  await aePrefs.setPrefs(newPrefs);
}


function hasMalibuPrefs()
{
  // Version 6.2
  return gPrefs.hasOwnProperty("cxtMenuSyncItemsOnly");
}


async function setMalibuPrefs()
{
  let newPrefs = {
    cxtMenuSyncItemsOnly: false,
    clippingsMgrShowSyncItemsOnlyRem: true,
    clippingsMgrAutoShowDetailsPane: true,
    backupFilenameWithDate: true,
  };

  for (let pref in newPrefs) {
    gPrefs[pref] = newPrefs[pref];
  }

  await aePrefs.setPrefs(newPrefs);
}


function hasTopangaPrefs()
{
  // Version 6.2.1
  return gPrefs.hasOwnProperty("dispatchInputEvent");
}


async function setTopangaPrefs()
{
  let newPrefs = {
    dispatchInputEvent: true,
  };

  for (let pref in newPrefs) {
    gPrefs[pref] = newPrefs[pref];
  }

  await aePrefs.setPrefs(newPrefs);
}


function hasHuntingdonPrefs()
{
  // Version 6.3
  return gPrefs.hasOwnProperty("clippingsMgrSaveWndGeom");
}


async function setHuntingdonPrefs()
{
  let newPrefs = {
    clippingsMgrSaveWndGeom: true,
    clippingsMgrWndGeom: null,
    newClippingSyncFldrsOnly: false,
  };
  
  for (let pref in newPrefs) {
    gPrefs[pref] = newPrefs[pref];
  }

  await aePrefs.setPrefs(newPrefs);
}


//
// Browser window and Clippings menu initialization
//

browser.runtime.onStartup.addListener(async () => {
  log("Clippings/wx: Initializing Clippings during browser startup.");
  
  gPrefs = await aePrefs.getAllPrefs();
  log("Clippings/wx: Successfully retrieved user preferences:");
  log(gPrefs);
    
  init();
});


function init()
{
  log("Clippings/wx: Initializing integration with host app...");
  
  initClippingsDB();

  let getBrwsInfo = browser.runtime.getBrowserInfo();
  let getPlatInfo = browser.runtime.getPlatformInfo();

  Promise.all([getBrwsInfo, getPlatInfo]).then(async (aResults) => {
    let brws = aResults[0];
    let platform = aResults[1];
    
    gHostAppName = brws.name;
    gHostAppVer = brws.version;
    log(`Clippings/wx: Host app: ${gHostAppName} (version ${gHostAppVer})`);

    gOS = platform.os;
    log("Clippings/wx: OS: " + gOS);

    if (gPrefs.clippingsMgrMinzWhenInactv === undefined) {
      gPrefs.clippingsMgrMinzWhenInactv = (gOS == "linux");
    }

    gClippingsListener.origin = aeConst.ORIGIN_HOSTAPP;
    gClippingsListeners.add(gClippingsListener);
    gSyncClippingsListeners.add(gSyncClippingsListener);
    
    if (gPrefs.syncClippings) {
      gSyncFldrID = gPrefs.syncFolderID;

      // The context menu will be built when refreshing the sync data, via the
      // onReloadFinish event handler of the Sync Clippings listener.
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

    if (gPrefs.showWelcome) {
      openWelcomePage();
      aePrefs.setPrefs({ showWelcome: false });
    }

    if (gSetDisplayOrderOnRootItems) {
      await setDisplayOrderOnRootItems();
      gIsInitialized = true;
      log("Clippings/wx: Display order on root folder items have been set.\nClippings initialization complete.");
    }
    else {
      gIsInitialized = true;
      log("Clippings/wx: Initialization complete.");   
    }
  });
}


function initClippingsDB()
{
  gClippingsDB = new Dexie("aeClippings");
  gClippingsDB.version(1).stores({
    clippings: "++id, name, parentFolderID"
  });
  // This was needed to use the Dexie.Observable add-on (discontinued as of 6.2)
  gClippingsDB.version(2).stores({});

  gClippingsDB.version(3).stores({
    folders: "++id, name, parentFolderID"
  });
  gClippingsDB.version(4).stores({
    clippings: "++id, name, parentFolderID, shortcutKey"
  });

  gClippingsDB.open().catch(aErr => { onError(aErr) });
}


function setDisplayOrderOnRootItems()
{
  return new Promise((aFnResolve, aFnReject) => {
    let seq = 1;

    gClippingsDB.transaction("rw", gClippingsDB.clippings, gClippingsDB.folders, () => {
      gClippingsDB.folders.where("parentFolderID").equals(aeConst.ROOT_FOLDER_ID).each((aItem, aCursor) => {
        log(`Clippings/wx: setDisplayOrderOnRootItems(): Folder "${aItem.name}" (id=${aItem.id}): display order = ${seq}`);
        let numUpd = gClippingsDB.folders.update(aItem.id, { displayOrder: seq++ });

      }).then(() => {
        return gClippingsDB.clippings.where("parentFolderID").equals(aeConst.ROOT_FOLDER_ID).each((aItem, aCursor) => {
          log(`Clippings/wx: setDisplayOrderOnRootItems(): Clipping "${aItem.name}" (id=${aItem.id}): display order = ${seq}`);
          let numUpd = gClippingsDB.clippings.update(aItem.id, { displayOrder: seq++ });
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


async function enableSyncClippings(aIsEnabled)
{
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
        gSyncFldrID = await gClippingsDB.folders.add(syncFldr);
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

    let numUpd = await gClippingsDB.folders.update(gSyncFldrID, { isSync: undefined });
    await aePrefs.setPrefs({ syncFolderID: null });
    gSyncFldrID = null;
    return oldSyncFldrID;
  }
}


// TO DO: Make this an asynchronous function.
// This can only be done after converting aeImportExport.importFromJSON()
// to an asynchronous method.
function refreshSyncedClippings(aRebuildClippingsMenu)
{
  log("Clippings/wx: refreshSyncedClippings(): Retrieving synced clippings from the Sync Clippings helper app...");

  let msg = { msgID: "get-synced-clippings" };
  let getSyncedClippings = browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
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
      
      return gClippingsDB.folders.add(syncFldr);
    }

    log("Clippings/wx: refreshSyncedClippings(): Synced Clippings folder ID: " + gSyncFldrID);
    return gSyncFldrID;

  }).then(aSyncFldrID => {
    if (gSyncFldrID === null) {
      gSyncFldrID = aSyncFldrID;
      log("Clippings/wx: Synced Clippings folder ID: " + gSyncFldrID);
      return aePrefs.setPrefs({ syncFolderID: gSyncFldrID });
    }
      
    gSyncClippingsListeners.getListeners().forEach(aListener => { aListener.onReloadStart() });

    log("Clippings/wx: Purging existing items in the Synced Clippings folder...");
    return purgeFolderItems(gSyncFldrID, true);

  }).then(() => {
    log("Clippings/wx: Importing clippings data from sync file...");

    // Method aeImportExport.importFromJSON() is asynchronous, so the import
    // may not yet be finished when this function has finished executing!
    aeImportExport.setDatabase(gClippingsDB);
    aeImportExport.importFromJSON(syncJSONData, false, false, gSyncFldrID);

    setTimeout(function () {
      gSyncClippingsListeners.getListeners().forEach(aListener => { aListener.onReloadFinish() });
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
  let msg = {
    msgID: "set-synced-clippings",
    syncData: syncData.userClippingsRoot,
  };

  info("Clippings/wx: pushSyncFolderUpdates(): Pushing Synced Clippings folder updates to the Sync Clippings helper app. Message data:");
  log(msg);

  let msgResult;
  try {
    msgResult = await browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
  }
  catch (e) {
    console.error("Clippings/wx: pushSyncFolderUpdates(): " + e);
    throw e;
  }

  log("Clippings/wx: pushSyncFolderUpdates(): Response from native app:");
  log(msgResult);
}


function purgeFolderItems(aFolderID, aKeepFolder)
{
  return new Promise((aFnResolve, aFnReject) => {
    gClippingsDB.transaction("rw", gClippingsDB.clippings, gClippingsDB.folders, () => {
      gClippingsDB.folders.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
        purgeFolderItems(aItem.id, false).then(() => {});

      }).then(() => {
        if (!aKeepFolder && aFolderID != aeConst.DELETED_ITEMS_FLDR_ID) {
          log("Clippings/wx: purgeFolderItems(): Deleting folder: " + aFolderID);
          return gClippingsDB.folders.delete(aFolderID);
        }
        return null;
        
      }).then(() => {
        return gClippingsDB.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
          log("Clippings/wx: purgeFolderItems(): Deleting clipping: " + aItem.id);
          gClippingsDB.clippings.delete(aItem.id);
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
  let cmds = await browser.commands.getAll();
  let shct = cmds[0].shortcut;
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
  
  let rv = [];

  return new Promise((aFnResolve, aFnReject) => {
    gClippingsDB.transaction("r", gClippingsDB.folders, gClippingsDB.clippings, () => {
      gClippingsDB.folders.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
        let fldrMenuItemID = "ae-clippings-folder-" + aItem.id + "_" + Date.now();
        gFolderMenuItemIDMap[aItem.id] = fldrMenuItemID;

        let submenuItemData = {
          id: fldrMenuItemID,
          title: aItem.name,
        };

        // Submenu icon
        let iconPath = "img/folder.svg";
        if (aItem.id == gSyncFldrID) {
          iconPath = "img/synced-clippings.svg";
        }
        submenuItemData.icons = { 16: iconPath };

        if (aItem.displayOrder === undefined) {
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
        return gClippingsDB.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
          let menuItemID = "ae-clippings-clipping-" + aItem.id + "_" + Date.now();
          gClippingMenuItemIDMap[aItem.id] = menuItemID;

          let menuItemData = {
            id: menuItemID,
            title: aItem.name,
            icons: {
              16: "img/" + (aItem.label ? `clipping-${aItem.label}.svg` : "clipping.svg")
            },
          };

          if (aItem.displayOrder === undefined) {
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


function buildContextMenu()
{
  log("Clippings/wx: buildContextMenu()");
  
  // Context menu for browser action button.
  browser.contextMenus.create({
    id: "ae-clippings-reset-autoincr-plchldrs",
    title: browser.i18n.getMessage("baMenuResetAutoIncrPlaceholders"),
    enabled: false,
    contexts: ["browser_action"],
    documentUrlPatterns: ["<all_urls>"]
  });

  // Context menu for web page textbox or HTML editor.
  browser.contextMenus.create({
    id: "ae-clippings-new",
    title: browser.i18n.getMessage("cxtMenuNew"),
    contexts: ["editable", "selection"],
    documentUrlPatterns: ["<all_urls>"]
  });

  browser.contextMenus.create({
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
      browser.contextMenus.create({
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

    if (menuData.parentId !== undefined && menuData.parentId != aeConst.ROOT_FOLDER_ID) {
      menuItem.parentId = menuData.parentId;
    }

    browser.contextMenus.create(menuItem);
    
    if (menuData.submenuItems) {
      buildContextMenuHelper(menuData.submenuItems);
    }
  }
}


function updateContextMenuForClipping(aUpdatedClippingID)
{
  let id = Number(aUpdatedClippingID);
  gClippingsDB.clippings.get(id).then(aResult => {
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
      browser.contextMenus.update(menuItemID, updatePpty);
    }
    catch (e) {
      console.error("Clippings/wx: updateContextMenuForClipping(): " + e);
    }
  });
}


function updateContextMenuForFolder(aUpdatedFolderID)
{
  let id = Number(aUpdatedFolderID);
  gClippingsDB.folders.get(id).then(aResult => {
    let menuItemID = gFolderMenuItemIDMap[id];
    if (menuItemID) {
      browser.contextMenus.update(menuItemID, { title: aResult.name });
    }
  });
}


function removeContextMenuForClipping(aRemovedClippingID)
{
  let menuItemID = gClippingMenuItemIDMap[aRemovedClippingID];
  browser.contextMenus.remove(menuItemID);
  delete gClippingMenuItemIDMap[aRemovedClippingID];
}


function removeContextMenuForFolder(aRemovedFolderID)
{
  let menuItemID = gFolderMenuItemIDMap[aRemovedFolderID];
  browser.contextMenus.remove(menuItemID);
  delete gFolderMenuItemIDMap[aRemovedFolderID];
}


async function rebuildContextMenu()
{
  log("Clippings/wx: rebuildContextMenu(): Removing all Clippings context menu items and rebuilding the menu...");
  await browser.contextMenus.removeAll();

  gClippingMenuItemIDMap = {};
  gFolderMenuItemIDMap = {};
  buildContextMenu();
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
      
      await browser.contextMenus.create(menuItem);
      if (! enabledResetMenu) {
        await browser.contextMenus.update("ae-clippings-reset-autoincr-plchldrs", {
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
  await browser.contextMenus.remove(`ae-clippings-reset-autoincr-${aPlaceholder}`);
  
  if (gAutoIncrPlchldrs.size == 0) {
    browser.contextMenus.update("ae-clippings-reset-autoincr-plchldrs", { enabled: false });
  }
}


function showBackupNotification()
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

      browser.notifications.create(aeConst.NOTIFY_BACKUP_REMIND_FIRSTRUN_ID, {
        type: "basic",
        title: browser.i18n.getMessage("backupNotifyTitle"),
        message: browser.i18n.getMessage("backupNotifyFirstMsg"),
        iconUrl: "img/icon.svg",

      }).then(aNotifID => {
        aePrefs.setPrefs({
          backupRemFirstRun: false,
          backupRemFrequency: aeConst.BACKUP_REMIND_WEEKLY,
          lastBackupRemDate: new Date().toString(),
        });

        if (gForceShowFirstTimeBkupNotif) {
          setBackupNotificationInterval();
          gForceShowFirstTimeBkupNotif = false;
        }
      });
    }
    else {
      info("Clippings/wx: showBackupNotification(): Last backup reminder: " + gPrefs.lastBackupRemDate);

      browser.notifications.create(aeConst.NOTIFY_BACKUP_REMIND_ID, {
        type: "basic",
        title: browser.i18n.getMessage("backupNotifyTitle"),
        message: browser.i18n.getMessage("backupNotifyMsg"),
        iconUrl: "img/icon.svg",

      }).then(aNotifID => {
        setBackupNotificationInterval();
        aePrefs.setPrefs({ lastBackupRemDate: new Date().toString() });
      });
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


function showSyncHelperUpdateNotification()
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
    let msg = { msgID: "get-app-version" };
    let sendNativeMsg = browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
    sendNativeMsg.then(aResp => {
      currVer = aResp.appVersion;
      log("Clippings/wx: showSyncHelperUpdateNotification(): Current version of the Sync Clippings Helper app: " + currVer);
      return fetch(aeConst.SYNC_HELPER_CHECK_UPDATE_URL);

    }).then(aFetchResp => {
      if (aFetchResp.ok) {       
        return aFetchResp.json();
      }
      throw new Error(`HTTP status ${aFetchResp.status} (${aFetchResp.statusText}) received from URL ${aFetchResp.url}`);

    }).then(aUpdateInfo => {
      if (versionCompare(currVer, aUpdateInfo.latestVersion) < 0) {
        info(`Clippings/wx: showSyncHelperUpdateNotification(): Found a newer version of Sync Clippings Helper!  Current version: ${currVer}; new version found: ${aUpdateInfo.latestVersion}`);
        
        gSyncClippingsHelperDwnldPgURL = aUpdateInfo.downloadPageURL;
        return browser.notifications.create(aeConst.NOTIFY_SYNC_HELPER_UPDATE, {
          type: "basic",
          title: browser.i18n.getMessage("syncUpdateTitle"),
          message: browser.i18n.getMessage("syncUpdateMsg"),
          iconUrl: "img/syncClippingsApp.svg",
        });
      }
      else {
        return null;
      }

    }).then(aNotifID => {
      aePrefs.setPrefs({ lastSyncHelperUpdChkDate: new Date().toString() });
      
    }).catch(aErr => {
      console.error("Clippings/wx: showSyncHelperUpdateNotification(): Unable to check for updates to the Sync Clippings Helper app at this time.\n" + aErr);
    });
  }
}


async function openWelcomePage()
{
  let url = browser.runtime.getURL("pages/welcome.html");
  let tab = await browser.tabs.create({ url });
  browser.history.deleteUrl({ url });
}


function createClippingNameFromText(aText)
{
  let rv = "";
  let clipName = "";

  aText = aText.trim();

  if (aText.length > MAX_NAME_LENGTH) {
    // Leave room for the three-character elipsis.
    clipName = aText.substr(0, MAX_NAME_LENGTH - 3) + "...";
  } 
  else {
    clipName = aText;
  }

  // Truncate clipping names at newlines if they exist.
  let newlineIdx = clipName.indexOf("\n");
  rv = (newlineIdx == -1) ? clipName : clipName.substring(0, newlineIdx);

  return rv;
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
    let width = 750;
    let height = 400;
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
      let brwsTabs = await browser.tabs.query({ active: true });
      let activeTabID = brwsTabs[0].id;

      try {
        wndGeom = await browser.tabs.sendMessage(activeTabID, { msgID: "get-wnd-geometry" });
      }
      catch (e) {}

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
    
  let openInNewTab = gPrefs.openClippingsMgrInTab;

  if (openInNewTab) {
    await browser.tabs.create({ url: clippingsMgrURL });
    browser.history.deleteUrl({ url: clippingsMgrURL });
  }
  else {
    if (gWndIDs.clippingsMgr) {
      try {
        let wnd = await browser.windows.get(gWndIDs.clippingsMgr);
        browser.windows.update(gWndIDs.clippingsMgr, { focused: true });
      }
      catch (e) {
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
}


function openNewClippingDlg()
{
  let url = browser.runtime.getURL("pages/new.html");
  let height = 390;
  if (gOS == "win") {
    height = 420;
  }
  openDlgWnd(url, "newClipping", { type: "detached_panel", width: 428, height });
}


function openKeyboardPasteDlg()
{
  // TO DO: Check first if the cursor is in a web page textbox or HTML editor.
  // If not, then don't do anything.

  let url = browser.runtime.getURL("pages/keyboardPaste.html");
  openDlgWnd(url, "keyboardPaste", {
    type: "detached_panel",
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
    type: "detached_panel",
    width: 536,
    height: 198,
    topOffset: 256,
  });
}


function openBackupDlg()
{
  let url = browser.runtime.getURL("pages/backup.html");
  let lang = browser.i18n.getUILanguage();
  let height = 410;

  if (lang == "uk") {
    height = 450;
  }
  
  openDlgWnd(url, "backupFirstRun", { type: "detached_panel", width: 590, height });
}


async function openDlgWnd(aURL, aWndKey, aWndPpty)
{
  async function openDlgWndHelper()
  {
    let brwsTabs = await browser.tabs.query({ active: true });
    let activeTabID = brwsTabs[0].id;
    let wndGeom;
    try {
      wndGeom = await browser.tabs.sendMessage(activeTabID, { msgID: "get-wnd-geometry" });
    }
    catch (e) {}

    let width = aWndPpty.width;
    let height = aWndPpty.height;
    let topOffset = aWndPpty.topOffset ?? 200;
    let left, top;

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


function pasteClippingByID(aClippingID, aExternalRequest)
{
  gClippingsDB.transaction("r", gClippingsDB.clippings, gClippingsDB.folders, () => {
    let clipping = null;
    
    gClippingsDB.clippings.get(aClippingID).then(aClipping => {
      if (! aClipping) {
        throw new Error("Cannot find clipping with ID = " + aClippingID);
      }

      if (aClipping.parentFolderID == -1) {
        throw new Error("Attempting to paste a deleted clipping!");
      }

      clipping = aClipping;
      log(`Pasting clipping named "${clipping.name}"\nid = ${clipping.id}`);
        
      return gClippingsDB.folders.get(aClipping.parentFolderID);
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
  gClippingsDB.transaction("r", gClippingsDB.clippings, gClippingsDB.folders, () => {
    let results = gClippingsDB.clippings.where("shortcutKey").equals(aShortcutKey.toUpperCase());
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

      return gClippingsDB.folders.get(aClipping.parentFolderID);
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
  
  let tabs = await browser.tabs.query(queryInfo);
  if (! tabs[0]) {
    // This should never happen...
    alertEx(gMsgBoxStr.MSG_NO_ACTIVE_BROWSER_TAB);
    return;
  }

  let activeTabID = tabs[0].id;
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
      gPlaceholders.set(plchldrs, plchldrsWithDefaultVals, processedCtnt);
      
      openPlaceholderPromptDlg();
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
  browser.notifications.create(aeConst.NOTIFY_SYNC_ERROR_ID, {
    type: "basic",
    title: browser.i18n.getMessage("syncStartupFailedHdg"),
    message: browser.i18n.getMessage("syncStartupFailed"),
    iconUrl: "img/error.svg",
  });
}


//
// Utility functions
//

function getClippingsDB()
{
  return gClippingsDB;
}


function verifyDB()
{
  return new Promise((aFnResolve, aFnReject) => {
    let numClippings;

    gClippingsDB.clippings.count(aNumItems => {
      numClippings = aNumItems;
    }).then(() => {
      aFnResolve(numClippings);
    }).catch(aErr => {
      aFnReject(aErr);
    });
  });
}


function getOS()
{
  return gOS;
}


function getHostAppName()
{
  return gHostAppName;
}


function getClippingsListeners()
{
  return gClippingsListeners;
}

function getSyncClippingsListeners()
{
  return gSyncClippingsListeners;
}

function getPrefs()
{
  return gPrefs;
}


function isClippingsMgrRootFldrReseq()
{
  return gClippingsMgrRootFldrReseq;
}


function setClippingsMgrRootFldrReseq(aReseqOnReload)
{
  gClippingsMgrRootFldrReseq = aReseqOnReload;
}


function isGoogleChrome()
{
  return (! ("browser" in window));
}


function alertEx(aMessageID)
{
  let message = browser.i18n.getMessage(aMessageID);
  
  info("Clippings/wx: " + message);
  let url = "pages/msgbox.html?msgid=" + aMessageID;
  
  browser.windows.create({
    url: url,
    type: "popup",
    width: 520, height: 170,
    left: window.screen.availWidth - 520 / 2,
    top:  window.screen.availHeight - 170 / 2
  });
}


function versionCompare(aVer1, aVer2)
{
  if (typeof aVer1 != "string" || typeof aVer2 != "string") {
    return false;
  }

  let v1 = aVer1.split(".");
  let v2 = aVer2.split(".");

  // Last digit may include pre-release suffix, e.g.: a1, b2, rc1
  let vs1 = v1[v1.length - 1].toString();
  let vs2 = v2[v2.length - 1].toString();

  const k = Math.min(v1.length, v2.length);
  
  for (let i = 0; i < k; ++ i) {
    v1[i] = parseInt(v1[i], 10);
    v2[i] = parseInt(v2[i], 10);
    
    if (v1[i] > v2[i]) {
      return 1;
    }
    if (v1[i] < v2[i]) {
      return -1;
    }
  }

  let s1Idx = vs1.search(/[a-z]/);
  let s2Idx = vs2.search(/[a-z]/);

  // E.g.: 6.0 <=> 6.0a1
  if (s1Idx == -1 && s2Idx > 0) {
    return 1;
  }
  // E.g.: 6.0rc1 <=> 6.0
  if (s1Idx > 0 && s2Idx == -1) {
    return -1;
  }
  // E.g.: 6.0b1 <=> 6.0b2
  if (s1Idx > 0 && s2Idx > 0) {
    let s1 = vs1.substr(s1Idx);
    let s2 = vs2.substr(s2Idx);

    if (s1 < s2) {
      return -1;
    }
    if (s1 > s2) {
      return 1;
    }
  }
  
  return (v1.length == v2.length ? 0: (v1.length < v2.length ? -1 : 1));
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
    let tabs = await browser.tabs.query({ active: true, currentWindow: true });
    let activeTabID = tabs[0].id;
    gPasteClippingTargetTabID = activeTabID;
    log(`Clippings/wx: Active tab ID: ${activeTabID} - opening keyboard paste dialog.`);
    openKeyboardPasteDlg();
  }
});


browser.contextMenus.onClicked.addListener(async (aInfo, aTab) => {
  switch (aInfo.menuItemId) {
  case "ae-clippings-new":
    let tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (! tabs[0]) {
      alertEx(gMsgBoxStr.MSG_BROWSER_WND_NOT_FOCUSED);
      return;
    }

    let activeTabID = tabs[0].id;
    let url = tabs[0].url;
      
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
      alertEx(gMsgBoxStr.MSG_RETRY_PAGE_NOT_LOADED);
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
      alertEx(gMsgBoxStr.MSG_NO_TEXT_SELECTED);
      return;
    }

    let name = createClippingNameFromText(content);

    gNewClipping.set({ name, content, url });
    openNewClippingDlg();
    break;

  case "ae-clippings-manager":
    openClippingsManager();
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

  if (aAlarm.name == "show-backup-notifcn") {
    showBackupNotification();
  }
  else if (aAlarm.name == "show-sync-helper-upd-notifcn") {
    showSyncHelperUpdateNotification();
  }
});


browser.notifications.onClicked.addListener(aNotifID => {
  if (aNotifID == aeConst.NOTIFY_BACKUP_REMIND_ID) {
    // Open Clippings Manager in backup mode.
    openClippingsManager(true);
  }
  else if (aNotifID == aeConst.NOTIFY_BACKUP_REMIND_FIRSTRUN_ID) {
    openBackupDlg();
  }
  else if (aNotifID == aeConst.NOTIFY_SYNC_HELPER_UPDATE) {
    browser.tabs.create({ url: gSyncClippingsHelperDwnldPgURL });
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
  
  let resp = null;

  if (aRequest.msgID == "get-env-info") {
    resp = {
      os: gOS,
      hostAppName: gHostAppName,
      hostAppVer:  gHostAppVer,
    };
    
    return Promise.resolve(resp);
  }
  else if (aRequest.msgID == "init-new-clipping-dlg") {
    resp = gNewClipping.get();

    if (resp !== null) {
      resp.saveSrcURL = gPrefs.alwaysSaveSrcURL;
      resp.checkSpelling = gPrefs.checkSpelling;
      return Promise.resolve(resp);
    }
  }
  else if (aRequest.msgID == "init-placeholder-prmt-dlg") {
    resp = gPlaceholders.get();
    return Promise.resolve(resp);
  }
  else if (aRequest.msgID == "close-new-clipping-dlg") {
    gWndIDs.newClipping = null;
  }
  else if (aRequest.msgID == "close-clippings-mgr-wnd") {
    gWndIDs.clippingsMgr = null;
  }
  else if (aRequest.msgID == "close-keybd-paste-dlg") {
    gWndIDs.keyboardPaste = null;
  }
  else if (aRequest.msgID == "paste-shortcut-key") {
    let shortcutKey = aRequest.shortcutKey;
    if (! shortcutKey) {
      return;
    }

    log(`Clippings/wx: Key '${shortcutKey}' was pressed.`);
    pasteClippingByShortcutKey(shortcutKey);
  }

  else if (aRequest.msgID == "paste-clipping-by-name") {
    let externReq = aRequest.fromClippingsMgr;
    pasteClippingByID(aRequest.clippingID, externReq);
  }
  else if (aRequest.msgID == "paste-clipping-with-plchldrs") {
    let content = aRequest.processedContent;

    setTimeout(async () => {
      let tabs = await browser.tabs.query({active: true, currentWindow: true});
      if (! tabs[0]) {
        // This could happen if the browser tab was closed while the
        // placeholder prompt dialog was open.
        alertEx(gMsgBoxStr.MSG_NO_ACTIVE_BROWSER_TAB);
        return;
      }

      let activeTabID = tabs[0].id;
      if (activeTabID != gPasteClippingTargetTabID) {
        warn(`Clippings/wx: Detected mismatch between currently-active browser tab ID and what it was when invoking clipping paste.\nPrevious active tab ID = ${gPasteClippingTargetTabID}, active tab ID = ${activeTabID}`);
        activeTabID = gPasteClippingTargetTabID;
      }
      pasteProcessedClipping(content, activeTabID);
    }, 60);
  }
  else if (aRequest.msgID == "close-placeholder-prmt-dlg") {
    gWndIDs.placeholderPrmt = null;
  }
  else if (aRequest.msgID == "get-shct-key-prefix-ui-str") {
    resp = getShortcutKeyPrefixStr();
    return Promise.resolve(resp);
  }
});


window.addEventListener("unload", aEvent => {
  gClippingsListeners.remove(gClippingsListener);
});


//
// Catch any unhandled promise rejections from 3rd-party libs
//

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
