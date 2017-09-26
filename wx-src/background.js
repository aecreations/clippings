/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Clippings.
 *
 * The Initial Developer of the Original Code is 
 * Alex Eng <ateng@users.sourceforge.net>.
 * Portions created by the Initial Developer are Copyright (C) 2005-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

const MAX_NAME_LENGTH = 64;
const ROOT_FOLDER_NAME = "clippings-root";
const HTML_PASTE_AS_FORMATTED = 0;
const HTML_PASTE_AS_IS = 1;

let gClippingsDB = null;

let gClippingsListeners = {
  ORIGIN_CLIPPINGS_MGR: 1,
  ORIGIN_HOSTAPP: 2,
  ORIGIN_NEW_CLIPPING_DLG: 3,

  _listeners: [],

  add: function (aNewListener) {
    this._listeners.push(aNewListener);
  },

  remove: function (aTargetListener) {
    this._listeners = this._listeners.filter(aListener => aListener != aTargetListener);
  },

  get: function () {
    return this._listeners;
  }
};

let gClippingsListener = null;

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

let gWndIDs = {
  newClipping: null,
  clippingsMgr: null
};

let gPrefs = null;
let gIsInitialized = false;


//
// First-run initialization
//

browser.runtime.onInstalled.addListener(aDetails => {
  if (aDetails.reason == "install") {
    console.log("Clippings/wx: It appears that the extension was newly installed.  Welcome to Clippings 6!");
  }
  else if (aDetails.reason == "upgrade") {
    console.log("Clippings/wx: Upgrading from version " + aDetails.previousVersion);
    if (parseInt(aDetails.previousVersion) < 6) {
      console.log("Upgrading from legacy XUL version. Setting default preferences.");
    }
  }
});


//
// Browser window and Clippings menu initialization
//

async function setDefaultPrefs()
{
  let aeClippingsPrefs = {
    htmlPaste: HTML_PASTE_AS_FORMATTED,
    autoLineBreak: true,
    autoIncrPlcHldrStartVal: 0,
    alwaysSaveSrcURL: false,
    keyboardPaste: true,
    checkSpelling: true,
    openClippingsMgrInTab: false
  };

  gPrefs = aeClippingsPrefs;
  await browser.storage.local.set(aeClippingsPrefs);
}


function init()
{
  if (gIsInitialized) {
    return;
  }

  browser.storage.local.get().then(aPrefs => {
    if (aPrefs.htmlPaste === undefined) {
      console.log("Clippings/wx: No user preferences were previously set.  Setting default user preferences.");
      setDefaultPrefs().then(() => {
        initHelper();
      });
    }
    else {
      gPrefs = aPrefs;
      initHelper();
    }
  });
}


