/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const DEBUG_TREE = false;
const TOOLBAR_HEIGHT = 28;

let gEnvInfo;
let gPrefs;
let gClippingsDB;
let gIsClippingsTreeEmpty;
let gSyncedItemsIDs = new Set();
let gSyncedItemsIDMap = new Map();

let gSyncClippingsListener = {
  onActivate(aSyncFolderID)
  {
    log("Clippings::sidebar.js::gSyncClippingsListener.onActivate()");
    aeDialog.cancelDlgs();
    // TO DO: Put this in a modal dialog.
    alert(browser.i18n.getMessage("syncReloadAck"));
    // TEMPORARY
    rebuildClippingsTree();
  },
  
  onDeactivate(aOldSyncFolderID)
  {
    log(`Clippings::sidebar.js::gSyncClippingsListener.onDeactivate(): ID of old sync folder: ${aOldSyncFolderID}`);
    gSyncedItemsIDs.clear();
    gSyncedItemsIDMap.clear();

    gReloadSyncFldrBtn.hide();
    
    let clippingsTree = getClippingsTree();
    let syncFldrTreeNode = clippingsTree.getNodeByKey(aOldSyncFolderID + "F");
    syncFldrTreeNode.removeClass("ae-synced-clippings-fldr");

    let clippingsTreeElt = $("#clippings-tree");
    if (clippingsTreeElt.hasClass("cxt-menu-show-sync-items-only")) {
      clippingsTreeElt.removeClass("cxt-menu-show-sync-items-only");
    }
  },

  onAfterDeactivate(aRemoveSyncFolder, aOldSyncFolderID)
  {
    log(`Clippings::sidebar.js: gSyncClippingsListener.onAfterDeactivate(): Remove Synced Clippings folder = ${aRemoveSyncFolder}; old sync folder ID = ${aOldSyncFolderID}`)

    if (aRemoveSyncFolder) {
      let clippingsTree = getClippingsTree();

      let syncFldrTreeNode = clippingsTree.getNodeByKey(aOldSyncFolderID + "F");
      syncFldrTreeNode.remove();
    }
  },
};


// Reload button for the Synced Clippings folder.
let gReloadSyncFldrBtn = {
  show()
  {
    let syncFldrID = gPrefs.syncFolderID;
    if (syncFldrID === null) {
      return;
    }

    // Prevent duplicates that would appear if the tree list was rebuilt.
    if ($("#reload-sync-fldr-btn").length == 1) {
      return;
    }

    let syncFldrSpanElt = this._getSyncFldrSpan()[0];
    let reloadBtn = document.createElement("span");
    reloadBtn.id = "reload-sync-fldr-btn";
    reloadBtn.title = browser.i18n.getMessage("btnReload");
    reloadBtn.setAttribute("tabindex", "0");
    reloadBtn.setAttribute("role", "button");
    reloadBtn.addEventListener("click", aEvent => { gCmd.reloadSyncFolder() });
    reloadBtn.addEventListener("keydown", aEvent => {
      if (aEvent.key == "Enter" || aEvent.key == " ") {
        aEvent.target.click();
      }
    });
    
    syncFldrSpanElt.appendChild(reloadBtn);
  },

  hide()
  {
    let syncFldrSpan = this._getSyncFldrSpan();
    if (! syncFldrSpan) {
      console.error("Clippings::clippingsMgr.js: gReloadSyncFldrBtn.hide(): Failed to retrieve the Fancytree <span> element for the Synced Clippings folder!");
      return;
    }

    let syncFldrSpanElt = syncFldrSpan[0];
    let reloadBtnElt = document.getElementById("reload-sync-fldr-btn");
    syncFldrSpanElt.removeChild(reloadBtnElt);
  },

  _getSyncFldrSpan() {
    return $("#clippings-tree > ul.ui-fancytree > li > span.ae-synced-clippings-fldr");
  },
};


