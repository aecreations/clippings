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
let gAutoIncrPlchldrs = null;
let gClippingMenuItemIDMap = {};
let gFolderMenuItemIDMap = {};
let gSyncFldrID = null;
let gBackupRemIntervalID = null;
let gPasteClippingTargetTabID = null;
let gIsReloadingSyncFldr = false;

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
  origin: null,
  
  newClippingCreated: function (aID, aData) {
    if (gIsReloadingSyncFldr) {
      log("Clippings/wx: gClippingsListener.newClippingCreated(): The Synced Clippings folder is being reloaded. Ignoring DB changes.");
      return;
    }

    rebuildContextMenu();
  },

  newFolderCreated: function (aID, aData) {
    if (gIsReloadingSyncFldr || "isSync" in aData) {
      log("Clippings/wx: gClippingsListener.newFolderCreated(): The Synced Clippings folder is being reloaded. Ignoring DB changes.");
      return;
    }

    rebuildContextMenu();
  },

  clippingChanged: function (aID, aData, aOldData) {
    log("Clippings/wx: gClippingsListener.clippingChanged()");
    rebuildContextMenu();
  },

  folderChanged: function (aID, aData, aOldData) {
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

  afterBatchChanges: function (aDBChanges) {
    if (gIsReloadingSyncFldr) {
      log("Clippings/wx: gClippingsListener.afterBatchChanges(): The Synced Clippings folder is being reloaded. Ignoring DB changes.");
      return;
    }

    if (this._isImporting) {
      log("Clippings/wx: gClippingsListener.afterBatchChanges(): Import in progress. Ignoring DB changes.")
      return;
    }

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
  _oldSyncFldrID: null,
  
  onActivate(aSyncFolderID)
  {
    // No need to do anything here. The Clippings context menu is automatically
    // rebuilt when the Sync Clippings data is imported, which occurs after
    // turning on Sync Clippings from extension preferences.
  },

  onDeactivate(aOldSyncFolderID)
  {
    log("Clippings/wx: gSyncClippingsListener.onDeactivate()");
    this._oldSyncFldrID = aOldSyncFolderID;
    
    // TO DO: Instead of rebuilding the entire menu, just change the icon on the
    // "Synced Clippings" folder to be a normal folder icon.
    //rebuildContextMenu();
  },

  onAfterDeactivate(aRemoveSyncFolder)
  {
    log("Clippings/wx: gSyncClippingsListeners.onAfterDeactivate(): Remove Synced Clippings folder: " + aRemoveSyncFolder);

    let that = this;

    if (aRemoveSyncFolder) {
      log(`Removing old Synced Clippings folder (ID = ${that._oldSyncFldrID})`);
      purgeFolderItems(this._oldSyncFldrID, false).then(() => {
        that._oldSyncFldrID = null;
      });
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
      
      if (versionCompare(oldVer, "6.1", { lexicographical: true }) <= 0) {
        log("Clippings/wx: Upgrade to version 6.1 detected. Initializing new user preferences.");
        setNewPrefs().then(() => {
          gSetDisplayOrderOnRootItems = true;
          init();
        });
      }
      else {
        init();
      }
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
    pasteShortcutKeyPrefix: "",
    lastBackupRemDate: null,
    backupRemFirstRun: true,
    backupRemFrequency: aeConst.BACKUP_REMIND_WEEKLY,
    afterSyncFldrReloadDelay: 3000,
  };

  gPrefs = aeClippingsPrefs;
  await browser.storage.local.set(aeClippingsPrefs);
}


async function setNewPrefs()
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
  
  if (! ("browser" in window)) {
    gHostAppName = "Google Chrome";
    log("Clippings/wx: Host app: Google Chrome");
  }
  else {
    let getBrowserInfo = browser.runtime.getBrowserInfo();
    getBrowserInfo.then(aBrwsInfo => {
      gHostAppName = `${aBrwsInfo.name} ${aBrwsInfo.version}`;
      log(`Clippings/wx: Host app: ${aBrwsInfo.name} (version ${aBrwsInfo.version})`);
    });
  }

  chrome.runtime.getPlatformInfo(aInfo => {
    log("Clippings/wx: OS: " + aInfo.os);
    gOS = aInfo.os;

    if (gPrefs.clippingsMgrMinzWhenInactv === undefined) {
      gPrefs.clippingsMgrMinzWhenInactv = (gOS == "linux");
    }
  });

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
      else if (gPrefs.pasteShortcutKeyPrefix) {
        setShortcutKeyPrefix(gPrefs.pasteShortcutKeyPrefix);
      }
    }
  });

  chrome.commands.onCommand.addListener(aCmdName => {
    info(`Clippings/wx: Command "${aCmdName}" invoked!`);

    if (aCmdName == "ae-clippings-paste-clipping" && gPrefs.keyboardPaste) {
      browser.tabs.query({ active: true, currentWindow: true }).then(aTabs => {
        let activeTabID = aTabs[0].id;
        gPasteClippingTargetTabID = activeTabID;
        log(`Clippings/wx: Active tab ID: ${activeTabID} - opening keyboard paste dialog.`);
        openKeyboardPasteDlg();
      });
    }
  });

  if (gPrefs.pasteShortcutKeyPrefix) {
    setShortcutKeyPrefix(gPrefs.pasteShortcutKeyPrefix);
  }

  if (gPrefs.backupRemFirstRun) {
    browser.storage.local.set({
      lastBackupRemDate: new Date().toString(),
    });
  }

  // Check in 5 minutes whether to show backup reminder notification.
  window.setTimeout(showBackupNotification, aeConst.BACKUP_REMINDER_DELAY_MS);

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
}


