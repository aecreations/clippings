/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const TOOLBAR_HEIGHT = 28;
const PREVIEW_PANE_HEIGHT = 256;
const MSGBAR_DELAY_MS = 5000;

let gEnvInfo;
let gPrefs;
let gClippingsDB;
let gIsClippingsTreeEmpty;
let gSyncedItemsIDs = new Set();
let gSyncedItemsIDMap = new Map();
let gCustomizeDlg, gReloadSyncFldrMsgBox, gClipbdWritePermMsgBox, gInitErrorMsgBox;
let gMsgBarTimerID = null;

let gSyncClippingsListener = {
  onActivate(aSyncFolderID)
  {
    log("Clippings::sidebar.js::gSyncClippingsListener.onActivate()");
    aeDialog.cancelDlgs();
    gReloadSyncFldrMsgBox.showModal();
  },
  
  onDeactivate(aOldSyncFolderID)
  {
    log(`Clippings::sidebar.js::gSyncClippingsListener.onDeactivate(): ID of old sync folder: ${aOldSyncFolderID}`);
    gSyncedItemsIDs.clear();
    gSyncedItemsIDMap.clear();

    gReloadSyncFldrBtn.hide();
    
    let clippingsTree = aeClippingsTree.getTree();
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
      let clippingsTree = aeClippingsTree.getTree();

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
    
    $("#search-box").prop("placeholder", browser.i18n.getMessage("clipMgrSrchBarHint"))
      .focus(aEvent => {
        gSearchBox.activate();
        $("#search-clippings-and-folders").addClass("focus");
      })
      .blur(aEvent => {
        gSearchBox.deactivate();
        $("#search-clippings-and-folders").removeClass("focus");
      })
      .keyup(aEvent => {
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
    let tree = aeClippingsTree.getTree();
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
    aeClippingsTree.getTree().clearFilter();
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
      showMessageBar("#action-not-available-msgbar");
      return;
    }

    browser.runtime.sendMessage({
      msgID: "refresh-synced-clippings",
      rebuildClippingsMenu: false,
    });
    
    aeDialog.cancelDlgs();
    gReloadSyncFldrMsgBox.showModal();
  },

  async insertClipping()
  {
    let tree = aeClippingsTree.getTree();
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
    if (gIsClippingsTreeEmpty) {
      return;
    }

    let tree = aeClippingsTree.getTree();
    let selectedNode = tree.activeNode;
    if (! selectedNode) {
      return;
    }

    let perms = await browser.permissions.getAll();
    if (! perms.permissions.includes("clipboardWrite")) {
      gClipbdWritePermMsgBox.showModal();
      return;
    }

    let clippingID = parseInt(selectedNode.key);
    let clipping = await gClippingsDB.clippings.get(clippingID);
    if (! clipping) {
      throw new Error("No clipping found for ID " + clippingID);
    }

    let isFormatted = aeClippings.hasHTMLTags(clipping.content);
    if (isFormatted) {
      aeCopyClippingTextFormatDlg.showModal();
    }
    else {
      browser.runtime.sendMessage({
        msgID: "copy-clipping",
        clippingID,
        copyFormat: aeConst.COPY_AS_PLAIN,
      });
    }
  },
  
  async openWebPageSourceURL()
  {
    let tree = aeClippingsTree.getTree();
    let selectedNode = tree.activeNode;
    if (!selectedNode || selectedNode.isFolder()) {
      return;
    }

    let clippingID = parseInt(selectedNode.key);
    let clipping = await gClippingsDB.clippings.get(clippingID);
    if (clipping.sourceURL == "") {
      showMessageBar("#clipping-missing-src-url-msgbar");
      return;
    }

    aeNavigator.gotoURL(clipping.sourceURL, aeNavigator.TARGET_NEW_TAB);
  },

  editInClippingsManager()
  {
    let tree = aeClippingsTree.getTree();
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

  showHidePreviewPane()
  {
    let currSetting = gPrefs.sidebarPreview;
    aePrefs.setPrefs({sidebarPreview: !currSetting});
    $("#pane-splitter, #preview-pane").toggle();
  },

  customize()
  {
    gCustomizeDlg.showModal();
  },

  showHelp()
  {
    browser.runtime.sendMessage({msgID: "open-sidebar-help"});
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
  gSearchBox.init();

  buildClippingsTree();
  initSyncItemsIDLookupList();

  initDialogs();
  aeInterxn.init(gEnvInfo.os);
  aeVisual.init(gEnvInfo.os);
  aeVisual.preloadMsgBoxIcons();
  aeVisual.cacheIcons(
    "clippings-mgr-hover.svg",
    "clippings-mgr-active-dk.svg",
    "help_hover.svg",
    "folder-open.svg",
    "tree-fldr-open.svg",
    "tree-fldr-close.svg",
    "tree-fldr-open-dk.svg",
    "tree-fldr-close-dk.svg"
  );

  let wnd = await browser.windows.getCurrent();
  aeNavigator.init(wnd.id);

  $("#help").attr("title", browser.i18n.getMessage("tbHelp"));
});


function initDialogs()
{
  gCustomizeDlg = new aeDialog("#customize-dlg");
  gCustomizeDlg.onInit = function ()
  {
    $("#show-toolbar").prop("checked", gPrefs.sidebarToolbar).on("click", aEvent => {
      aePrefs.setPrefs({sidebarToolbar: aEvent.target.checked});
    });

    $("#show-search-bar").prop("checked", gPrefs.sidebarSearchBar).on("click", aEvent => {
      aePrefs.setPrefs({sidebarSearchBar: aEvent.target.checked});
    });

    $("#show-preview-pane").prop("checked", gPrefs.sidebarPreview).on("click", aEvent => {
      aePrefs.setPrefs({sidebarPreview: aEvent.target.checked});
    });
  };

  gReloadSyncFldrMsgBox = new aeDialog("#reload-sync-fldr-msgbox");
  gReloadSyncFldrMsgBox.onFirstInit = function ()
  {
    this.focusedSelector = ".msgbox-btns > .dlg-accept";
  };

  gReloadSyncFldrMsgBox.onAfterAccept = function ()
  {
    rebuildClippingsTree();
  };

  gClipbdWritePermMsgBox = new aeDialog("#request-clipbd-write-perm-dlg");
  gClipbdWritePermMsgBox.onFirstInit = function ()
  {
    let extName = browser.i18n.getMessage("extName")
    $("#perm-request").text(browser.i18n.getMessage("extPermInstr", extName));
  };
  
  gInitErrorMsgBox = new aeDialog("#init-error-msgbox");
}


function setScrollableContentHeight()
{
  let cntHeight = window.innerHeight;

  if (gPrefs.sidebarToolbar) {
    cntHeight -= TOOLBAR_HEIGHT;
  }
  if (gPrefs.sidebarSearchBar) {
    cntHeight -= TOOLBAR_HEIGHT;
  }

  if (gPrefs.sidebarPreview) {
    cntHeight -= PREVIEW_PANE_HEIGHT;
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

  let msgBarsCSS = window.getComputedStyle($("#msgbars")[0]);
  let msgBarsHeight = parseInt(msgBarsCSS.getPropertyValue("height"));
  if (isNaN(msgBarsHeight)) {
    msgBarsHeight = 0;
  }
  cntHeight -= msgBarsHeight;

  if (gPrefs.sidebarPreview) {
    $("#pane-splitter, #preview-pane").show();
    cntHeight -= PREVIEW_PANE_HEIGHT;
  }
  else {
    $("#pane-splitter, #preview-pane").hide();
  }

  $("#scroll-content").css({height: `${cntHeight}px`});
}


function buildClippingsTree()
{
  let treeData = [];
  let rootFldrID = getRootFolderID();
  
  aeClippingsTree.build(rootFldrID, gPrefs).then(aTreeData => {
    if (aTreeData.length == 0) {
      treeData = setEmptyClippingsState();
      $("#normal-content").hide();
      $("#welcome-content").show();
      toggleSearchBarVisibility(false);
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
            // Perform default action (not currently implemented)
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
      className: "sidebar-cxt-menu",

      events: {
        activated(aOpts) {
          let mnu = aOpts.$menu;
          mnu[0].focus();
        },
        
        show(aOpts) {
          let treeItemSpan = aOpts.$trigger[0].firstChild;
          if (treeItemSpan.classList.contains("fancytree-statusnode-nodata")) {
            return false;
          }
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

        case "togglePreviewPane":
          gCmd.showHidePreviewPane();
          break;

        case "customize":
          gCmd.customize();
          break;

        default:
          alert(browser.i18n.getMessage("msgUnavail"));
          break;
        }
      },
      
      items: {
        reloadSyncFolder: {
          name: browser.i18n.getMessage("mnuReloadSyncFldr"),
          className: "ae-menuitem",
          visible(aItemKey, aOpt) {
            let tree = aeClippingsTree.getTree();
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
            if (! gPrefs.pasteFromSidebar) {
              return false;
            }
            return (!aeClippingsTree.isFolderSelected() && !aeClippingsTree.isSeparatorSelected());
          }
        },
        copyClippingText: {
          name: browser.i18n.getMessage("mnuCopyClipTxt"),
          className: "ae-menuitem",
          visible(aItemKey, aOpt) {
            return (!aeClippingsTree.isFolderSelected() && !aeClippingsTree.isSeparatorSelected());
          }
        },
        gotoSrcURL: {
          name: browser.i18n.getMessage("mnuGoToSrcURL"),
          className: "ae-menuitem",
          visible(aItemKey, aOpt) {
            return (!aeClippingsTree.isFolderSelected() && !aeClippingsTree.isSeparatorSelected());
          }
        },
        custzSeparator: {
          type: "cm_separator",
          visible(aItemKey, aOpt) {
            let tree = aeClippingsTree.getTree();
            let selectedNode = tree.activeNode;
            if (! selectedNode) {
              return false;
            }
            if (aeClippingsTree.isSeparatorSelected()) {
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
	  name: browser.i18n.getMessage("mnuPrevPane"),
	  className: "ae-menuitem",
          icon(aOpt, $itemElement, aItemKey, aItem) {
            if ($("#pane-splitter").css("display") != "none"
                && $("#preview-pane").css("display") != "none") {
              return "context-menu-icon-checked";
            }
          }
	},
	customize: {
	  name: browser.i18n.getMessage("mnuCustz"),
	  className: "ae-menuitem",
	}
      }
    });

    if (gPrefs.syncClippings) {
      initSyncedClippingsTree();
    }

    aeInterxn.initContextMenuAriaRoles(".sidebar-cxt-menu");

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


async function rebuildClippingsTree()
{
  let tree = aeClippingsTree.getTree();
  let treeData = [];
  let rootFldrID = getRootFolderID();

  aeClippingsTree.build(rootFldrID, gPrefs).then(aTreeData => {
    if (aTreeData.length == 0) {
      if (! gIsClippingsTreeEmpty) {
        treeData = setEmptyClippingsState();
        tree.options.icon = false;
        tree.reload(treeData);
        clearPreviewPane();
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
  let rv = [
    {title: browser.i18n.getMessage("clipMgrNoItems"), key: "0"},
  ];
  gIsClippingsTreeEmpty = true;
  
  return rv;
}


function unsetEmptyClippingsState()
{
  let tree = aeClippingsTree.getTree();
  let emptyMsgNode = tree.getNodeByKey("0");
  emptyMsgNode.remove();
  tree.options.icon = true;
  gIsClippingsTreeEmpty = false;
}


function updateDisplay(aEvent, aData)
{
  if (gIsClippingsTreeEmpty) {
    $("#normal-content").hide();
    $("#welcome-content").show();
    toggleSearchBarVisibility(false);   
    return;
  }

  $("#normal-content").show();
  $("#welcome-content").hide();
  toggleSearchBarVisibility(true);
  $("#item-name, #clipping-content").val('');
  $("#item-name").prop("disabled", false);

  let selectedItemID = parseInt(aData.node.key);

  if (aData.node.isFolder()) {
    $("#preview-pane").attr("type", "folder");
    gClippingsDB.folders.get(selectedItemID).then(aFolder => {
      $("#item-name").val(aFolder.name);
    });
  }
  else {
    gClippingsDB.clippings.get(selectedItemID).then(aClipping => {
      $("#item-name").val(aClipping.name);
      $("#clipping-content").val(aClipping.content);

      if (aClipping.separator) {
        $("#preview-pane").attr("type", "separator");
        $("#item-name").prop("disabled", true);
      }
      else {
        $("#preview-pane").attr("type", "clipping");
      }
    });
  }
}


function toggleSearchBarVisibility(aIsVisible)
{
  let visibility = aIsVisible ? "visible" : "hidden";
  $("#search-bar").css({visibility});
}


function clearPreviewPane()
{
  $("#item-name, #clipping-content").val('');
  $("#preview-pane").removeAttr("type");
}


function showMessageBar(aMsgBarStor, aAutoHide=true)
{
  $(`#msgbars > ${aMsgBarStor}`).css({display: "flex"});
  if (! $("#msgbars").hasClass("msgbars-visible")) {
    $("#msgbars").addClass("msgbars-visible");
  }

  if (aAutoHide) {
    gMsgBarTimerID = setTimeout(() => { hideMessageBar(aMsgBarStor) }, MSGBAR_DELAY_MS);
  }
  
  setCustomizations();
}


function hideMessageBar(aMsgBarStor)
{
  $(`#msgbars > ${aMsgBarStor}`).css({display: "none"});
  if (! $("#msgbars").children().is(":visible")) {
    $("#msgbars").removeClass("msgbars-visible");
  }

  setCustomizations();
  gMsgBarTimerID && clearTimeout(gMsgBarTimerID);
}


//
// Event handlers
//

browser.runtime.onMessage.addListener(aRequest => {
  log(`Clippings::sidebar.js: Received message "${aRequest.msgID}"`);
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
  gCmd.showHelp();
});


$(".inline-msgbar > .inline-msgbar-dismiss").on("click", aEvent => {
  let msgBarID = aEvent.target.parentNode.id;
  hideMessageBar(`#${msgBarID}`);
});


$("#welcome-clippings-mgr").on("click", aEvent => {
  gCmd.openClippingsManager();
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
  else if (aEvent.key == "F1") {
    gCmd.showHelp();
  }
  else if (aEvent.key == "F10" && aEvent.shiftKey) {
    let focusedTreeNodeElt = $(".fancytree-focused");
    if (focusedTreeNodeElt.length == 1) {
      focusedTreeNodeElt.parent().trigger("contextmenu");
    }
  }
  else if (aEvent.key.toUpperCase() == "C" && isAccelKeyPressed()) {
    if (aEvent.target.classList.contains("ui-fancytree")) {
      gCmd.copyClippingTextToClipboard();
      aEvent.preventDefault();
    }
    else {
      log("Clippings::sidebar.js: Ignoring keyboard shortcut CTRL+C, falling back to default action")
    }
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
// Error reporting and debugging output
//

function showInitError()
{
  gInitErrorMsgBox.showModal();
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