function initHelper()
{
  console.log("Clippings/wx: Initializing browser integration...");
  
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
    const CREATED = 1, UPDATED = 2, DELETED = 3;

    console.log("Clippings/wx: Database change observer: changes object: ");
    console.log(aChanges);

    let clippingsListeners = gClippingsListeners.get();

    if (aChanges.length > 1) {
      console.log("Detecting multiple database changes. Skipping iteration through the changes array and invoking afterBatchChanges() on all listeners.");
      clippingsListeners.forEach(aListener => { aListener.afterBatchChanges() });
      return;
    }

    console.log("Invoking listener method on %s listeners.", clippingsListeners.length);
    
    aChanges.forEach(aChange => {
      switch (aChange.type) {
      case CREATED:
        console.log("Clippings/wx: Database observer detected CREATED event");
        if (aChange.table == "clippings") {
          clippingsListeners.forEach(aListener => { aListener.newClippingCreated(aChange.key, aChange.obj) });
        }
        else if (aChange.table == "folders") {
          clippingsListeners.forEach(aListener => { aListener.newFolderCreated(aChange.key, aChange.obj) });
        }
        break;
        
      case UPDATED:
        console.log("Clippings/wx: Database observer detected UPDATED event");
        if (aChange.table == "clippings") {
          clippingsListeners.forEach(aListener => { aListener.clippingChanged(aChange.key, aChange.obj, aChange.oldObj) });
        }
        else if (aChange.table == "folders") {
          clippingsListeners.forEach(aListener => { aListener.folderChanged(aChange.key, aChange.obj, aChange.oldObj) });
        }
        break;
        
      case DELETED:
        console.log("Clippings/wx: Database observer detected DELETED event");
        if (aChange.table == "clippings") {
          clippingsListeners.forEach(aListener => { aListener.clippingDeleted(aChange.key, aChange.oldObj) });
        }
        else if (aChange.table == "folders") {
          clippingsListeners.forEach(aListener => { aListener.folderDeleted(aChange.key, aChange.oldObj) });
        }
        break;
        
      default:
        break;
      }
    });
  });

  gClippingsDB.open().catch(e => {
    console.error("Clippings/wx: Error opening database: " + e);
  });

  if (! ("browser" in window)) {
    console.log("Clippings/wx: Browser: Google Chrome");
  }
  else {
    let getBrowserInfo = browser.runtime.getBrowserInfo();
    getBrowserInfo.then(aBrwsInfo => {
      console.log(`Clippings/wx: Browser: ${aBrwsInfo.name} (version ${aBrwsInfo.version})`);
    });
  }

  chrome.runtime.getPlatformInfo(aInfo => { console.log("Clippings/wx: OS: " + aInfo.os); });

  chrome.browserAction.onClicked.addListener(aTab => {
    openClippingsManager();
  });

  gClippingsListener = {
    origin: gClippingsListeners.ORIGIN_HOSTAPP,
    
    newClippingCreated: function (aID, aData) {
      rebuildContextMenu();
    },

    newFolderCreated: function (aID, aData) {
      rebuildContextMenu();
    },

    clippingChanged: function (aID, aData, aOldData) {
      if (aData.parentFolderID == aOldData.parentFolderID) {
        updateContextMenuForClipping(aID);
      }
      else {
        rebuildContextMenu();
      }
    },

    folderChanged: function (aID, aData, aOldData) {
      if (aData.parentFolderID == aOldData.parentFolderID) {
        updateContextMenuForFolder(aID);
      }
      else {
        rebuildContextMenu();
      }
    },

    clippingDeleted: function (aID, aOldData) {
      removeContextMenuForClipping(aID);
    },

    folderDeleted: function (aID, aOldData) {
      removeContextMenuForFolder(aID);
    },

    afterBatchChanges: function () {
      rebuildContextMenu();
    }
  };
  
  gClippingsListeners.add(gClippingsListener);

  window.addEventListener("unload", onUnload, false);
  initMessageListeners();

  aeClippingSubst.init(navigator.userAgent, gPrefs.autoIncrPlcHldrStartVal);

  browser.storage.onChanged.addListener((aChanges, aAreaName) => {
    console.log("Clippings/wx: Detected change to local storage");
    let changedPrefs = Object.keys(aChanges);

    for (let pref of changedPrefs) {
      gPrefs[pref] = aChanges[pref].newValue;
    }
  });
  
  buildContextMenu();

  chrome.commands.onCommand.addListener(aCmdName => {
    if (aCmdName == "ae-clippings-paste-clipping" && gPrefs.keyboardPaste) {
      openShortcutKeyPromptDlg();
    }
  });

  gIsInitialized = true;
  console.log("Clippings/wx: Initialization complete.");
}


function initMessageListeners()
{
  if (isGoogleChrome()) {
    chrome.runtime.onMessage.addListener((aRequest, aSender, aSendResponse) => {
      console.log(`Clippings/wx: Received Chrome message '${aRequest.msgID}'`);

      let resp = null;

      if (aRequest.msgID == "init-new-clipping-dlg") {
        resp = gNewClipping.get();
        if (resp !== null) {
          aSendResponse(resp);
        }
      }
      else if (aRequest.msgID == "close-new-clipping-dlg") {
        gWndIDs.newClipping = null;
      }
      else if (aRequest.msgID == "close-clippings-mgr-wnd") {
        gWndIDs.clippingsMgr = null;
      }
      else if (aRequest.msgID = "paste-shortcut-key") {
        // TO DO: Same logic as for Firefox.
      }
    });
  }                                  
  else {
    // Firefox
    browser.runtime.onMessage.addListener(aRequest => {
      console.log("Clippings/wx: Received message '%s'", aRequest.msgID);
      
      let resp = null;

      if (aRequest.msgID == "init-new-clipping-dlg") {
        resp = gNewClipping.get();

        if (resp !== null) {
          return Promise.resolve(resp);
        }
      }
      else if (aRequest.msgID == "close-new-clipping-dlg") {
        gWndIDs.newClipping = null;
      }
      else if (aRequest.msgID == "close-clippings-mgr-wnd") {
        gWndIDs.clippingsMgr = null;
      }
      else if (aRequest.msgID = "paste-shortcut-key") {
        let shortcutKey = aRequest.shortcutKey;
        if (! shortcutKey) {
          return;
        }

        console.log("Clippings/wx: Key '%s' was pressed.", shortcutKey);
        pasteClippingByShortcutKey(shortcutKey);
      }
    });
  }
}