// Search box
let gSearchBox = {
  _isInitialized: false,
  _isActive: false,
  _numMatches: null,
  _clippingsTree: null,

  init: function ()
  {
    if (this._isInitialized) {
      return;
    }
    
    $("#search-box").prop("placeholder", browser.i18n.getMessage("clipMgrSrchBarHint"));
    $("#search-box").focus(aEvent => {
      gSearchBox.activate();
    });
    $("#search-box").blur(aEvent => { gSearchBox.deactivate() });

    $("#search-box").keyup(aEvent => {
      this.updateSearch();
      $("#clear-search").css({
        visibility: (aEvent.target.value ? "visible" : "hidden")
      });
    });

    $("#clear-search").click(aEvent => { this.reset() });

    this._isInitialized = true;
  },

  isActivated: function ()
  {
    return this._isActive;
  },

  updateSearch: function ()
  {
    let tree = getClippingsTree();
    let numMatches = tree.filterNodes($("#search-box").val());
    this._numMatches = numMatches;
  },

  getCountMatches: function ()
  {
    return this._numMatches;
  },

  activate: function ()
  {
    this._isActive = true;
  },

  deactivate()
  {
    this._isActive = false;
  },
  
  reset: function ()
  {
    getClippingsTree().clearFilter();
    $("#search-box").val("").focus();
    $("#clear-search").css({visibility: "hidden"});
  }
};


// Sidebar actions
let gCmd = {
  async reloadSyncFolder()
  {
    let pingResp;
    try {
      pingResp = await browser.runtime.sendMessage({msgID: "ping-new-clipping-dlg"});
    }
    catch {}

    if (pingResp) {
      // TO DO: Put this in a message bar.
      alert(browser.i18n.getMessage("msgUnavail"));
      return;
    }

    browser.runtime.sendMessage({
      msgID: "refresh-synced-clippings",
      rebuildClippingsMenu: false,      
    });
    
    aeDialog.cancelDlgs();
    // TO DO: Put this in a modal dialog.
    alert(browser.i18n.getMessage("syncReloadAck"));
    // TEMPORARY
    rebuildClippingsTree();
  },

  async insertClipping()
  {
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    if (!selectedNode || selectedNode.isFolder()) {
      return;
    }

    let clippingID = parseInt(selectedNode.key);
    let clipping = await gClippingsDB.clippings.get(clippingID);
    if (! clipping) {
      throw new Error("No clipping found for ID " + clippingID);
    }

    let wnd = await browser.windows.getCurrent({populate: true});
    let tabs = wnd.tabs;
    let [actvTab] = tabs.filter(aTab => aTab.active);
    let resp;
    try {
      // For this to work, the user must focus the textbox or HTML editor in
      // the web page immediately before invoking this action on the currently
      // selected clipping.
      resp = await browser.tabs.sendMessage(actvTab.id, {msgID: "focus-active-tab"});
    }
    catch (e) {
      warn("Clippings::sidebar.js: gCmd.insertClipping(): " + e);
      return;
    }

    if (resp) {
      log(`Clippings::sidebar.js: gCmd.insertClipping(): Focused tab title: "${resp}"`);
    }
    
    browser.runtime.sendMessage({
      msgID: "paste-clipping-by-name",
      clippingID,
      browserTabID: actvTab.id,
      fromClippingsMgr: false,
    });
  },

  async copyClippingTextToClipboard()
  {
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    if (!selectedNode || selectedNode.isFolder()) {
      return;
    }

    let id = parseInt(selectedNode.key);
    let clipping = await gClippingsDB.clippings.get(id);
    if (! clipping) {
      throw new Error("No clipping found for ID " + id);
    }

    let type;
    let isFormatted = aeClippings.hasHTMLTags(clipping.content);
    if (isFormatted) {
      // TEMPORARY
      let copyAsFmtTxt = window.confirm("Do you want to copy the selected clipping as formatted text?\n\n• To copy as formatted text, click OK.\n• To copy as plain text with HTML tags, click Cancel.");
      type = copyAsFmtTxt ? "text/html" : "text/plain";
      // TO DO:
      // - Use paste setting for breaking lines in HTML-formatted clippings
      // - Always copy as plain text if content contains restricted HTML tags
      // END TEMPORARY
    }
    else {
      type = "text/plain";
    }

    let blob = new Blob([clipping.content], {type});
    let data = [new ClipboardItem({[type]: blob})];
    try {
      await navigator.clipboard.write(data);
    }
    catch (e) {
      console.warn("Error copying clipping to clipboard\n" + e);
    }
  },
  
  async openWebPageSourceURL()
  {
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    if (!selectedNode || selectedNode.isFolder()) {
      return;
    }

    let clippingID = parseInt(selectedNode.key);
    let clipping = await gClippingsDB.clippings.get(clippingID);
    if (clipping.sourceURL == "") {
      // TEMPORARY
      window.alert(browser.i18n.getMessage("clipMgrNoSrcURL"));
      // TO DO: Show a message bar alerting user that there isn't a URL saved
      // for the selected clipping.
      return;
    }

    browser.tabs.create({url: clipping.sourceURL});
  },

  editInClippingsManager()
  {
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    if (! selectedNode) {
      return;
    }
    
    let id = parseInt(selectedNode.key);
    let itemInfo = {
      id,
      isFolder: selectedNode.isFolder(),
    };
    this._openClippingsMgr(itemInfo);
  },

  openClippingsManager()
  {
    this._openClippingsMgr({});
  },

  showMiniHelp()
  {
    // TEMPORARY
    alert(browser.i18n.getMessage("msgUnknown"));
  },

  // Private helper method
  _openClippingsMgr(aMsgInfo)
  {
    aMsgInfo.msgID = "open-clippings-mgr";
    browser.runtime.sendMessage(aMsgInfo);
  },
};


