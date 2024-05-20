/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let aePrefs = {
  _defaultState: {
    // Background script state persistence
    _isInitialized: false,
    _clippingMenuItemIDMap: {},
    _folderMenuItemIDMap: {},
    _autoIncrPlchldrs: [],
    _autoIncrPlchldrVals: {},
    _forceShowFirstTimeBkupNotif: false,
    _syncClippingsHelperDwnldPgURL: null,
    _wndIDs: {
      newClipping: null,
      keyboardPaste: null,
      placeholderPrmt: null,
      clippingsMgr: null,
    },
  },
  
  _defaultPrefs: {
    // User preferences and customizations
    showWelcome: true,
    htmlPaste: aeConst.HTMLPASTE_AS_FORMATTED,
    autoLineBreak: true,
    autoIncrPlcHldrStartVal: 0,
    alwaysSaveSrcURL: false,
    keyboardPaste: true,
    checkSpelling: true,
    pastePromptAction: aeConst.PASTEACTION_SHORTCUT_KEY,
    clippingsMgrAutoShowDetailsPane: true,
    clippingsMgrDetailsPane: false,
    clippingsMgrStatusBar: false,
    clippingsMgrPlchldrToolbar: false,
    clippingsMgrMinzWhenInactv: null,
    syncClippings: false,
    syncFolderID: null,
    cxtMenuSyncItemsOnly: false,
    clippingsMgrShowSyncItemsOnlyRem: true,
    lastBackupRemDate: null,
    backupRemFirstRun: true,
    backupRemFrequency: aeConst.BACKUP_REMIND_WEEKLY,
    afterSyncFldrReloadDelay: 3000,
    syncHelperCheckUpdates: true,
    lastSyncHelperUpdChkDate: null,
    backupFilenameWithDate: true,
    dispatchInputEvent: true,
    newClippingSyncFldrsOnly: false,
    clippingsMgrSaveWndGeom: false,
    clippingsMgrSaveWndGeomIntv: 2000,
    clippingsMgrWndGeom: null,
    clippingsMgrTreeWidth: null,
    autoAdjustWndPos: null,
    skipBackupRemIfUnchg: true,
    clippingsUnchanged: false,
    upgradeNotifCount: 0,
    tabModalMsgBox: false,
    showNewClippingOpts: false,
    useInsertHTMLCmd: false,
  },
  
  getPrefKeys()
  {
    let allPrefs = {...this._defaultState, ...this._defaultPrefs};
    return Object.keys(allPrefs);
  },
  
  async getPref(aPrefName)
  {
    let pref = await browser.storage.local.get(aPrefName);
    let rv = pref[aPrefName];
    
    return rv;
  },

  async getAllPrefs()
  {
    let rv = await browser.storage.local.get(this.getPrefKeys());
    return rv;
  },

  async setPrefs(aPrefMap)
  {
    await browser.storage.local.set(aPrefMap);
  },

  async setDefaultState()
  {
    await browser.storage.local.set(this._defaultState);
  },


  //
  // Version upgrade handling
  //

  hasUserPrefs(aPrefs)
  {
    return ("htmlPaste" in aPrefs);
  },

  async setUserPrefs(aPrefs)
  {
    let prefs = {
      showWelcome: true,
      htmlPaste: aeConst.HTMLPASTE_AS_FORMATTED,
      autoLineBreak: true,
      autoIncrPlcHldrStartVal: 0,
      alwaysSaveSrcURL: false,
      keyboardPaste: true,
      checkSpelling: true,
      pastePromptAction: aeConst.PASTEACTION_SHORTCUT_KEY,
      clippingsMgrDetailsPane: false,
      clippingsMgrStatusBar: false,
      clippingsMgrPlchldrToolbar: false,
      clippingsMgrMinzWhenInactv: null,
    };

    await this._addPrefs(aPrefs, prefs);
  },

  hasSanDiegoPrefs(aPrefs)
  {
    // Version 6.1
    return ("syncClippings" in aPrefs);
  },

  async setSanDiegoPrefs(aPrefs)
  {
    let newPrefs = {
      syncClippings: false,
      syncFolderID: null,
      lastBackupRemDate: null,
      backupRemFirstRun: true,
      backupRemFrequency: aeConst.BACKUP_REMIND_WEEKLY,
      afterSyncFldrReloadDelay: 3000,
    };

    await this._addPrefs(aPrefs, newPrefs);
  },

  hasBalboaParkPrefs(aPrefs)
  {
    // Version 6.1.2
    return ("syncHelperCheckUpdates" in aPrefs);
  },

  async setBalboaParkPrefs(aPrefs)
  {
    let newPrefs = {
      syncHelperCheckUpdates: true,
      lastSyncHelperUpdChkDate: null,
    };

    await this._addPrefs(aPrefs, newPrefs);
  },

  hasMalibuPrefs(aPrefs)
  {
    // Version 6.2
    return ("cxtMenuSyncItemsOnly" in aPrefs);
  },

  async setMalibuPrefs(aPrefs)
  {
    let newPrefs = {
      cxtMenuSyncItemsOnly: false,
      clippingsMgrShowSyncItemsOnlyRem: true,
      clippingsMgrAutoShowDetailsPane: true,
      backupFilenameWithDate: true,
    };

    await this._addPrefs(aPrefs, newPrefs);
  },

  hasTopangaPrefs(aPrefs)
  {
    // Version 6.2.1
    return ("dispatchInputEvent" in aPrefs);
  },

  async setTopangaPrefs(aPrefs)
  {
    let newPrefs = {
      dispatchInputEvent: true,
    };

    await this._addPrefs(aPrefs, newPrefs);
  },

  hasHuntingdonPrefs(aPrefs)
  {
    // Version 6.3
    return ("clippingsMgrSaveWndGeom" in aPrefs);
  },

  async setHuntingdonPrefs(aPrefs)
  {
    let newPrefs = {
      clippingsMgrSaveWndGeom: false,
      clippingsMgrWndGeom: null,
      clippingsMgrTreeWidth: null,
      newClippingSyncFldrsOnly: false,
      autoAdjustWndPos: null,
      skipBackupRemIfUnchg: true,
      clippingsUnchanged: false,
      upgradeNotifCount: 0,
    };

    if (typeof aPrefs.clippingsMgrMinzWhenInactv != "boolean") {
      newPrefs.clippingsMgrMinzWhenInactv = null;
    }

    await this._addPrefs(aPrefs, newPrefs);
  },

  hasSanClementePrefs(aPrefs)
  {
    // Version 6.4
    return ("showNewClippingOpts" in aPrefs);
  },
  
  async setSanClementePrefs(aPrefs)
  {
    let newPrefs = {
      tabModalMsgBox: false,
      showNewClippingOpts: false,
    };

    await this._addPrefs(aPrefs, newPrefs);
  },

  hasModestoPrefs(aPrefs)
  {
    // Version 6.5.2
    return ("useInsertHTMLCmd" in aPrefs);
  },

  async setModestoPrefs(aPrefs)
  {
    let newPrefs = {useInsertHTMLCmd: false};
    await this._addPrefs(aPrefs, newPrefs);
  },

  hasSanFranciscoPrefs(aPrefs)
  {
    // Version 7.0
    return ("_clippingMenuItemIDMap" in aPrefs);
  },

  async setSanFranciscoPrefs(aPrefs)
  {
    let newPrefs = {
      _isInitialized: false,
      _clippingMenuItemIDMap: {},
      _folderMenuItemIDMap: {},
      _autoIncrPlchldrs: [],
      _autoIncrPlchldrVals: {},
      _forceShowFirstTimeBkupNotif: false,
      _syncClippingsHelperDwnldPgURL: null,
      _wndIDs: {
        newClipping: null,
        keyboardPaste: null,
        placeholderPrmt: null,
        clippingsMgr: null,
      },
    };
    await this._addPrefs(aPrefs, newPrefs);
  },


  //
  // Helper methods
  //

  async _addPrefs(aCurrPrefs, aNewPrefs)
  {
    for (let pref in aNewPrefs) {
      aCurrPrefs[pref] = aNewPrefs[pref];
    }

    await this.setPrefs(aNewPrefs);
  },
};