function buildContextMenu()
{
  chrome.contextMenus.create({
    id: "ae-clippings-new",
    title: "New...",
    contexts: ["editable", "selection"]
  });

  chrome.contextMenus.create({
    id: "ae-clippings-manager",
    title: "Organize Clippings",
    contexts: ["editable", "selection"]
  });

  chrome.contextMenus.create({ type: "separator", contexts: ["editable"]});

  gClippingsDB.transaction("r", gClippingsDB.folders, gClippingsDB.clippings, () => {
    let populateFolders = gClippingsDB.folders.where("parentFolderID").equals(0).each((aItem, aCursor) => {
      buildContextSubmenu(0, aItem);
    });

    populateFolders.then(() => {
      gClippingsDB.clippings.where("parentFolderID").equals(0).each((aItem, aCursor) => {
        chrome.contextMenus.create({
          id: "ae-clippings-clipping-" + aItem.id,
          title: aItem.name,
          contexts: ["editable"]
        });
      });
    });
  }).catch(aErr => {
    console.error("Clippings/wx::buildContextMenu(): Database transaction failed! %s", aErr.message);
  });
}


function buildContextSubmenu(aParentFolderID, aFolderData)
{
  let folderID = aFolderData.id;
  let cxtSubmenuData = {
    id: "ae-clippings-folder-" + folderID,
    title: "[" + aFolderData.name + "]",
    contexts: ["editable"]
  };
  if (aParentFolderID != 0) {
    cxtSubmenuData.parentId = "ae-clippings-folder-" + aParentFolderID;
  }
  
  let cxtSubmenuID = chrome.contextMenus.create(cxtSubmenuData);

  gClippingsDB.transaction("r", gClippingsDB.folders, gClippingsDB.clippings, () => {
    let populateSubfolders = gClippingsDB.folders.where("parentFolderID").equals(folderID).each((aItem, aCursor) => {
      buildContextSubmenu(folderID, aItem);
    });

    populateSubfolders.then(() => {
      gClippingsDB.clippings.where("parentFolderID").equals(folderID).each((aItem, aCursor) => {
        chrome.contextMenus.create({
          id: "ae-clippings-clipping-" + aItem.id,
          title: aItem.name,
          parentId: cxtSubmenuID,
          contexts: ["editable"]
        });
      });
    });
   }).catch(aErr => {
    console.error("Clippings/wx::buildContextSubmenu(): Database transaction failed! %s", aErr.message);
  });
}


function updateContextMenuForClipping(aUpdatedClippingID)
{
  let id = Number(aUpdatedClippingID);
  let getClipping = gClippingsDB.clippings.get(id);
  getClipping.then(aResult => {
    chrome.contextMenus.update("ae-clippings-clipping-" + aUpdatedClippingID, { title: aResult.name });
  });
}


function updateContextMenuForFolder(aUpdatedFolderID)
{
  let id = Number(aUpdatedFolderID);
  let getFolder = gClippingsDB.folders.get(id);
  getFolder.then(aResult => {
    chrome.contextMenus.update("ae-clippings-folder-" + aUpdatedFolderID, { title: "[" + aResult.name + "]" });
  });
}


function removeContextMenuForClipping(aRemovedClippingID)
{
  chrome.contextMenus.remove("ae-clippings-clipping-" + aRemovedClippingID);
}


function removeContextMenuForFolder(aRemovedFolderID)
{
  chrome.contextMenus.remove("ae-clippings-folder-" + aRemovedFolderID);
}


function rebuildContextMenu()
{
  chrome.contextMenus.removeAll(() => { buildContextMenu() });
}