// Sidebar initialization
$(async () => {
  let platform = await browser.runtime.getPlatformInfo();
  gEnvInfo = {
    os: platform.os,
  };
  document.body.dataset.os = platform.os;
  
  log(`Clippings: Sidebar width ${window.innerWidth} px`);

  let lang = browser.i18n.getUILanguage();
  document.body.dataset.locale = lang;

  aeClippings.init();
  gClippingsDB = aeClippings.getDB();

  gPrefs = await aePrefs.getAllPrefs();
  setCustomizations();
  setScrollableContentHeight();
  gSearchBox.init();

  buildClippingsTree();
  initSyncItemsIDLookupList();

  aeInterxn.init(gEnvInfo.os);
});


function setScrollableContentHeight()
{
  let cntHeight = window.innerHeight;

  if (gPrefs.sidebarToolbar) {
    cntHeight -= TOOLBAR_HEIGHT;
  }
  if (gPrefs.sidebarSearchBar) {
    cntHeight -= TOOLBAR_HEIGHT;
  }

  $("#scroll-content").css({height: `${cntHeight}px`});
}


function setCustomizations()
{
  let cntHeight = window.innerHeight;

  if (gPrefs.sidebarToolbar) {
    $("#toolbar").show();
    cntHeight -= TOOLBAR_HEIGHT;
  }
  else {
    $("#toolbar").hide();
  }
  if (gPrefs.sidebarSearchBar) {
    $("#search-bar").show();
    cntHeight -= TOOLBAR_HEIGHT;
  }
  else {
    $("#search-bar").hide();
  }

  $("#scroll-content").css({height: `${cntHeight}px`});
}


function getClippingsTree()
{
  let rv = $.ui.fancytree.getTree("#clippings-tree");
  return rv;
}