function initClippingsDB()
{
  gClippingsDB = new Dexie("aeClippings");
  gClippingsDB.version(1).stores({
    clippings: "++id, name, parentFolderID"
  });
  // Needed to be able to use the Dexie.Observable add-on.
  gClippingsDB.version(2).stores({});

  gClippingsDB.version(3).stores({
    folders: "++id, name, parentFolderID"
  });
  gClippingsDB.version(4).stores({
    clippings: "++id, name, parentFolderID, shortcutKey"
  });
  
  gClippingsDB.on("changes", aChanges => {
    let clippingsListeners = gClippingsListeners.getListeners();

    if (aChanges.length > 1) {
      // Don't do anything if only displayOrder was changed.
      let isDisplayOrderOnlyChanged = false;
      for (let i = 0; i < aChanges.length; i++) {
        let pptyChanges = aChanges[i].mods;

        if (pptyChanges !== undefined && ("displayOrder" in pptyChanges)
            && Object.keys(pptyChanges).length == 1) {
          isDisplayOrderOnlyChanged = true;
        }
      }

      if (isDisplayOrderOnlyChanged) {
        return;
      }

      info(`Clippings/wx: There are ${aChanges.length} DB changes detected. Calling afterBatchChanges() on all Clippings listeners.`);
      
      clippingsListeners.forEach(aListener => { aListener.afterBatchChanges(aChanges) });
      return;
    }

    log(`Clippings/wx: Invoking DB listener method on ${clippingsListeners.length} listeners.`);
    
    aChanges.forEach(aChange => {
      switch (aChange.type) {
      case aeConst.DB_CREATED:
        info("Clippings/wx: Database observer detected CREATED event");
        
        if (aChange.table == "clippings") {
          clippingsListeners.forEach(aListener => {
            aListener.newClippingCreated(aChange.key, aChange.obj);
          });
        }
        else if (aChange.table == "folders") {
          clippingsListeners.forEach(aListener => {
            aListener.newFolderCreated(aChange.key, aChange.obj);
          });
        }
        break;
        
      case aeConst.DB_UPDATED:
        info("Clippings/wx: Database observer detected UPDATED event");

        // Don't do anything if only the displayOrder was changed.
        if (aChange.mods !== undefined && ("displayOrder" in aChange.mods)
            && Object.keys(aChange.mods).length == 1) {
          break;
        }

        if (aChange.table == "clippings") {
          clippingsListeners.forEach(aListener => {
            aListener.clippingChanged(aChange.key, aChange.obj, aChange.oldObj);
          });
        }
        else if (aChange.table == "folders") {
          clippingsListeners.forEach(aListener => {
            aListener.folderChanged(aChange.key, aChange.obj, aChange.oldObj);
          });
        }
        break;
        
      case aeConst.DB_DELETED:
        info("Clippings/wx: Database observer detected DELETED event");
        if (aChange.table == "clippings") {
          clippingsListeners.forEach(aListener => {
            aListener.clippingDeleted(aChange.key, aChange.oldObj);
          });
        }
        else if (aChange.table == "folders") {
          clippingsListeners.forEach(aListener => {
            aListener.folderDeleted(aChange.key, aChange.oldObj);
          });
        }
        break;
        
      default:
        break;
      }
    });
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
function refreshSyncedClippings(aIsInitHostApp)
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
    if (aIsInitHostApp) {
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
        let tabQuery = { active: true, currentWindow: true };

        browser.tabs.query(tabQuery).then(aTabs => {
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
    name: "ae-clippings-paste-clipping",
    shortcut: aShortcutKeyPrefix,
  });
}


function getShortcutKeyPrefixStr()
{
  let rv = "";
  let keybPasteKey = "";
  
  if (gPrefs.pasteShortcutKeyPrefix) {
    keybPasteKey = gPrefs.pasteShortcutKeyPrefix.split("+")[2];
  }
  else {
    let extManifest = chrome.runtime.getManifest();
    let suggKey = extManifest.commands["ae-clippings-paste-clipping"]["suggested_key"];
    let defaultPasteKey = "";

    if (gOS == "mac") {
      defaultPasteKey = suggKey["mac"];
    }
    else {
      defaultPasteKey = suggKey["default"];
    }
    keybPasteKey = defaultPasteKey.split("+")[2];
  }

  if (keybPasteKey == "Period") {
    keybPasteKey = ".";
  }
  else if (keybPasteKey == "Comma") {
    keybPasteKey = ",";
  }
  
  if (gOS == "mac") {
    rv = `\u21e7\u2318${keybPasteKey}`;
  }
  else {
    rv = `${chrome.i18n.getMessage("keyAlt")}+${chrome.i18n.getMessage("keyShift")}+${keybPasteKey}`;
  }

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

  getContextMenuData(aeConst.ROOT_FOLDER_ID).then(aMenuData => {
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
  let diff = new DateDiff(today, lastBackupRemDate);
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

  if (diff.days >= numDays) {
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
    browser.tabs.sendMessage(aActiveTabID, msgParams).then(aResult => {
      // If successful, aResult should be true.
    }).catch(aErr => {
      console.error("Clippings/wx: pasteProcessedClipping(): Failed to paste clipping with placeholders: " + aErr);
    }).finally(() => {
      gPasteClippingTargetTabID = null;
    });
  }
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
    console.info("Clippings/wx: " + message);
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


// Compares two software version numbers (e.g. "1.7.1" or "1.2b").
// Return value:
// - 0 if the versions are equal
// - a negative integer iff v1 < v2
// - a positive integer iff v1 > v2
// - NaN if either version string is in the wrong format
//
// Source: <https://gist.github.com/pc035860/ccb58a02f5085db0c97d>
function versionCompare(v1, v2, options)
{
  var lexicographical = options && options.lexicographical,
      zeroExtend = options && options.zeroExtend,
      v1parts = v1.split('.'),
      v2parts = v2.split('.');

  function isValidPart(x) {
    return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
  }

  if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
    return NaN;
  }

  if (zeroExtend) {
    while (v1parts.length < v2parts.length) v1parts.push("0");
    while (v2parts.length < v1parts.length) v2parts.push("0");
  }

  if (!lexicographical) {
    v1parts = v1parts.map(Number);
    v2parts = v2parts.map(Number);
  }

  for (var i = 0; i < v1parts.length; ++i) {
    if (v2parts.length == i) {
      return 1;
    }

    if (v1parts[i] == v2parts[i]) {
      continue;
    }
    else if (v1parts[i] > v2parts[i]) {
      return 1;
    }
    else {
      return -1;
    }
  }

  if (v1parts.length != v2parts.length) {
    return -1;
  }

  return 0;
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
// Click event listener for backup reminder notifications
//

browser.notifications.onClicked.addListener(aNotifID => {
  if (aNotifID == aeConst.NOTIFY_BACKUP_REMIND_ID) {
    // Open Clippings Manager in backup mode.
    openClippingsManager(true);
  }
  else if (aNotifID == aeConst.NOTIFY_BACKUP_REMIND_FIRSTRUN_ID) {
    openBackupDlg();
  }
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