function createClipping(aName, aContent, aShortcutKey, aSrcURL)
{
  let createClipping = gClippingsDB.clippings.add({
    name: aName,
    content: aContent,
    parentFolderID: 0,
    shortcutKey: aShortcutKey || "",
    sourceURL: aSrcURL || ""
  });

  createClipping.then(aID => {
    if (isGoogleChrome()) {
      window.alert("Successfully created new clipping \"" + aName + "\".");
    }
    console.info("Clippings/wx: Successfully created new clipping!\nid = %d", aID);
    
    let getClipping = gClippingsDB.clippings.get(aID);
    getClipping.then(aResult => {
      console.log("Name: %s\nText: %s", aResult.name, aResult.content);
    });

    rebuildContextMenu();
  }, onError);
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


function openClippingsManager()
{
  let clippingsMgrURL = chrome.runtime.getURL("pages/clippingsMgr.html");

  function openClippingsMgrHelper()
  {
    browser.windows.create({
      url: clippingsMgrURL,
      type: "popup",
      width: 750, height: 400,
      left: 64, top: 128
    }).then(aWnd => {
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
      console.error(e);
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
}


function openNewClippingDlg()
{
  let url = browser.runtime.getURL("pages/new.html");

  function openNewClippingDlgHelper()
  {
    browser.windows.create({
      url,
      type: "popup",
      width: 428, height: 500,
      left: 96, top: 64
    }).then(aWnd => {
      gWndIDs.newClipping = aWnd.id;
      browser.history.deleteUrl({ url });
    }, aErr => {
      console.error(aErr);
    });
  }
  
  if (gWndIDs.newClipping) {
    browser.windows.get(gWndIDs.newClipping).then(aWnd => {
      browser.windows.update(gWndIDs.newClipping, { focused: true });
    }, aErr => {
      gWndIDs.newClipping = null;
      openNewClippingDlgHelper();
    });
  }
  else {
    openNewClippingDlgHelper();
  }
}


function openShortcutKeyPromptDlg()
{
  // TO DO: Check first if the cursor is in a web page textbox or HTML editor.
  // If not, then don't do anything.

  // TO DO: Check if the dialog is already open.
  let url = "pages/clippingKey.html";

  chrome.windows.create({
    url: url,
    type: "detached_panel",
    width: 500, height: 170,
    left: window.screen.availWidth - 500 / 2,
    top:  window.screen.availHeight - 200 / 2
  });

}


function pasteClippingByID(aClippingID)
{
  gClippingsDB.transaction("r", gClippingsDB.clippings, gClippingsDB.folders, () => {
    let clipping = null;
    
    gClippingsDB.clippings.get(aClippingID).then(aClipping => {
      if (! aClipping) {
        alertEx(aeMsgBox.MSG_CLIPPING_NOT_FOUND);
        return;
      }

      clipping = aClipping;
      console.log(`Pasting clipping named "${clipping.name}"\nid = ${clipping.id}`);

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

      pasteClipping(clippingInfo);
    });
  }).catch(aErr => {
    console.error("Clippings/wx: pasteClippingByID(): Database transaction failed!\n" + aErr);
  });
}


function pasteClippingByShortcutKey(aShortcutKey)
{
  gClippingsDB.transaction("r", gClippingsDB.clippings, gClippingsDB.folders, () => {
    let results = gClippingsDB.clippings.where("shortcutKey").equals(aShortcutKey.toUpperCase());
    let clipping = {};
    
    results.first().then(aClipping => {
      if (! aClipping) {
        console.warn("Cannot find clipping with shortcut key '%s'", aShortcutKey);
        return;
      }

      clipping = aClipping;
      console.log(`Pasting clipping named "${clipping.name}"\nid = ${clipping.id}`);

      let parentFldrName = "";

      return gClippingsDB.folders.get(aClipping.parentFolderID);
    }).then(aFolder => {
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
    console.error("Clippings/wx: pasteClippingByID(): Database transaction failed!\n" + aErr);
  });
}


function pasteClipping(aClippingInfo)
{
  chrome.tabs.query({ active: true, currentWindow: true }, aTabs => {
    if (! aTabs[0]) {
      // This should never happen...
      alertEx(aeMsgBox.MSG_NO_ACTIVE_BROWSER_TAB);
      return;
    }

    let activeTabID = aTabs[0].id;
    let content = aeClippingSubst.processClippingText(aClippingInfo);
    let msgParams = {
      msgID: "paste-clipping",
      content,
      autoLineBreak: gPrefs.autoLineBreak
    };

    console.log("Clippings/wx: Extension sending message 'paste-clipping' to content script");
          
    chrome.tabs.sendMessage(activeTabID, msgParams, null);
  });
}


function getClippingsDB()
{
  return gClippingsDB;
}


function getClippingsListeners()
{
  return gClippingsListeners;
}


function isGoogleChrome()
{
  return (! ("browser" in window));
}


function alertEx(aMessageID)
{
  let message = aeMsgBox.msg[aMessageID];
  
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


function onUnload(aEvent)
{
  gClippingsListeners.remove(gClippingsListener);
}


function onError(aError)
{
  console.error("Clippings/wx: " + aError);
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
      
      console.log("Clippings/wx: Extension sending message 'new-clipping' to content script; active tab ID: " + activeTabID);

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
      let id = Number(aInfo.menuItemId.substr(22));
      pasteClippingByID(id);
    }
    break;
  }
});


init();