function buildClippingsTree()
{
  let treeData = [];
  let rootFldrID = getRootFolderID();
  
  buildClippingsTreeHelper(rootFldrID).then(aTreeData => {
    if (aTreeData.length == 0) {
      treeData = setEmptyClippingsState();
    }
    else {
      treeData = aTreeData;
    }

    $("#clippings-tree").fancytree({
      extensions: ["filter"],

      debugLevel: 0,
      autoScroll: true,
      source: treeData,
      selectMode: 1,
      strings: {noData: browser.i18n.getMessage("clipMgrNoItems")},
      icon: (gIsClippingsTreeEmpty ? false : true),

      init(aEvent, aData)
      {
        let rootNode = aData.tree.getRootNode();
        if (rootNode.children.length > 0 && !gIsClippingsTreeEmpty) {
          rootNode.children[0].setActive();
        }
      },

      activate(aEvent, aData)
      {
        log("Clippings::sidebar.js: Activate event fired on clippings tree");
        updateDisplay(aEvent, aData);
      },

      async dblclick(aEvent, aData)
      {
        log("Clippings::sidebar.js: Double-click event fired on clippings tree");
        updateDisplay(aEvent, aData);

        if (aData.targetType == "title" || aData.targetType == "icon") {
          if (! aData.node.isFolder()) {
            gCmd.insertClipping();
          }
        }
      },

      filter: {
        autoExpand: true,
        counter: false,
        highlight: true,
        mode: "hide"
      }
    });

    // Context menu for the clippings tree.
    $.contextMenu({
      selector: "#clippings-tree > ul.ui-fancytree > li",

      events: {
        show(aOpts) {
          return (! gIsClippingsTreeEmpty);
        }
      },
      
      callback(aItemKey, aOpt, aRootMenu, aOriginalEvent)
      {
        switch (aItemKey) {
	case "reloadSyncFolder":
	  gCmd.reloadSyncFolder();
	  break;
	  
        case "gotoSrcURL":
	  gCmd.openWebPageSourceURL();
          break;

        case "insertClipping":
          gCmd.insertClipping();
          break;

        case "copyClippingText":
          gCmd.copyClippingTextToClipboard();
          break;

        default:
          window.alert(browser.i18n.getMessage("msgUnavail"));
          break;
        }
      },
      
      items: {
        reloadSyncFolder: {
          name: browser.i18n.getMessage("mnuReloadSyncFldr"),
          className: "ae-menuitem",
	  /***
	  callback(aKey, aOpt) {
	    // TO DO: Put callback here, instead of above.
	  },
	  ***/
          visible(aItemKey, aOpt) {
            let tree = getClippingsTree();
            let selectedNode = tree.activeNode;
            
            if (!selectedNode || !selectedNode.isFolder()) {
              return false;
            }

            let folderID = parseInt(selectedNode.key);
            return (folderID == gPrefs.syncFolderID);
          }
        },
        insertClipping: {
          name: browser.i18n.getMessage("insClipping"),
          className: "ae-menuitem",
          visible(aItemKey, aOpt) {
            return (!isFolderSelected() && !isSeparatorSelected());
          }
        },
        copyClippingText: {
          name: browser.i18n.getMessage("mnuCopyClipTxt"),
          className: "ae-menuitem",
	  /***
	  callback(aKey, aOpt) {
	    // TO DO: Put callback here, instead of above.
	  },
	  ***/
          visible(aItemKey, aOpt) {
            return (!isFolderSelected() && !isSeparatorSelected());
          }
        },
        gotoSrcURL: {
          name: browser.i18n.getMessage("mnuGoToSrcURL"),
          className: "ae-menuitem",
	  /***
	  callback(aKey, aOpt) {
	    // TO DO: Put callback here, instead of above.
	  },
	  ***/
          visible(aItemKey, aOpt) {
            return (!isFolderSelected() && !isSeparatorSelected());
          }
        },
        custzSeparator: {
          type: "cm_separator",
          visible(aItemKey, aOpt) {
            let tree = getClippingsTree();
            let selectedNode = tree.activeNode;
            if (! selectedNode) {
              return false;
            }
            if (isSeparatorSelected()) {
              return false;
            }
            if (selectedNode.isFolder()) {
              let folderID = parseInt(selectedNode.key);
              return (folderID == gPrefs.syncFolderID);
            }
            return true;
          }
        },
	togglePreviewPane: {
	  name: "show/hide preview pane",
	  className: "ae-menuitem",
	},
	customize: {
	  name: "customize...",
	  className: "ae-menuitem",
	}
      }
    });

    if (gPrefs.syncClippings) {
      initSyncedClippingsTree();
    }

  }).catch(aErr => {
    console.error("sidebar.js::buildClippingsTree(): %s", aErr.message);
    showInitError();
  });
}


function initSyncedClippingsTree()
{
  if (! gPrefs.cxtMenuSyncItemsOnly) {
    gReloadSyncFldrBtn.show();
    $(".ae-synced-clippings-fldr").parent().addClass("ae-synced-clippings");
  }
}


function buildClippingsTreeHelper(aFolderID)
{
  let rv = [];

  return new Promise((aFnResolve, aFnReject) => {
    gClippingsDB.transaction("r", gClippingsDB.folders, gClippingsDB.clippings, () => {
      gClippingsDB.folders.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
        let folderNode = {
          key: aItem.id + "F",
          title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aItem.name} [key=${aItem.id}F]` : aItem.name),
          folder: true
        }

        if (aItem.id == gPrefs.syncFolderID) {
          folderNode.extraClasses = "ae-synced-clippings-fldr";
        }

        if ("displayOrder" in aItem) {
          folderNode.displayOrder = aItem.displayOrder;
        }
        else {
          folderNode.displayOrder = 0;
        }

        if ("sid" in aItem) {
          folderNode.sid = aItem.sid;
        }

        buildClippingsTreeHelper(aItem.id).then(aChildNodes => {
          folderNode.children = aChildNodes;
          rv.push(folderNode);
        });
      }).then(() => {
        return gClippingsDB.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
          let clippingNode = {
            key: aItem.id + "C",
            title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aItem.name} [key=${aItem.id}C]` : aItem.name)
          };
          if (aItem.label) {
            clippingNode.extraClasses = `ae-clipping-label-${aItem.label}`;
          }

          if ("displayOrder" in aItem) {
            clippingNode.displayOrder = aItem.displayOrder;
          }
          else {
            clippingNode.displayOrder = 0;
          }

          if (aItem.separator) {
            clippingNode.title = "<hr>";
            clippingNode.extraClasses = "ae-separator";
          }

          rv.push(clippingNode);
        });
      }).then(() => {
        rv.sort((aItem1, aItem2) => {
          let rv = 0;
          if ("displayOrder" in aItem1 && "displayOrder" in aItem2) {
            rv = aItem1.displayOrder - aItem2.displayOrder;
          }
          return rv;
        });

        aFnResolve(rv);
      });
    }).catch(aErr => {
      console.error("Clippings::sidebar.js: buildClippingsTreeHelper(): %s", aErr.message);
      aFnReject(aErr);
    });
  });
}


