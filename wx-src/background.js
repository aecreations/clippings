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
  ORIGIN_CLIPPINGS_MGR: 1,
  ORIGIN_HOSTAPP: 2,
  ORIGIN_NEW_CLIPPING_DLG: 3,
  ORIGIN_WELCOME_PG: 4,

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
  origin: null,
  
  newClippingCreated: function (aID, aData)
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

  newFolderCreated: function (aID, aData)
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
    log("Clippings/wx: gClippingsListener.clippingChanged()");

    if (aData.name != aOldData.name) {
      // Rebuild the Clippings menu only if the clipping name has changed.
      rebuildContextMenu();
    }
  },

  folderChanged: function (aID, aData, aOldData)
  {
    log("Clippings/wx: gClippingsListener.folderChanged()");

    if ("isSync" in aOldData) {
      log("- The Synced Clippings folder is being converted to a normal folder. Ignoring DB changes.");
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
    chrome.contextMenus.update(syncFldrMenuID, { icons: { 16: "img/folder.svg" }});
  },

  onAfterDeactivate(aRemoveSyncFolder, aOldSyncFolderID)
  {
    function resetCxtMenuSyncItemsOnlyOpt(aRebuildCxtMenu) {
      if (gPrefs.cxtMenuSyncItemsOnly) {
        browser.storage.local.set({ cxtMenuSyncItemsOnly: false });
      }
      if (aRebuildCxtMenu) {
        rebuildContextMenu();
      }
    }

    log("Clippings/wx: gSyncClippingsListeners.onAfterDeactivate(): Remove Synced Clippings folder: " + aRemoveSyncFolder);

    if (aRemoveSyncFolder) {
      log(`Removing old Synced Clippings folder (ID = ${aOldSyncFolderID})`);
      purgeFolderItems(aOldSyncFolderID, false).then(() => {
        resetCxtMenuSyncItemsOnlyOpt();
      });
    }
    else {
      resetCxtMenuSyncItemsOnlyOpt(true);
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


//
// First-run initialization
//

browser.runtime.onInstalled.addListener(aDetails => {
  if (aDetails.reason == "install") {
    log("Clippings/wx: It appears that the extension is newly installed.  Welcome to Clippings 6!");

    // We can't detect if the previous install is the same version, so always
    // initialize user prefs with default values.
    setDefaultPrefs().then(() => {
      init();
    });
  }
  else if (aDetails.reason == "update") {
    let oldVer = aDetails.previousVersion;
    let currVer = chrome.runtime.getManifest().version;
    log(`Clippings/wx: Upgrading from version ${oldVer} to ${currVer}`);

    browser.storage.local.get().then(aPrefs => {
      gPrefs = aPrefs;

      if (! hasSanDiegoPrefs()) {
        gSetDisplayOrderOnRootItems = true;
        log("Initializing 6.1 user preferences.");
        return setSanDiegoPrefs();
      }
      return null;

    }).then(() => {
      if (! hasBalboaParkPrefs()) {
        gForceShowFirstTimeBkupNotif = true;
        log("Initializing 6.1.2 user preferences.");
        return setBalboaParkPrefs();
      }
      return null;

    }).then(() => {
      if (! hasMalibuPrefs()) {
        log("Initializing 6.2 user preferences.");
        return setMalibuPrefs();
      }
      return null;
      
    }).then(() => {
      init();
    });
  }
});


async function setDefaultPrefs()
{
  let aeClippingsPrefs = {
    showWelcome: true,
    htmlPaste: aeConst.HTMLPASTE_AS_FORMATTED,
    autoLineBreak: true,
    autoIncrPlcHldrStartVal: 0,
    alwaysSaveSrcURL: false,
    keyboardPaste: true,
    checkSpelling: true,
    openClippingsMgrInTab: false,
    pastePromptAction: aeConst.PASTEACTION_SHORTCUT_KEY,
    clippingsMgrDetailsPane: false,
    clippingsMgrStatusBar: false,
    clippingsMgrPlchldrToolbar: false,
    clippingsMgrMinzWhenInactv: undefined,
    syncClippings: false,
    syncFolderID: null,
    cxtMenuSyncItemsOnly: false,
    pasteShortcutKeyPrefix: "",
    lastBackupRemDate: null,
    backupRemFirstRun: true,
    backupRemFrequency: aeConst.BACKUP_REMIND_WEEKLY,
    afterSyncFldrReloadDelay: 3000,
    syncHelperCheckUpdates: true,
    lastSyncHelperUpdChkDate: null,
  };

  gPrefs = aeClippingsPrefs;
  await browser.storage.local.set(aeClippingsPrefs);
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

  await browser.storage.local.set(newPrefs);
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

  await browser.storage.local.set(newPrefs);
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
  };

  for (let pref in newPrefs) {
    gPrefs[pref] = newPrefs[pref];
  }

  await browser.storage.local.set(newPrefs);
}



//
// Browser window and Clippings menu initialization
//

browser.runtime.onStartup.addListener(() => {
  log("Clippings/wx: Initializing Clippings during browser startup.");
  
  browser.storage.local.get().then(aPrefs => {
    log("Clippings/wx: Successfully retrieved user preferences:");
    log(aPrefs);
    
    gPrefs = aPrefs;

    init();
  });
});


function init()
{
  log("Clippings/wx: Initializing integration with host app...");
  
  initClippingsDB();

  let getBrwsInfo = browser.runtime.getBrowserInfo();
  let getPlatInfo = browser.runtime.getPlatformInfo();

  Promise.all([getBrwsInfo, getPlatInfo]).then(aResults => {
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

    chrome.browserAction.onClicked.addListener(aTab => {
      openClippingsManager();
    });

    gClippingsListener.origin = gClippingsListeners.ORIGIN_HOSTAPP;
    gClippingsListeners.add(gClippingsListener);
    gSyncClippingsListeners.add(gSyncClippingsListener);
    
    window.addEventListener("unload", onUnload, false);
    initMessageListeners();

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

    browser.storage.onChanged.addListener((aChanges, aAreaName) => {
      let changedPrefs = Object.keys(aChanges);

      for (let pref of changedPrefs) {
        gPrefs[pref] = aChanges[pref].newValue;

        if (pref == "autoIncrPlcHldrStartVal") {
          aeClippingSubst.setAutoIncrementStartValue(aChanges[pref].newValue);
        }
        else if (gPrefs.pasteShortcutKeyPrefix && !isDirectSetKeyboardShortcut()) {
          setShortcutKeyPrefix(gPrefs.pasteShortcutKeyPrefix);
        }
      }
    });

    chrome.commands.onCommand.addListener(aCmdName => {
      info(`Clippings/wx: Command "${aCmdName}" invoked!`);

      if (aCmdName == aeConst.CMD_CLIPPINGS_KEYBOARD_PASTE && gPrefs.keyboardPaste) {
        browser.tabs.query({ active: true, currentWindow: true }).then(aTabs => {
          let activeTabID = aTabs[0].id;
          gPasteClippingTargetTabID = activeTabID;
          log(`Clippings/wx: Active tab ID: ${activeTabID} - opening keyboard paste dialog.`);
          openKeyboardPasteDlg();
        });
      }
    });

    if (gPrefs.pasteShortcutKeyPrefix && !isDirectSetKeyboardShortcut()) {
      setShortcutKeyPrefix(gPrefs.pasteShortcutKeyPrefix);
    }

    if (gPrefs.backupRemFirstRun && !gPrefs.lastBackupRemDate) {
      browser.storage.local.set({
        lastBackupRemDate: new Date().toString(),
      });
    }

    // Check in 5 minutes whether to show backup reminder notification.
    window.setTimeout(showBackupNotification, aeConst.BACKUP_REMINDER_DELAY_MS);

    if (gPrefs.syncClippings && gPrefs.syncHelperCheckUpdates) {
      // Check for updates to Sync Clippings Helper native app in 10 minutes.
      window.setTimeout(showSyncHelperUpdateNotification, aeConst.SYNC_HELPER_CHECK_UPDATE_DELAY_MS);
    }

    if (gPrefs.showWelcome) {
      openWelcomePage();
      browser.storage.local.set({ showWelcome: false });
    }

    if (gSetDisplayOrderOnRootItems) {
      setDisplayOrderOnRootItems().then(() => {
        gIsInitialized = true;
        log("Clippings/wx: Display order on root folder items have been set.\nClippings initialization complete.");
      });
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
        name: chrome.i18n.getMessage("syncFldrName"),
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

      await browser.storage.local.set({ syncFolderID: gSyncFldrID });
      log("Clippings/wx: enableSyncClippings(): Synced Clippings folder ID: " + gSyncFldrID);
      return gSyncFldrID;
    }
  }
  else {
    log("Clippings/wx: enableSyncClippings(): Turning OFF");
    let oldSyncFldrID = gSyncFldrID;

    let numUpd = await gClippingsDB.folders.update(gSyncFldrID, { isSync: undefined });
    await browser.storage.local.set({ syncFolderID: null });
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
        name: chrome.i18n.getMessage("syncFldrName"),
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
      return browser.storage.local.set({ syncFolderID: gSyncFldrID });
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

    window.setTimeout(function () {
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


function initMessageListeners()
{
  if (isGoogleChrome()) {
    chrome.runtime.onMessage.addListener((aRequest, aSender, aSendResponse) => {
      log(`Clippings/wx: Received Chrome message "${aRequest.msgID}"`);

      let resp = null;

      if (aRequest.msgID == "init-new-clipping-dlg") {
        resp = gNewClipping.get();
        if (resp !== null) {
          resp.saveSrcURL = gPrefs.alwaysSaveSrcURL;
          resp.checkSpelling = gPrefs.checkSpelling;
          aSendResponse(resp);
        }
      }
      else if (aRequest.msgID == "init-placeholder-prmt-dlg") {
        resp = {
          // TO DO: Populate response object; replicate Firefox code below.
        };
        aSendResponse(resp);
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
        // TO DO: Same logic as for Firefox.
      }
      else if (aRequest.msgID == "paste-clipping-by-name") {
        // TO DO: Ditto.
      }
      else if (aRequest.msgID == "close-placeholder-prmt-dlg") {
        // TO DO: Ditto as well.
      }
    });
  }                                  
  else {
    // Firefox
    browser.runtime.onMessage.addListener(aRequest => {
      log(`Clippings/wx: Received message "${aRequest.msgID}"`);
      
      let resp = null;

      if (aRequest.msgID == "init-new-clipping-dlg") {
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

        window.setTimeout(function () {
          browser.tabs.query({active: true, currentWindow: true}).then(aTabs => {
            if (! aTabs[0]) {
              // This could happen if the browser tab was closed while the
              // placeholder prompt dialog was open.
              alertEx(aeMsgBox.MSG_NO_ACTIVE_BROWSER_TAB);
              return;
            }

            let activeTabID = aTabs[0].id;
            if (activeTabID != gPasteClippingTargetTabID) {
              warn(`Clippings/wx: Detected mismatch between currently-active browser tab ID and what it was when invoking clipping paste.\nPrevious active tab ID = ${gPasteClippingTargetTabID}, active tab ID = ${activeTabID}`);
              activeTabID = gPasteClippingTargetTabID;
            }
            pasteProcessedClipping(content, activeTabID);
            
          }).catch(aErr => {
            console.error("Failed to query tabs: " + aErr);
          });
        }, 60);
      }
      else if (aRequest.msgID == "close-placeholder-prmt-dlg") {
        gWndIDs.placeholderPrmt = null;
      }
    });
  }
}


async function setShortcutKeyPrefix(aShortcutKeyPrefix)
{
  await browser.commands.update({
    name: aeConst.CMD_CLIPPINGS_KEYBOARD_PASTE,
    shortcut: aShortcutKeyPrefix,
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
  chrome.contextMenus.create({
    id: "ae-clippings-reset-autoincr-plchldrs",
    title: chrome.i18n.getMessage("baMenuResetAutoIncrPlaceholders"),
    enabled: false,
    contexts: ["browser_action"],
    documentUrlPatterns: ["<all_urls>"]
  });

  // Context menu for web page textbox or HTML editor.
  chrome.contextMenus.create({
    id: "ae-clippings-new",
    title: chrome.i18n.getMessage("cxtMenuNew"),
    contexts: ["editable", "selection"],
    documentUrlPatterns: ["<all_urls>"]
  });

  chrome.contextMenus.create({
    id: "ae-clippings-manager",
    title: chrome.i18n.getMessage("cxtMenuOpenClippingsMgr"),
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
      chrome.contextMenus.create({
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

    chrome.contextMenus.create(menuItem);
    
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
      chrome.contextMenus.update(menuItemID, updatePpty);
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
    chrome.contextMenus.update(menuItemID, { title: aResult.name });
  });
}


function removeContextMenuForClipping(aRemovedClippingID)
{
  let menuItemID = gClippingMenuItemIDMap[aRemovedClippingID];
  chrome.contextMenus.remove(menuItemID);
  delete gClippingMenuItemIDMap[aRemovedClippingID];
}


function removeContextMenuForFolder(aRemovedFolderID)
{
  let menuItemID = gFolderMenuItemIDMap[aRemovedFolderID];
  chrome.contextMenus.remove(menuItemID);
  delete gFolderMenuItemIDMap[aRemovedFolderID];
}


function rebuildContextMenu()
{
  log("Clippings/wx: rebuildContextMenu(): Removing all Clippings context menu items and rebuilding the menu...");
  chrome.contextMenus.removeAll(() => {
    gClippingMenuItemIDMap = {};
    gFolderMenuItemIDMap = {};
    buildContextMenu();
  });
}


function buildAutoIncrementPlchldrResetMenu(aAutoIncrPlchldrs)
{
  let enabledResetMenu = false;
  
  aAutoIncrPlchldrs.forEach(function (aItem, aIndex, aArray) {
    if (! gAutoIncrPlchldrs.has(aItem)) {
      gAutoIncrPlchldrs.add(aItem);

      let menuItem = {
        id: `ae-clippings-reset-autoincr-${aItem}`,
        title: `#[${aItem}]`,
        parentId: "ae-clippings-reset-autoincr-plchldrs",
        contexts: ["browser_action"],
        documentUrlPatterns: ["<all_urls>"]
      };
      
      chrome.contextMenus.create(menuItem, () => {
        if (! enabledResetMenu) {
          chrome.contextMenus.update("ae-clippings-reset-autoincr-plchldrs", {
            enabled: true
          }, () => { enabledResetMenu = true });
        }
      });
    }
  });
}


function resetAutoIncrPlaceholder(aPlaceholder)
{
  log(`Clippings/wx: resetAutoIncrPlaceholder(): Resetting placeholder: #[${aPlaceholder}]`);

  aeClippingSubst.resetAutoIncrementVar(aPlaceholder);
  gAutoIncrPlchldrs.delete(aPlaceholder);
  chrome.contextMenus.remove(`ae-clippings-reset-autoincr-${aPlaceholder}`, () => {
    if (gAutoIncrPlchldrs.size == 0) {
      chrome.contextMenus.update("ae-clippings-reset-autoincr-plchldrs", { enabled: false });
    }
  });
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
        title: chrome.i18n.getMessage("backupNotifyTitle"),
        message: chrome.i18n.getMessage("backupNotifyFirstMsg"),
        iconUrl: "img/icon.svg",

      }).then(aNotifID => {
        browser.storage.local.set({
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
        title: chrome.i18n.getMessage("backupNotifyTitle"),
        message: chrome.i18n.getMessage("backupNotifyMsg"),
        iconUrl: "img/icon.svg",

      }).then(aNotifID => {
        clearBackupNotificationInterval();
        setBackupNotificationInterval();
        browser.storage.local.set({ lastBackupRemDate: new Date().toString() });
      });
    }
  }
  else {
    clearBackupNotificationInterval();
    setBackupNotificationInterval();
  }
}   


function setBackupNotificationInterval()
{
  log("Clippings/wx: Setting backup notification interval (every 24 hours).");
  gBackupRemIntervalID = window.setInterval(showBackupNotification, aeConst.BACKUP_REMINDER_INTERVAL_MS);
}


function clearBackupNotificationInterval()
{
  if (gBackupRemIntervalID) {
    window.clearInterval(gBackupRemIntervalID);
    gBackupRemIntervalID = null;
  }
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
      throw new Error("Unable to retrieve Sync Clippings Helper update info - network response was not ok");

    }).then(aUpdateInfo => {
      if (versionCompare(currVer, aUpdateInfo.latestVersion) < 0) {
        info(`Clippings/wx: showSyncHelperUpdateNotification(): Found a newer version of Sync Clippings Helper!  Current version: ${currVer}; new version found: ${aUpdateInfo.latestVersion}\nDisplaying user notification.`);
        
        gSyncClippingsHelperDwnldPgURL = aUpdateInfo.downloadPageURL;
        return browser.notifications.create(aeConst.NOTIFY_SYNC_HELPER_UPDATE, {
          type: "basic",
          title: chrome.i18n.getMessage("syncUpdateTitle"),
          message: chrome.i18n.getMessage("syncUpdateMsg"),
          iconUrl: "img/syncClippingsApp.svg",
        });
      }
      else {
        return null;
      }

    }).then(aNotifID => {
      browser.storage.local.set({ lastSyncHelperUpdChkDate: new Date().toString() });
      
    }).catch(aErr => {
      console.error("Clippings/wx: showSyncHelperUpdateNotification(): Unable to check for updates to the Sync Clippings Helper app at this time.\n" + aErr);
    });
  }
}


function openWelcomePage()
{
  let url = browser.runtime.getURL("pages/welcome.html");
  browser.tabs.create({ url }).then(aTab => {
    browser.history.deleteUrl({ url });
  });
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


function openClippingsManager(aBackupMode)
{
  let clippingsMgrURL = chrome.runtime.getURL("pages/clippingsMgr.html");

  chrome.windows.getCurrent(aBrwsWnd => {
    clippingsMgrURL += "?openerWndID=" + aBrwsWnd.id;

    if (aBackupMode) {
      clippingsMgrURL += "&backupMode=1";
    }
    
    function openClippingsMgrHelper()
    {
      let wndInfo = {
        url: clippingsMgrURL,
        type: "popup",
        width: 750, height: 400,
        left: 64, top: 128,
      };

      browser.windows.create(wndInfo).then(aWnd => {
        gWndIDs.clippingsMgr = aWnd.id;
        browser.history.deleteUrl({ url: clippingsMgrURL });
      });
    }
    
    let openInNewTab = gPrefs.openClippingsMgrInTab;

    if (isGoogleChrome() || openInNewTab) {
      try {
        chrome.tabs.create({ url: clippingsMgrURL }, () => {
          chrome.history.deleteUrl({ url: clippingsMgrURL });
        });
      }
      catch (e) {
        onError(e);
      }
    }
    else {
      if (gWndIDs.clippingsMgr) {
        browser.windows.get(gWndIDs.clippingsMgr).then(aWnd => {
          browser.windows.update(gWndIDs.clippingsMgr, { focused: true });
        }, aErr => {
          // Handle dangling ref to previously-closed Clippings Manager window
          // because it was closed before it finished initializing.
          gWndIDs.clippingsMgr = null;
          openClippingsMgrHelper();
        });
      }
      else {
        openClippingsMgrHelper();
      }
    }
  });
}


function openNewClippingDlg()
{
  let url = chrome.runtime.getURL("pages/new.html");
  let height = 386;
  if (gOS == "win") {
    height = 422;
  }
  openDlgWnd(url, "newClipping", { type: "detached_panel", width: 428, height });
}


function openKeyboardPasteDlg()
{
  // TO DO: Check first if the cursor is in a web page textbox or HTML editor.
  // If not, then don't do anything.

  let url = browser.runtime.getURL("pages/keyboardPaste.html");
  openDlgWnd(url, "keyboardPaste", { type: "detached_panel", width: 500, height: 164 });
}


function openPlaceholderPromptDlg()
{
  // TO DO: Same checking for cursor location as in the preceding function.

  let url = browser.runtime.getURL("pages/placeholderPrompt.html");
  openDlgWnd(url, "placeholderPrmt", { type: "detached_panel", width: 500, height: 180 });
}


function openBackupDlg()
{
  let url = browser.runtime.getURL("pages/backup.html");
  openDlgWnd(url, "backupFirstRun", { type: "detached_panel", width: 500, height: 390 });
}


function openDlgWnd(aURL, aWndKey, aWndPpty)
{
  function openDlgWndHelper()
  {
    browser.windows.create({
      url: aURL,
      type: aWndPpty.type,
      width: aWndPpty.width,
      height: aWndPpty.height,
      left: window.screen.availWidth - aWndPpty.width / 2,
      top:  window.screen.availHeight - aWndPpty.height / 2
    }).then(aWnd => {
      gWndIDs[aWndKey] = aWnd.id;
      browser.history.deleteUrl({ url: aURL });
    }, aErr => {
      onError(aErr);
    });
  }

  if (gWndIDs[aWndKey]) {
    browser.windows.get(gWndIDs[aWndKey]).then(aWnd => {
      browser.windows.update(gWndIDs[aWndKey], { focused: true });
    }, aErr => {
      gWndIDs[aWndKey] = null;
      openDlgWndHelper();
    });
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


function pasteClipping(aClippingInfo, aExternalRequest)
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
  
  chrome.tabs.query(queryInfo, aTabs => {
    if (! aTabs[0]) {
      // This should never happen...
      alertEx(aeMsgBox.MSG_NO_ACTIVE_BROWSER_TAB);
      return;
    }

    let activeTabID = aTabs[0].id;
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
  });
}


function pasteProcessedClipping(aClippingContent, aActiveTabID)
{
  let msgParams = {
    msgID: "paste-clipping",
    content: aClippingContent,
    htmlPaste: gPrefs.htmlPaste,
    autoLineBreak: gPrefs.autoLineBreak
  };

  log(`Clippings/wx: Extension sending message "paste-clipping" to content script (active tab ID = ${aActiveTabID})`);
  
  if (isGoogleChrome()) {
    chrome.tabs.sendMessage(aActiveTabID, msgParams, null);
  }
  else {
    // Firefox
    window.setTimeout(function () {
      browser.tabs.sendMessage(aActiveTabID, msgParams).then(aResult => {
        // If successful, aResult should be true.
      }).catch(aErr => {
        console.error("Clippings/wx: pasteProcessedClipping(): Failed to paste clipping: " + aErr);
      }).finally(() => {
        gPasteClippingTargetTabID = null;
      });
    }, 150);    
  }
}


function isDirectSetKeyboardShortcut()
{
  let fxMajorVer = gHostAppVer.split(".")[0];
  
  return (fxMajorVer >= 66);
}


function onUnload(aEvent)
{
  gClippingsListeners.remove(gClippingsListener);
}


function showSyncErrorNotification()
{
  browser.notifications.create(aeConst.NOTIFY_SYNC_ERROR_ID, {
    type: "basic",
    title: chrome.i18n.getMessage("syncStartupFailedHdg"),
    message: chrome.i18n.getMessage("syncStartupFailed"),
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


function getSyncFolderID()
{
  return gSyncFldrID;
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
  let message = chrome.i18n.getMessage(aMessageID);
  
  if (isGoogleChrome()) {
    window.alert(message);
  }
  else {
    info("Clippings/wx: " + message);
    let url = "pages/msgbox.html?msgid=" + aMessageID;
    
    chrome.windows.create({
      url: url,
      type: "popup",
      width: 520, height: 170,
      left: window.screen.availWidth - 520 / 2,
      top:  window.screen.availHeight - 170 / 2
    });
  }
}


// Adapted from <https://github.com/hirak/phpjs>
function versionCompare(v1, v2, operator) {
  var i = 0,
    x = 0,
    compare = 0,
    // vm maps textual PHP versions to negatives so they're less than 0.
    // PHP currently defines these as CASE-SENSITIVE. It is important to
    // leave these as negatives so that they can come before numerical versions
    // and as if no letters were there to begin with.
    // (1alpha is < 1 and < 1.1 but > 1dev1)
    // If a non-numerical value can't be mapped to this table, it receives
    // -7 as its value.
    vm = {
      'dev'   : -6,
      'alpha' : -5,
      'a'     : -5,
      'beta'  : -4,
      'b'     : -4,
      'RC'    : -3,
      'rc'    : -3,
      '#'     : -2,
      'p'     : 1,
      'pl'    : 1
    },
    // This function will be called to prepare each version argument.
    // It replaces every _, -, and + with a dot.
    // It surrounds any nonsequence of numbers/dots with dots.
    // It replaces sequences of dots with a single dot.
    //    version_compare('4..0', '4.0') == 0
    // Important: A string of 0 length needs to be converted into a value
    // even less than an unexisting value in vm (-7), hence [-8].
    // It's also important to not strip spaces because of this.
    //   version_compare('', ' ') == 1
    prepVersion = function(v) {
      v = ('' + v)
        .replace(/[_\-+]/g, '.');
      v = v.replace(/([^.\d]+)/g, '.$1.')
        .replace(/\.{2,}/g, '.');
      return (!v.length ? [-8] : v.split('.'));
    };
  // This converts a version component to a number.
  // Empty component becomes 0.
  // Non-numerical component becomes a negative number.
  // Numerical component becomes itself as an integer.
  numVersion = function(v) {
    return !v ? 0 : (isNaN(v) ? vm[v] || -7 : parseInt(v, 10));
  };
  v1 = prepVersion(v1);
  v2 = prepVersion(v2);
  x = Math.max(v1.length, v2.length);
  for (i = 0; i < x; i++) {
    if (v1[i] == v2[i]) {
      continue;
    }
    v1[i] = numVersion(v1[i]);
    v2[i] = numVersion(v2[i]);
    if (v1[i] < v2[i]) {
      compare = -1;
      break;
    } else if (v1[i] > v2[i]) {
      compare = 1;
      break;
    }
  }
  if (!operator) {
    return compare;
  }

  // Important: operator is CASE-SENSITIVE.
  // "No operator" seems to be treated as "<."
  // Any other values seem to make the function return null.
  switch (operator) {
  case '>':
  case 'gt':
    return (compare > 0);
  case '>=':
  case 'ge':
    return (compare >= 0);
  case '<=':
  case 'le':
    return (compare <= 0);
  case '==':
  case '=':
  case 'eq':
    return (compare === 0);
  case '<>':
  case '!=':
  case 'ne':
    return (compare !== 0);
  case '':
  case '<':
  case 'lt':
    return (compare < 0);
  default:
    return null;
  }
}



//
// Click event listener for the context menu items
//

chrome.contextMenus.onClicked.addListener((aInfo, aTab) => {
  switch (aInfo.menuItemId) {
  case "ae-clippings-new":
    let text = aInfo.selectionText;  // N.B.: Line breaks are NOT preserved!

    chrome.tabs.query({ active: true, currentWindow: true }, aTabs => {
      if (! aTabs[0]) {
        alertEx(aeMsgBox.MSG_BROWSER_WND_NOT_FOCUSED);
        return;
      }

      let activeTabID = aTabs[0].id;
      let url = aTabs[0].url;
      
      chrome.tabs.get(activeTabID, aTabInfo => {
        if (aTabInfo.status == "loading") {
          console.warn("Clippings/wx: The active tab (ID = %s) is still loading or busy. Messages sent to it now may not receive a response.", activeTabID);
        }
      });
      
      log("Clippings/wx: Extension sending message \"new-clipping\" to content script; active tab ID: " + activeTabID);

      if (isGoogleChrome()) {
        chrome.tabs.sendMessage(activeTabID, { msgID: "new-clipping", hostApp: "chrome" }, null, aResp => {
          let content = aResp.content;
          if (! content) {
            console.warn("Clippings/wx: Content script was unable to retrieve content from the web page.  Retrieving selection text from context menu info.");
            content = text;
          }

          gNewClipping.set({ name, content, url });
          openNewClippingDlg();
        });
      }
      else {
        // Firefox
        let sendMsg = browser.tabs.sendMessage(activeTabID, { msgID: "new-clipping" });
        sendMsg.then(aResp => {
          if (! aResp) {
            console.error("Clippings/wx: Unable to receive response from content script!");
            alertEx(aeMsgBox.MSG_RETRY_PAGE_BUSY);
            return;
          }

          let content;

          if (aResp.content) {
            content = aResp.content;
          }
          else {
            alertEx(aeMsgBox.MSG_NO_TEXT_SELECTED);
            return;
          }

          let name = createClippingNameFromText(content);

          gNewClipping.set({ name, content, url });
          openNewClippingDlg();
        }, aErr => {
          alertEx(aeMsgBox.MSG_RETRY_PAGE_NOT_LOADED);
        });
      }
    });

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


//
// Click event listener for notifications
//

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
