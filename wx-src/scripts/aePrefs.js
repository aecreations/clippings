/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let aePrefs = {
  _defaultPrefs: {
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
    tabModalMsgBox: true,
  },
  
  getDefaultPrefs()
  {
    return this._defaultPrefs;
  },

  getPrefKeys()
  {
    return Object.keys(this._defaultPrefs);
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


  //
  // Version upgrade handling
  //

  hasUserPrefs(aPrefs)
  {
    return aPrefs.hasOwnProperty("htmlPaste");
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
    return aPrefs.hasOwnProperty("syncClippings");
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
    return aPrefs.hasOwnProperty("syncHelperCheckUpdates");
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
    return aPrefs.hasOwnProperty("cxtMenuSyncItemsOnly");
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
    return aPrefs.hasOwnProperty("dispatchInputEvent");
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
    return aPrefs.hasOwnProperty("clippingsMgrSaveWndGeom");
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
    return aPrefs.hasOwnProperty("tabModalMsgBox");
  },
  
  async setSanClementePrefs(aPrefs)
  {
    let newPrefs = {
      tabModalMsgBox: true,
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