async function rebuildClippingsTree()
{
  let tree = getClippingsTree();
  let treeData = [];
  let rootFldrID = getRootFolderID();

  buildClippingsTreeHelper(rootFldrID).then(aTreeData => {
    if (aTreeData.length == 0) {
      if (! gIsClippingsTreeEmpty) {
        treeData = setEmptyClippingsState();
        tree.options.icon = false;
        tree.reload(treeData);
      }
      return null;
    }
    else {
      if (gIsClippingsTreeEmpty) {
        unsetEmptyClippingsState();
      }
      else {
        tree.clear();
      }
      treeData = aTreeData;
      return tree.reload(treeData);
    }

  }).then(aTreeData => {
    if (aTreeData) {
      //gCmd.updateDisplayOrder(aeConst.ROOT_FOLDER_ID, null, null, true);
    }

    if (gPrefs.syncClippings) {
      gSyncedItemsIDs.clear();
      initSyncItemsIDLookupList();
      initSyncedClippingsTree();
    }
    
    return Promise.resolve(aTreeData);
  });
}


function getRootFolderID()
{
  let rv = 0;

  if (gPrefs.syncClippings && gPrefs.cxtMenuSyncItemsOnly) {
    rv = Number(gPrefs.syncFolderID);
  }
  else {
    rv = aeConst.ROOT_FOLDER_ID;
  }
  
  return rv;
}


function initSyncItemsIDLookupList()
{
  function initSyncItemsIDLookupListHelper(aFolderID)
  {
    return new Promise((aFnResolve, aFnReject) => {
      gClippingsDB.transaction("r", gClippingsDB.clippings, gClippingsDB.folders, () => {
        gClippingsDB.folders.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
          gSyncedItemsIDs.add(`${aItem.id}F`);

          // Initialize permanent ID of synced folder.
          let sid = aItem.sid;
          gSyncedItemsIDMap.set(sid, `${aItem.id}F`);
          initSyncItemsIDLookupListHelper(aItem.id);
          
        }).then(() => {
          return gClippingsDB.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
            gSyncedItemsIDs.add(`${aItem.id}C`);

            // Initialize permanent ID of synced clipping, similar to what was
            // done above for folders.
            let sid = aItem.sid;
            gSyncedItemsIDMap.set(sid, `${aItem.id}C`);
          });

        }).then(() => {
          aFnResolve();
        });
      }).catch(aErr => {
        aFnReject(aErr);
      });
    });    
  }
  // END nested helper function

  return new Promise((aFnResolve, aFnReject) => {
    if (! gPrefs.syncClippings) {
      aFnResolve();
    }

    // Include the ID of the root Synced Clippings folder.
    gSyncedItemsIDs.add(`${gPrefs.syncFolderID}F`);

    initSyncItemsIDLookupListHelper(gPrefs.syncFolderID).then(() => {
      aFnResolve();
    }).catch(aErr => {
      aFnReject(aErr);
    });
  });
}


function setEmptyClippingsState()
{
  var rv;
  rv = [{ title: browser.i18n.getMessage("clipMgrNoItems"), key: "0" }];
  gIsClippingsTreeEmpty = true;
  
  return rv;
}


function unsetEmptyClippingsState()
{
  let tree = getClippingsTree();
  let emptyMsgNode = tree.getNodeByKey("0");
  emptyMsgNode.remove();
  tree.options.icon = true;
  gIsClippingsTreeEmpty = false;
}


function isFolderSelected()
{
  let selectedNode = getClippingsTree().activeNode;

  if (! selectedNode) {
    return undefined;
  }
  return selectedNode.isFolder();
}


function isSeparatorSelected()
{
  let selectedNode = getClippingsTree().activeNode;

  if (! selectedNode) {
    return undefined;
  }
  return selectedNode.extraClasses == "ae-separator";
}


function updateDisplay(aEvent, aData)
{
  if (gIsClippingsTreeEmpty) {
    return;
  }

  log("Clippings::sidebar.js: Updating display...");

  // TO DO: Finish implementation
}


//
// Event handlers
//

browser.runtime.onMessage.addListener(aRequest => {
  let resp = null;

  switch (aRequest.msgID) {
  case "new-clipping-created":
  case "new-folder-created":
  case "clipping-changed":
  case "folder-changed":
  case "copy-finished":
  case "dnd-move-finished":
  case "import-finished":
    rebuildClippingsTree();
    break;
    
  case "sync-activated":
    gSyncClippingsListener.onActivate(aRequest.syncFolderID);
    break;

  case "sync-deactivated":
    gSyncClippingsListener.onDeactivate(aRequest.oldSyncFolderID);
    break;

  case "sync-deactivated-after":
    gSyncClippingsListener.onAfterDeactivate(aRequest.removeSyncFolder, aRequest.oldSyncFolderID);
    break;

  default:
    break;
  }

  if (resp) {
    return Promise.resolve(resp);
  }
});


browser.storage.onChanged.addListener((aChanges, aAreaName) => {
  let changedPrefs = Object.keys(aChanges);

  for (let pref of changedPrefs) {
    gPrefs[pref] = aChanges[pref].newValue;
  }

  setCustomizations();
});


// Toolbar event handlers
$("#open-clippings-mgr").on("click", aEvent => {
  gCmd.openClippingsManager();
});
$("#help").on("click", aEvent => {
  gCmd.showMiniHelp();
});


$(window).on("resize", aEvent => {
  warn("Clippings::sidebar.js: The 'resize' event was fired!!");
  // The "resize" event is sometimes fired when the sidebar is shown, but
  // before it is initialized.
  if (! gPrefs) {
    return;
  }
  setScrollableContentHeight();
});


// Keyboard event handler
$(document).keydown(async (aEvent) => {
  const isMacOS = gEnvInfo.os == "mac";
  
  function isAccelKeyPressed()
  {
    if (isMacOS) {
      return aEvent.metaKey;
    }
    return aEvent.ctrlKey;
  }

  aeDialog.hidePopups();

  // Prevent invoking keyboard shortcut actions while a dialog is open,
  // but allow dialog action keys ENTER and ESC.
  if (aeDialog.isOpen() && !(["Enter", "Escape"].includes(aEvent.key))) {
    return;
  }

  if (aEvent.key == "Enter") {
    if (aEvent.target.tagName == "BUTTON" && !aEvent.target.classList.contains("dlg-accept")) {
      aEvent.target.click();
      aEvent.preventDefault();
      return;
    }

    // Prevent duplicate invocation of default action button in modal dialogs.
    if (aeDialog.isOpen()) {
      if (! aEvent.target.classList.contains("default")) {
        aeDialog.acceptDlgs();
        aEvent.preventDefault();
      }
    }
  }
  else if (aEvent.key == "Escape") {
    if (gSearchBox.isActivated()) {
      gSearchBox.reset();
    }
    aeDialog.cancelDlgs();
  }
  else {
    aeInterxn.suppressBrowserShortcuts(aEvent, aeConst.DEBUG);
  }
});


$(document).on("contextmenu", aEvent => {
  aEvent.preventDefault();
});


// Catch any unhandled promise rejections from 3rd-party libs
window.addEventListener("unhandledrejection", aEvent => {
  aEvent.preventDefault();
});


//
// Utilities
//

function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, {SAFE_FOR_JQUERY: true});
}


function sanitizeTreeNodeTitle(aNodeTitle)
{
  let rv = "";
  rv = sanitizeHTML(aNodeTitle);
  rv = rv.replace(/</g, "&lt;");
  rv = rv.replace(/>/g, "&gt;");
  
  return rv;
}


//
// Error reporting and debugging output
//

function showInitError()
{
  window.alert(browser.i18n.getMessage("initError"));
}


function getErrStr(aErr)
{
  let rv = `${aErr.name}: ${aErr.message}`;

  if (aErr.fileName) {
    rv += "\nSource: " + aErr.fileName;
  }
  else {
    rv += "\nSource: unknown";
  }

  if (aErr.lineNumber) {
    rv += ":" + aErr.lineNumber;
  }

  return rv;
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