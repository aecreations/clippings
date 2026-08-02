/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const DEBUG_WND_ACTIONS = false;
const REBUILD_BRWS_CXT_MENU_DELAY = 3000;
const ENABLE_PASTE_CLIPPING = false;

let gEnvInfo;
let gClippingsDB;
let gPrefs;
let gIsClippingsTreeEmpty;
let gDialog = {};
let gIsMaximized;
let gSuppressAutoMinzWnd;
let gSyncedItemsIDs = new Set();
let gSyncedItemsIDMap = new Map();
let gIsBackupMode = false;
let gErrorPushSyncItems = false;
let gReorderedTreeNodeNextSibling = null;


// Wrappers to database create/update/delete operations. These also call the
// Clippings listeners upon completion of the database operations.
let gClippingsSvc = {
  async createClipping(aClippingData)
  {
    let newClippingID = await gClippingsDB.clippings.add(aClippingData);
    gClippingsListener.newClippingCreated(newClippingID, aClippingData, aeConst.ORIGIN_CLIPPINGS_MGR);
    browser.runtime.sendMessage({
      msgID: "new-clipping-created",
      newClippingID,
      newClipping: aClippingData,
      origin: aeConst.ORIGIN_CLIPPINGS_MGR,
    });

    return newClippingID;
  },

  async createFolder(aFolderData)
  {
    let newFolderID = await gClippingsDB.folders.add(aFolderData);
    gClippingsListener.newFolderCreated(newFolderID, aFolderData, aeConst.ORIGIN_CLIPPINGS_MGR);
    browser.runtime.sendMessage({
      msgID: "new-folder-created",
      newFolderID,
      newFolder: aFolderData,
      origin: aeConst.ORIGIN_CLIPPINGS_MGR,
    });
    
    return newFolderID;
  },

  async updateClipping(aClippingID, aChanges, aOldClipping)
  {
    if (! aOldClipping) {
      aOldClipping = await gClippingsDB.clippings.get(aClippingID);
    }
    let numUpd = await gClippingsDB.clippings.update(aClippingID, aChanges);

    let newClipping = {};
    let keys = Object.keys(aOldClipping);
    for (let key of keys) {
      if (key in aChanges) {
        newClipping[key] = aChanges[key];
      }
      else {
        newClipping[key] = aOldClipping[key];
      }
    }

    gClippingsListener.clippingChanged(aClippingID, newClipping, aOldClipping);
    browser.runtime.sendMessage({
      msgID: "clipping-changed",
      clippingID: aClippingID,
      clippingData: newClipping,
      oldClippingData: aOldClipping,
    });

    return numUpd;
  },

  async updateFolder(aFolderID, aChanges, aOldFolder)
  {
    if (! aOldFolder) {
      aOldFolder = await gClippingsDB.folders.get(aFolderID);
    } 
    let numUpd = await gClippingsDB.folders.update(aFolderID, aChanges);

    let newFolder = {};
    let keys = Object.keys(aOldFolder);
    for (let key of keys) {
      if (key in aChanges) {
        newFolder[key] = aChanges[key];
      }
      else {
        newFolder[key] = aOldFolder[key];
      }
    }
    
    gClippingsListener.folderChanged(aFolderID, newFolder, aOldFolder);
    browser.runtime.sendMessage({
      msgID: "folder-changed",
      folderID: aFolderID,
      folderData: newFolder,
      oldFolderData: aOldFolder,
    });

    return numUpd;
  },

  async deleteClipping(aClippingID)
  {
    await gClippingsDB.clippings.delete(aClippingID);
  },

  async deleteFolder(aFolderID)
  {
    await gClippingsDB.folders.delete(aFolderID);
  }
};


// Clippings listener object
let gClippingsListener = {
  _isCopying:   false,

  origin: aeConst.ORIGIN_CLIPPINGS_MGR,
  copiedItems: [],
  
  newClippingCreated: function (aID, aData, aOrigin, aDontSelect)
  {
    if (this._isCopying) {
      return;
    }
    
    if (gIsClippingsTreeEmpty) {
      unsetEmptyClippingsState();
    }

    let tree = aeClippingsTree.getTree();
    let selectedNode = tree.activeNode;
    let newNodeData = {
      key: aID + "C",
      title: aeClippingsTree.sanitizeTreeNodeTitle(aeClippingsTree.DEBUG ? `${aData.name} [key=${aID}C]` : aData.name)
    };

    let newNode = null;

    if (selectedNode) {
      if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
        if (aData.separator) {
          let childNodes = tree.rootNode.getChildren();
          // For separators only:
          // Need to subtract 1 from display order due to starting index of 1
          // for the root folder to accommodate the Synced Clippings folder.
          let idx = aData.displayOrder - 1;
          idx < 0 && (idx = 0);
          newNodeData.title = "<hr>";
          let siblingNode = childNodes[idx];
          newNode = siblingNode.appendSibling(newNodeData);
        }
        else {
          newNode = tree.rootNode.addNode(newNodeData);
        }
      }
      else {
        let parentNode = tree.getNodeByKey(aData.parentFolderID + "F");
        if (aData.separator) {
          let childNodes = parentNode.getChildren();
          let idx = aData.displayOrder;
          idx < 0 && (idx = 0);
          newNodeData.title = "<hr>";
          let siblingNode = childNodes[idx];
          newNode = siblingNode.appendSibling(newNodeData)
        }
        else {
          newNode = parentNode.addNode(newNodeData);
        }
      }
    }
    else {
      // No clippings or folders.
      newNode = tree.rootNode.addNode(newNodeData);
    }

    if (aData.label) {
      newNode.addClass(`ae-clipping-label-${aData.label}`);
    }

    if (aData.separator) {
      newNode.addClass("ae-separator");
    }

    if (aDontSelect) {
      return;
    }

    let newClipping = {
      id: aData.id,
      name: aData.name,
      parentFolderID: aData.parentFolderID,
    };

    newNode.makeVisible().done(() => {     
      newNode.setActive();
      $("#clipping-name").val(newClipping.name).trigger("select").trigger("focus");
      $("#clipping-text").val('');

      // Clipping created outside Clippings Manager. Add to undo stack.
      if (aOrigin == aeConst.ORIGIN_HOSTAPP) {
        let state = {
          action: gCmd.ACTION_CREATENEW,
          id: newClipping.id,
          itemType: gCmd.ITEMTYPE_CLIPPING,
          parentFldrID: newClipping.parentFolderID,
        };
        
        if (gPrefs.syncClippings) {
          // BUG!!  "Dead object" error thrown from aData, because the
          // New Clipping dialog, where the aData parameter is populated from,
          // will be closed by the time these lines are reached.
          if ("sid" in aData) {
            state.sid = aData.sid;
          }
          if ("parentFldrSID" in aData) {
            state.parentFldrSID = aData.parentFldrSID;
          }
        }
        
        gCmd.undoStack.push(state);
      }
    });
  },

  newFolderCreated: function (aID, aData, aOrigin, aDontSelect)
  {
    if (this._isCopying) {
      return;
    }
    
    if (gIsClippingsTreeEmpty) {
      unsetEmptyClippingsState();
    }
    
    let tree = aeClippingsTree.getTree();
    let selectedNode = tree.activeNode;
    let newNodeData = {
      key: aID + "F",
      title: aeClippingsTree.sanitizeTreeNodeTitle(aeClippingsTree.DEBUG ? `${aData.name} [key=${aID}F]` : aData.name),
      folder: true,
      children: []
    };

    if (aID == gPrefs.syncFolderID) {
      newNodeData.extraClasses = "ae-synced-clippings-fldr";
      if (gPrefs.isSyncReadOnly) {
        newNodeData.extraClasses += " ae-synced-clippings-readonly";
      }
    }

    let newNode = null;
    
    if (selectedNode) {
      if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
        newNode = tree.rootNode.addNode(newNodeData);
      }
      else {
        let parentNode = tree.getNodeByKey(aData.parentFolderID + "F");
        newNode = parentNode.addNode(newNodeData);
      }
    }
    else {
      // No clippings or folders.
      newNode = tree.rootNode.addNode(newNodeData);
    }

    if (aDontSelect) {
      return;
    }

    let newFolder = {
      id: aData.id,
      name: aData.name,
      parentFolderID: aData.parentFolderID,
    };

    newNode.makeVisible().done(() => {
      newNode.setActive();
      $("#clipping-name").val(newFolder.name).trigger("select").trigger("focus");
      $("#clipping-text").val('');

      // Folder created outside Clippings Manager. Add to undo stack.
      if (aOrigin == aeConst.ORIGIN_HOSTAPP) {
        let state = {
          action: gCmd.ACTION_CREATENEWFOLDER,
          id: newFolder.id,
          itemType: gCmd.ITEMTYPE_FOLDER,
          parentFldrID: newFolder.parentFolderID,
        };

        if (gPrefs.syncClippings) {
          if ("sid" in aData) {
            state.sid = aData.sid;
          }
          if ("parentFldrSID" in aData) {
            state.parentFldrSID = aData.parentFldrSID;
          }
        }

        gCmd.undoStack.push(state);
      }
    });
  },

  clippingChanged: function (aID, aData, aOldData)
  {
    let tree = aeClippingsTree.getTree();

    if (aData.parentFolderID != aOldData.parentFolderID) {
      let oldParentFldrID = aOldData.parentFolderID;
      let newParentFldrID = aData.parentFolderID;

      if (this._isFlaggedForDelete(aData)) {
        this._removeClippingsTreeNode(aID + "C");
        gCmd.updateDisplayOrder(oldParentFldrID, null, null, true);
      }
      else {
        log("Clippings/wx::pg.js::gClippingsListener.clippingChanged(): Handling clipping move");
        let changedNode = tree.getNodeByKey(aID + "C");
        if (changedNode) {
          let targParentNode;
          if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
            targParentNode = tree.rootNode;
          }
          else {
            targParentNode = tree.getNodeByKey(aData.parentFolderID + "F");
          }
          
          changedNode.moveTo(targParentNode, "child");

          log("Clippings/wx::pg.js: gCmd.clippingChanged(): Updating display order of changed clipping");
          gCmd.updateDisplayOrder(oldParentFldrID, null, null, true).then(() => {
            gCmd.updateDisplayOrder(newParentFldrID, null, null, true);
          });
        }
        else {
          // Undoing delete.
          let newNodeData = {
            key: aID + "C",
            title: aeClippingsTree.sanitizeTreeNodeTitle(aeClippingsTree.DEBUG ? `${aData.name} [key=${aID}C]` : aData.name)
          };

          if (aData.separator) {
            newNodeData.extraClasses = "ae-separator";
            newNodeData.title = "<hr>";
            if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
              // Position the separator node in the tree list.
              // For the root folder, displayOrder starts at 1 to accommodate
              // the Synced Clippings folder.
              let rootNodes = tree.rootNode.getChildren();
              let sibling = rootNodes[aData.displayOrder];
              if (sibling) {
                changedNode = sibling.addNode(newNodeData, "before");
              }
              else {
                // The given displayOrder is invalid.
                sibling = tree.rootNode.getLastChild();
                changedNode = sibling.appendSibling(newNodeData);
              }
            }
            else {
              let parentNode = tree.getNodeByKey(aData.parentFolderID + "F");
              let fldrNodes = parentNode.getChildren();
              let sibling = fldrNodes[aData.displayOrder + 1];
              if (sibling) {
                changedNode = sibling.addNode(newNodeData, "before");
              }
              else {
                sibling = parentNode.getLastChild();
                changedNode = sibling.appendSibling(newNodeData);
              }
            }
          }
          else {
            if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
              changedNode = tree.rootNode.addNode(newNodeData);
            }
            else {
              let parentNode = tree.getNodeByKey(aData.parentFolderID + "F");
              changedNode = parentNode.addNode(newNodeData);
            }

            if (aData.label) {
              changedNode.addClass(`ae-clipping-label-${aData.label}`);
            }

            log(`Clippings/wx::clippingsMgr.js: gCmd.clippingChanged(): Updating display order of items under folder (ID = ${newParentFldrID}) after undoing clipping deletion`);
            gCmd.updateDisplayOrder(newParentFldrID, null, null, true);
          }
        }

        changedNode.makeVisible().then(() => { changedNode.setActive() });
      }
    }
    else if (aData.name != aOldData.name) {
      let changedNode = tree.getNodeByKey(aID + "C");
      changedNode.setTitle(aeClippingsTree.sanitizeTreeNodeTitle(aData.name));
    }
  },

  folderChanged: function (aID, aData, aOldData)
  {
    let tree = aeClippingsTree.getTree();

    if (aData.parentFolderID != aOldData.parentFolderID) {
      let oldParentFldrID = aOldData.parentFolderID;
      let newParentFldrID = aData.parentFolderID;

      if (this._isFlaggedForDelete(aData)) {
        this._removeClippingsTreeNode(aID + "F");
        gCmd.updateDisplayOrder(oldParentFldrID, null, null, true);
      }
      else {
        log("Clippings/wx::pg.js::gClippingsListener.folderChanged: Handling folder move");
        let changedNode = tree.getNodeByKey(aID + "F");
        if (changedNode) {
          let targParentNode;
          if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
            targParentNode = tree.rootNode;
          }
          else {
            targParentNode = tree.getNodeByKey(aData.parentFolderID + "F");
          }
          
          changedNode.moveTo(targParentNode, "child");

          log("Clippings/wx::pg.js: gCmd.folderChanged(): Updating display order of changed folder");
          let newParentFldrID = aData.parentFolderID;
          gCmd.updateDisplayOrder(oldParentFldrID, null, null, true).then(() => {
            gCmd.updateDisplayOrder(newParentFldrID, null, null, true);
          });
        }
        else {
          // Undoing delete.
          let newNodeData = {
            key: aID + "F",
            title: aeClippingsTree.sanitizeTreeNodeTitle(aeClippingsTree.DEBUG ? `${aData.name} [key=${aID}C]` : aData.name),
            folder: true,
            children: []
          };

          if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
            changedNode = tree.rootNode.addNode(newNodeData);
          }
          else {
            let parentNode = tree.getNodeByKey(aData.parentFolderID + "F");
            changedNode = parentNode.addNode(newNodeData);
          }

          log("Clippings/wx::pg.js: gCmd.folderChanged(): Updating display order after undoing folder deletion");
          gCmd.updateDisplayOrder(newParentFldrID, null, null, true).then(() => {
            this._buildChildNodes(changedNode);
          });
        }
        changedNode.makeVisible().then(() => { changedNode.setActive() });
      }
    }
    else if (aData.name != aOldData.name) {
      let changedNode = tree.getNodeByKey(aID + "F");
      changedNode.setTitle(aeClippingsTree.sanitizeTreeNodeTitle(aData.name));
    }
  },

  copyStarted: function ()
  {
    this._isCopying = true;
  },

  copyFinished: function (aItemCopyID)
  {
    info("Clippings/wx::pg.js: gClippingsListener.copyFinished()");
       
    this._isCopying = false;
    
    for (let i = 0; i < this.copiedItems.length; i++) {
      let item = this.copiedItems[i];
      if (item.itemType == gCmd.ITEMTYPE_FOLDER) {
        let suppressFldrSelect = true;
        if (item.id == aItemCopyID) {
          suppressFldrSelect = false;
        }
        this.newFolderCreated(item.id, item, aeConst.ORIGIN_CLIPPINGS_MGR, suppressFldrSelect);
      }
    }

    for (let i = 0; i < this.copiedItems.length; i++) {
      let item = this.copiedItems[i];
      if (item.itemType == gCmd.ITEMTYPE_CLIPPING) {
        this.newClippingCreated(item.id, item, aeConst.ORIGIN_CLIPPINGS_MGR, true);
      }
    }

    this.copiedItems = [];
  },

  // Helper methods
  _buildChildNodes: function (aFolderNode)
  {
    let id = parseInt(aFolderNode.key);
    
    gClippingsDB.transaction("rw", gClippingsDB.clippings, gClippingsDB.folders, () => {
      gClippingsDB.folders.where("parentFolderID").equals(id).each((aItem, aCursor) => {
        let newFldrNode = aFolderNode.addChildren({
          key: aItem.id + "F",
          title: aeClippingsTree.sanitizeTreeNodeTitle(aeClippingsTree.DEBUG ? `${aItem.name} [key=${aItem.id}F]` : aItem.name),
          folder: true,
          children: []
        });
        this._buildChildNodes(newFldrNode);

      }).then(() => {
        return gClippingsDB.clippings.where("parentFolderID").equals(id).each((aItem, aCursor) => {
          aFolderNode.addChildren({
            key: aItem.id + "C",
            title: aeClippingsTree.sanitizeTreeNodeTitle(aeClippingsTree.DEBUG ? `${aItem.name} [key=${aItem.id}C]` : aItem.name)
          });
        });

      }).then(() => {
        log(`Clippings/wx::clippingsMgr.js::gClippingsListener._buildChildNodes(): Updating display order for child folder '${aFolderNode.title}' (key = ${aFolderNode.key})`);
        gCmd.updateDisplayOrder(id, null, null, true);
      });
    }).catch(aErr => {
      console.error("Clippings/wx::pg.js::gClippingsListener._buildChildNodes(): " + aErr);
    });
  },
  
  _removeClippingsTreeNode: function (aIDWithSuffix)
  {
    let tree = aeClippingsTree.getTree();
    let targetNode = tree.getNodeByKey(aIDWithSuffix);
    let deletedNodeIdx = targetNode.getIndex();
    let prevSibNode = targetNode.getPrevSibling();
    let nextSibNode = targetNode.getNextSibling();
    let parentNode = targetNode.getParent();
    
    targetNode.remove();

    if (tree.count() == 0) {
      tree.options.icon = false;
      let emptyMsgNode = setEmptyClippingsState();
      tree.rootNode.addNode(emptyMsgNode);
      setStatusBarMsg(browser.i18n.getMessage("clipMgrStatusBar", "0"));
    }
    else {
      // Select the node that used to be occupied by the delete node. If the
      // deleted node was the last node of its parent folder, then select the
      // last child of the parent.
      if (nextSibNode) {
        nextSibNode.setActive();
      }
      else if (prevSibNode) {
        prevSibNode.setActive();
      }
      else {
        if (parentNode.isRootNode()) {
          let parentNodes = parentNode.getChildren();
          if (deletedNodeIdx < parentNodes.length) {
            parentNodes[deletedNodeIdx].setActive();
          }
          else {
            parentNodes[parentNodes.length].setActive();
          }
        }
        else {
          parentNode.setActive();
        }
      }
    }
  },

  _isFlaggedForDelete: function (aItem)
  {
    return (aItem.parentFolderID == aeConst.DELETED_ITEMS_FLDR_ID);
  }
};

let gSyncClippingsListener = {
  onActivate(aSyncFolderID)
  {
    log("Clippings/wx::pg.js::gSyncClippingsListener.onActivate()");
    aeDialog.cancelDlgs();
    gDialog.reloadSyncFolderIntrl();
  },
  
  onDeactivate(aOldSyncFolderID)
  {
    log(`Clippings/wx::clippingsMgr.js::gSyncClippingsListener.onDeactivate(): ID of old sync folder: ${aOldSyncFolderID}`);
    gSyncedItemsIDs.clear();
    gSyncedItemsIDMap.clear();

    gReloadSyncFldrBtn.hide();
    
    let clippingsTree = aeClippingsTree.getTree();
    let syncFldrTreeNode = clippingsTree.getNodeByKey(aOldSyncFolderID + "F");
    syncFldrTreeNode.removeClass("ae-synced-clippings-fldr");
    syncFldrTreeNode.removeClass("ae-synced-clippings-readonly");

    let clippingsTreeElt = $("#clippings-tree");
    if (clippingsTreeElt.hasClass("cxt-menu-show-sync-items-only")) {
      clippingsTreeElt.removeClass("cxt-menu-show-sync-items-only");
    }
  },

  onAfterDeactivate(aRemoveSyncFolder, aOldSyncFolderID)
  {
    log(`Clippings/wx::clippingsMgr.js: gSyncClippingsListener.onAfterDeactivate(): Remove Synced Clippings folder = ${aRemoveSyncFolder}; old sync folder ID = ${aOldSyncFolderID}`)

    if (aRemoveSyncFolder) {
      let clippingsTree = aeClippingsTree.getTree();

      let syncFldrTreeNode = clippingsTree.getNodeByKey(aOldSyncFolderID + "F");
      syncFldrTreeNode.remove();
      setStatusBarMsg();
      
      // TO DO: If there are no longer any clippings and folders, then show the
      // empty clippings UI.
    }
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

    $("#clear-search").on("click", aEvent => { this.reset() });

    this._isInitialized = true;
  },

  show: function ()
  {
    $("#search-clippings-and-folders").show();
  },

  hide: function ()
  {
    $("#search-clippings-and-folders").hide();
  },
  
  isVisible: function ()
  {
    return ($("#search-clippings-and-folders").css("display") != "none");
  },
  
  isActivated: function ()
  {
    return this._isActive;
  },

  updateSearch: function ()
  {
    let tree = aeClippingsTree.getTree();
    let numMatches = tree.filterNodes($("#search-box").val());
    if (numMatches === undefined) {
      // User cleared search box by deleting all search text
      setStatusBarMsg();
    }
    else {
      setStatusBarMsg(browser.i18n.getMessage("numMatches", numMatches));
    }

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
    $("#search-box").val("").trigger("focus");
    $("#clear-search").css({ visibility: "hidden" });
    setStatusBarMsg();
  }
};

// Source URL editing
let gSrcURLBar = {
  init: function ()
  {
    $("#src-url-edit-mode").hide();
    $("#edit-url-btn").on("click", aEvent => { this.edit() });
    $("#edit-src-url-ok").attr("title", browser.i18n.getMessage("btnOK")).on("click", aEvent => { this.acceptEdit() });
    $("#edit-src-url-cancel").attr("title", browser.i18n.getMessage("btnCancel")).on("click", aEvent => { this.cancelEdit() });
  },

  show: function ()
  {
    $("#source-url-bar").show();
  },

  hide: function ()
  {
    $("#source-url-bar").hide();
  },

  isVisible: function ()
  {
    return ($("#source-url-bar:visible").length > 0);
  },

  keypress: function (aEvent)
  {

  },

  edit: function ()
  {
    $("#src-url-normal-mode").hide();
    $("#src-url-edit-mode").show();
    $("#clipping-src-url-edit").val($("#clipping-src-url > a").text()).trigger("select").trigger("focus");
  },

  isEditing: function ()
  {
    return ($("#src-url-edit-mode:visible").length > 0);
  },

  acceptEdit: function ()
  {
    let updatedURL = $("#clipping-src-url-edit").val();

    if (updatedURL != "" && updatedURL.search(/^http:\/\//) == -1
        && updatedURL.search(/^https:\/\//) == -1) {

      if (updatedURL.search(/^www/) != -1) {
        updatedURL = "http://" + updatedURL;
        $("#clipping-src-url-edit").val(updatedURL);
      }
      else {
        $("#clipping-src-url-edit").trigger("select").trigger("focus");
        return;
      }
    }
    
    let tree = aeClippingsTree.getTree();
    let clippingID = parseInt(tree.activeNode.key);
    
    gClippingsSvc.updateClipping(clippingID, {
      sourceURL: updatedURL

    }).then(aNumUpdated => {
      if (gPrefs.clippingsUnchanged) {
        aePrefs.setPrefs({ clippingsUnchanged: false });
      }

      if ($("#clipping-src-url > a").length == 0) {
        $("#clipping-src-url").html(sanitizeHTML(`<a href="${updatedURL}">${updatedURL}</a>`));
      }
      else {
        if (updatedURL) {
          $("#clipping-src-url > a").text(updatedURL);
        }
        else {
          $("#clipping-src-url").text(browser.i18n.getMessage("none"));
        }
      }
      this._dismissSrcURLEditMode();

      if (updatedURL && gSyncedItemsIDs.has(clippingID + "C")) {
        browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"})
          .then(handlePushSyncUpdatesResponse)
          .catch(handlePushSyncItemsError);
      }
    });
  },

  cancelEdit: function ()
  {
    this._dismissSrcURLEditMode();
  },

  // Helper
  _dismissSrcURLEditMode: function ()
  {
    $("#src-url-normal-mode").show();
    $("#src-url-edit-mode").hide();
    $("#clipping-src-url-edit").val("");
  }
};


// Shortcut key editing
let gShortcutKey = {
  _oldKey:   "",
  _oldIndex: -1,

  init: function ()
  {
    $("#clipping-key").change(aEvent => {
      this.update();
    }).mousedown(aEvent => {
      this.setPrevShortcutKey();
    });

    $("#show-shortcut-list").attr("title", browser.i18n.getMessage("clipMgrShortcutHelpHint"));
  },

  getPrevSelectedIndex: function ()
  {
    return this._oldIndex;
  },
  
  setPrevShortcutKey: function ()
  {
    let selectedNode = aeClippingsTree.getTree().getActiveNode();
    if (! selectedNode) {
      return;
    }

    let clippingID = parseInt(selectedNode.key);
    this._oldIndex = $("#clipping-key")[0].selectedIndex;

    gClippingsDB.clippings.get(clippingID).then(aClipping => {
      this._oldKey = aClipping.shortcutKey;
    });
  },

  update: function ()
  {
    let shortcutKey = "";
    let shortcutKeyMenu = $("#clipping-key")[0];

    if (shortcutKeyMenu.selectedIndex == 0) {
      if (! this._oldKey) {
        // Skip shortcut key update if none was ever defined.
        return;
      }
    }
    else {
      shortcutKey = shortcutKeyMenu.options[shortcutKeyMenu.selectedIndex].text;
    }

    if (shortcutKey == this._oldKey) {
      return;
    }

    // Check if the shortcut key is already assigned.
    let assignedKeysLookup = {};
    gClippingsDB.clippings.where("shortcutKey").notEqual("").each((aItem, aCursor) => {
      assignedKeysLookup[aItem.shortcutKey] = 1;
    }).then(() => {
      if (assignedKeysLookup[shortcutKey]) {
        gDialog.shctKeyConflict.showModal();
        return;
      }

      let selectedNode = aeClippingsTree.getTree().getActiveNode();
      if (! selectedNode) {
        throw new Error("Can't set shortcut key if there is no clipping selected.");
      }

      let clippingID = parseInt(selectedNode.key);
      gClippingsSvc.updateClipping(clippingID, { shortcutKey }).then(aNumUpd => {
        if (gPrefs.clippingsUnchanged) {
          aePrefs.setPrefs({ clippingsUnchanged: false });
        }
        
        if (gSyncedItemsIDs.has(clippingID + "C")) {
          browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"})
            .catch(handlePushSyncItemsError);
        }
      });
    }).catch (aErr => {
      console.error(aErr);
    });
  }
};

// Clipping label picker in the options bar
let gClippingLabelPicker = {
  _labelPicker: null,
  
  init(aLabelPickerStor)
  {
    this._labelPicker = $(aLabelPickerStor);

    this._labelPicker.on("change", aEvent => {
      if (aeClippingsTree.isFolderSelected()) {
        return;
      }

      let selectedNode = aeClippingsTree.getTree().activeNode;
      let id = parseInt(selectedNode.key);
      let label = this.selectedLabel;

      gCmd.setLabelIntrl(id, label, gCmd.UNDO_STACK);
    });
  },

  get selectedLabel()
  {
    return this._labelPicker.val();
  },

  set selectedLabel(aLabel)
  {
    let bgColor = gEnvInfo.os == "win" ? "var(--color-label-picker-default-bkgd)" : aLabel;
    let fgColor = gEnvInfo.os == "win" ? aLabel : "var(--color-label-picker-default-bkgd)";

    if (! aLabel) {
      bgColor = "var(--color-label-picker-default-bkgd)";
      fgColor = "var(--color-label-picker-default-text)";
    }
    else if (aLabel == "yellow") {
      fgColor = gEnvInfo.os == "win" ? "var(--color-label-picker-alt-yellow)" : "black";
    }

    let cssPpty = {
      color: fgColor,
    };
    if (gEnvInfo.os == "win") {
      let borderColor;
      if (! aLabel) {
        borderColor = "var(--color-label-picker-default-border)";
      }
      else if (aLabel == "yellow") {
        borderColor = "var(--color-label-picker-alt-yellow)";
      }
      else {
        borderColor = aLabel;
      }
      cssPpty.borderColor = borderColor;
    }
    else {
      cssPpty.backgroundColor = bgColor;
    }
    this._labelPicker.css(cssPpty);
    this._labelPicker.val(aLabel);
  }
};

// Reload button for the Synced Clippings folder.
let gReloadSyncFldrBtn = {
  show()
  {
    let syncFldrID = gPrefs.syncFolderID;
    if (syncFldrID === null) {
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
      console.error("Clippings/wx::pg.js: gReloadSyncFldrBtn.hide(): Failed to retrieve the Fancytree <span> element for the Synced Clippings folder!");
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

// Instant editing for clipping/folder name and clipping text. Ensures that
// undo and redo works correctly when invoked via keyboard shortcut.
let gItemNameEditor, gClippingContentEditor;

class InstantEditor
{
  EDIT_INTERVAL = 3000;
  
  _stor = null;
  _intvID = null;
  _prevVal = '';

  constructor(aStor)
  {
    this._stor = aStor;
    
    $(this._stor).on("focus", aEvent => {
      this._intvID = setInterval(() => {
        if ($(this._stor).val() == this._prevVal) {
          return;
        }

        let tree = aeClippingsTree.getTree();
        let selectedNode = tree.activeNode;

        if (selectedNode.isFolder()) {
          let fldrID = parseInt(selectedNode.key);
          if (this._stor == "#clipping-name") {
            gCmd.editFolderNameIntrl(fldrID, $(this._stor).val(), gCmd.UNDO_STACK);
          }
        }
        else {
          let clpgID = parseInt(selectedNode.key);
          if (this._stor == "#clipping-text") {
            gCmd.editClippingContentIntrl(clpgID, $(this._stor).val(), gCmd.UNDO_STACK);
          }
          else if (this._stor == "#clipping-name") {
            gCmd.editClippingNameIntrl(clpgID, $(this._stor).val(), gCmd.UNDO_STACK);
          }
        }
        this._prevVal = $(this._stor).val();

      }, this.EDIT_INTERVAL);

    }).on("blur", aEvent => {
      clearInterval(this._intvID);
      this._intvID = null;
      this._prevVal = '';
    });
  }
}

let gCmd = clippingsMgrCmds();


function handlePushSyncUpdatesResponse(aResponse)
{
  if ("error" in aResponse && aResponse.error.name == "RangeError") {
    // Max sync file size exceeded.
    gDialog.syncFldrFull.showModal();
  }
}


// Initializing Clippings Manager window
$(async () => {
  aeClippings.init();
  gClippingsDB = aeClippings.getDB();
  aeImportExport.setDatabase(gClippingsDB);

  gPrefs = await aePrefs.getAllPrefs();

  let [brws, platform] = await Promise.all([
    browser.runtime.getBrowserInfo(),
    browser.runtime.getPlatformInfo(),
  ]);
  gEnvInfo = {
    os: platform.os,
    hostAppName: brws.name,
    hostAppVer:  brws.version,
  };
  document.body.dataset.os = gEnvInfo.os;

  // Platform-specific initialization.
  if (gEnvInfo.os == "mac") {
    $("#status-bar").css({backgroundImage: "none"});
  }
  else if (gEnvInfo.os == "linux" || DEBUG_WND_ACTIONS) {
    $("#minz-when-inactv-mode").show();
    $("#minz-when-inactv-mode").attr("data-checked", !!gPrefs.clippingsMgrMinzWhenInactv)
      .attr("title", browser.i18n.getMessage("mnuMinimizeWhenInactive"));
  }

  let lang = browser.i18n.getUILanguage();
  document.body.dataset.locale = lang;
  moment.locale(lang);

  let wndURL = new URL(window.location.href);
  let openerWndID = Number(wndURL.searchParams.get("openerWndID"));
  aeNavigator.init(openerWndID);
  gIsBackupMode = wndURL.searchParams.get("backupMode") || false;
  
  gIsMaximized = false;

  if (DEBUG_WND_ACTIONS && !gPrefs.clippingsMgrMinzWhenInactv) {
    aePrefs.setPrefs({clippingsMgrMinzWhenInactv: true});
  }

  initToolbar();
  initInstantEditing();
  gShortcutKey.init();
  gSrcURLBar.init();
  gClippingLabelPicker.init("#clipping-label-picker");
  initDialogs();
  buildClippingsTree();
  initTreeSplitter();
  initSyncItemsIDLookupList();

  if (gPrefs.clippingsMgrTreeWidth) {
    let width = `${parseInt(gPrefs.clippingsMgrTreeWidth)}px`;
    $("#clippings-tree").css({width});
  }
  
  if (gPrefs.clippingsMgrSaveWndGeom) {
    setSaveWndGeometryInterval(true);
  }

  if (gIsBackupMode) {
    gCmd.backup();
  }
  else {
    if (gPrefs.syncClippings && gPrefs.cxtMenuSyncItemsOnly
        && gPrefs.clippingsMgrShowSyncItemsOnlyRem) {
      gDialog.showOnlySyncedItemsReminder.showModal();
    }
  }

  aeVisual.init(gEnvInfo.os);
  aeInterxn.init(gEnvInfo.os);
  if (gPrefs.defDlgBtnFollowsFocus) {
    aeInterxn.initDialogButtonFocusHandlers();
  }
  
  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  let wnd = await browser.windows.getCurrent();
  browser.windows.update(wnd.id, {
    width: wnd.width + 1,
    focused: true,
  });
});


// Reloading or closing Clippings Manager window
$(window).on("beforeunload", () => {
  browser.runtime.sendMessage({msgID: "close-clippings-mgr-wnd"});

  browser.runtime.sendMessage({
    msgID: "purge-fldr-items",
    folderID: aeConst.DELETED_ITEMS_FLDR_ID,
  }).catch(aErr => {
    console.error("Clippings/wx::pg.js: $(window).on('beforeunload'): " + aErr);
  });
});


//
// Event handlers
//

// Keyboard event handler
$(document).on("keydown", async (aEvent) => {
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

  if (aEvent.key == "F1") {
    gCmd.showMiniHelp();
  }
  else if (aEvent.key == "F2") {
    aEvent.preventDefault();
    gCmd.redo();
  }
  else if (aEvent.key == "Enter") {
    if (gSrcURLBar.isEditing()) {
      gSrcURLBar.acceptEdit();
      return;
    }

    if (aEvent.target.tagName == "BUTTON" && !aEvent.target.classList.contains("dlg-accept")) {
      aEvent.target.click();
      aEvent.preventDefault();
      return;
    }

    // File ficker in the Import modal dialog.
    if (aEvent.target.tagName == "INPUT" && aEvent.target.type == "file") {
      aEvent.target.click();
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
    if (gSrcURLBar.isEditing()) {
      gSrcURLBar.cancelEdit();
    }
    aeDialog.cancelDlgs();
  }
  else if (aEvent.key == "Clear" && gSearchBox.isActivated()) {
    gSearchBox.reset();
  }
  else if (aEvent.key == "Delete") {
    if (aEvent.target.tagName == "UL" && aEvent.target.classList.contains("ui-fancytree")) {
      gCmd.deleteClippingOrFolder(gCmd.UNDO_STACK);
    }
  }
  else if (aEvent.key == "F10" && isAccelKeyPressed()) {
    gCmd.toggleMaximize();
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
      log("Clippings::pg.js: Ignoring keyboard shortcut CTRL+C, falling back to default action")
    }
  }
  else if (aEvent.key.toUpperCase() == "D" && isAccelKeyPressed()) {
    aEvent.preventDefault();
    gCmd.showHideDetailsPane();
  }
  else if (aEvent.key.toUpperCase() == "F" && isAccelKeyPressed()) {
    aEvent.preventDefault();
    $("#search-box").trigger("focus");
  }
  else if (aEvent.key.toUpperCase() == "Z" && isAccelKeyPressed() && !aEvent.shiftKey) {
    aEvent.preventDefault();
    gCmd.undo();
  }
  else if ((aEvent.key.toUpperCase() == "Z" && isAccelKeyPressed() && aEvent.shiftKey)
           || (aEvent.key.toUpperCase() == "Y" && isAccelKeyPressed())) {
    aEvent.preventDefault();
    gCmd.redo();
  }
  else {
    aeInterxn.suppressBrowserShortcuts(aEvent, aeConst.DEBUG);
  }
});


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


$(window).on("click", aEvent => {
  // HACK!!
  if ($("#shortcut-list-popup").hasClass("panel-show")) {
    return;
  }
  
  aeDialog.hidePopups();
});


$(window).on("blur", aEvent => {
  if (gPrefs.clippingsMgrSaveWndGeom) {
    setSaveWndGeometryInterval(false);
  }

  if (gEnvInfo.os == "linux" || DEBUG_WND_ACTIONS) {
    if (gPrefs.clippingsMgrMinzWhenInactv && !gSuppressAutoMinzWnd) {
      let updWndInfo = { state: "minimized" };
      browser.windows.update(browser.windows.WINDOW_ID_CURRENT, updWndInfo);
    }
  }
});


$(window).on("focus", aEvent => {
  // Ensure prefs cache is initialized when the window focus event is fired;
  // it won't be at the time window is opened.
  if (gPrefs && gPrefs.clippingsMgrSaveWndGeom) {
    setSaveWndGeometryInterval(true);
  }
});


$("#minz-when-inactv-mode").on("click", aEvent => {
  gCmd.toggleMinimizeWhenInactive();
});


browser.storage.onChanged.addListener((aChanges, aAreaName) => {
  let changedPrefs = Object.keys(aChanges);

  for (let pref of changedPrefs) {
    gPrefs[pref] = aChanges[pref].newValue;
  }
});


browser.runtime.onMessage.addListener(aRequest => {
  let resp = null;

  switch (aRequest.msgID) {
  case "ping-clippings-mgr":
    resp = {isOpen: true};
    break;

  case "toggle-save-clipman-wnd-geom":
    setSaveWndGeometryInterval(aRequest.saveWndGeom);
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

  case "new-clipping-created":
    gClippingsListener.newClippingCreated(aRequest.newClippingID, aRequest.newClipping, aRequest.origin);
    break;

  case "new-folder-created":
    gClippingsListener.newFolderCreated(aRequest.newFolderID, aRequest.newFolder, aRequest.origin);
    break;

  case "sync-fldr-reload-finished":
    rebuildClippingsTree();
    break;

  case "clippings-mgr-save-backup":
    gCmd.backupExtern();
    break;

  default:
    break;
  }

  if (resp) {
    return Promise.resolve(resp);
  }
});



//
// Clippings Manager functions
//

function initToolbar()
{
  // Show or hide the details pane and status bar.
  if (! gPrefs.clippingsMgrDetailsPane) {
    $("#source-url-bar, #options-bar").hide();
  }
  if (! gPrefs.clippingsMgrStatusBar) {
    if (gPrefs.clippingsMgrAutoShowStatusBar) {
      aePrefs.setPrefs({
        clippingsMgrAutoShowStatusBar: false,
        clippingsMgrStatusBar: true,
      });
    }
    else {
      $("#status-bar").hide();
      recalcContentAreaHeight($("#status-bar").css("display") != "none");
    }
  }

  $("#new-clipping").on("click", aEvent => { gCmd.newClipping(gCmd.UNDO_STACK) });
  $("#new-folder").on("click", aEvent => { gCmd.newFolder(gCmd.UNDO_STACK) });
  $("#move").attr("title", browser.i18n.getMessage("tbMoveOrCopy")).on("click", aEvent => {
    gCmd.moveClippingOrFolder();
  });
  $("#delete").attr("title", browser.i18n.getMessage("tbDelete")).on("click", aEvent => {
    gCmd.deleteClippingOrFolder(gCmd.UNDO_STACK);
  });
  $("#undo").attr("title", browser.i18n.getMessage("tbUndo")).on("click", aEvent => {
    gCmd.undo();
  });
  $("#help").attr("title", browser.i18n.getMessage("tbHelp")).on("click", aEvent => {
    gCmd.showMiniHelp();
  });

  // Placeholder toolbar -> Presets menu
  $.contextMenu({
    selector: "#plchldr-presets",
    trigger: "left",
    className: "placeholder-menu",

    events: {
      activated: function (aOptions) {
        let mnu = aOptions.$menu;
        mnu[0].focus();
        $("#plchldr-presets").addClass("toolbar-button-menu-open");
      },

      hide: function (aOptions) {
        $("#plchldr-presets").removeClass("toolbar-button-menu-open");
      },
    },

    position: function (aOpt, aX, aY) {
      aX = undefined;
      aY = undefined;

      aOpt.$menu.position({
        my: "left top",
        at: "left bottom",
        of: $("#plchldr-presets"),
      });
    },

    callback: function (aItemKey, aOpt, aRootMenu, aOriginalEvent) {
      let contentTextArea = $("#clipping-text");
      contentTextArea.trigger("focus");

      function insertPlaceholder(aPlaceholder) {
        insertTextIntoTextbox(contentTextArea, aPlaceholder);
      }

      switch (aItemKey) {
      case "insDate":
        insertPlaceholder("$[DATE]");
        break;
        
      case "insTime":
        insertPlaceholder("$[TIME]");
        break;
        
      case "insAppName":
        insertPlaceholder("$[HOSTAPP]");
        break;
        
      case "insUserAgent":
        insertPlaceholder("$[UA]");
        break;
        
      case "insClippingName":
        insertPlaceholder("$[NAME]");
        break;
        
      case "insParentFolderName":
        insertPlaceholder("$[FOLDER]");
        break;

      case "insFormattedDateTime":
        gCmd.insertFormattedDateTimePlaceholder();
        break;

      case "insClippingInClipping":
        gCmd.insertClippingInClippingPlaceholder();
        break;
        
      default:
        window.alert("The selected action is not available right now.");
        break;
      }
    },

    items: {
      insDate: {
        name: browser.i18n.getMessage("mnuPlchldrDate"),
        className: "ae-menuitem"
      },
      insTime: {
        name: browser.i18n.getMessage("mnuPlchldrTime"),
        className: "ae-menuitem"
      },
      insAppName: {
        name: browser.i18n.getMessage("mnuPlchldrAppName"),
        className: "ae-menuitem"
      },
      insUserAgent: {
        name: browser.i18n.getMessage("mnuPlchldrUsrAgent"),
        className: "ae-menuitem"
      },
      insClippingName: {
        name: browser.i18n.getMessage("mnuPlchldrClipName"),
        className: "ae-menuitem"
      },
      insParentFolderName: {
        name: browser.i18n.getMessage("mnuPlchldrFldrName"),
        className: "ae-menuitem"
      },
      separator1: "--------",
      insFormattedDateTime: {
        name: browser.i18n.getMessage("mnuPlchldrFmtDateTime"),
        className: "ae-menuitem"
      },
      insClippingInClipping: {
        name: browser.i18n.getMessage("mnuPlchldrClipClip"),
        className: "ae-menuitem"
      },
    }
  });
  
  // Tools menu
  $.contextMenu({
    selector: "#clippings-mgr-options",
    trigger: "left",
    className: "tools-menu",

    events: {
      activated: function (aOptions) {
        let mnu = aOptions.$menu;
        mnu[0].focus();
        $("#clippings-mgr-options").addClass("toolbar-button-menu-open");
      },

      hide: function (aOptions) {
        $("#clippings-mgr-options").removeClass("toolbar-button-menu-open");
      }
    },
    
    position: function (aOpt, aX, aY) {
      aX = undefined;
      aY = undefined;

      aOpt.$menu.position({
        my: "left top",
        at: "left bottom",
        of: $("#clippings-mgr-options")
      });
    },
    
    callback: function (aItemKey, aOpt, aRootMenu, aOriginalEvent) {
      switch (aItemKey) {
      case "newFromClipboard":
        gCmd.newClippingFromClipboard();
        break;

      case "backup":
        gCmd.backup();
        break;
        
      case "restoreFromBackup":
        gCmd.restoreFromBackup();
        break;
        
      case "importFromFile":
        gCmd.importFromFile();
        break;

      case "exportToFile":
        gCmd.exportToFile();
        break;

      case "removeAllSrcURLs":
        gCmd.removeAllSrcURLs();
        break;

      case "togglePlchldrToolbar":
        gCmd.showHidePlaceholderToolbar();
        break;
        
      case "toggleDetailsPane":
        gCmd.showHideDetailsPane();
        break;

      case "toggleStatusBar":
        gCmd.showHideStatusBar();
        break;

      case "maximizeWnd":
        setTimeout(async () => { gCmd.toggleMaximize() }, 100);
        break;

      case "minimizeWhenInactive":
        gCmd.toggleMinimizeWhenInactive();
        break;
        
      case "openExtensionPrefs":
        gCmd.openExtensionPrefs();
        break;
        
      default:
        window.alert("The selected action is not available right now.");
        break;
      }
    },
    items: {
      newFromClipboard: {
        name: browser.i18n.getMessage("mnuNewFromClipbd"),
        className: "ae-menuitem",
      },
      separator0: "--------",
      backup: {
        name: browser.i18n.getMessage("mnuBackup"),
        className: "ae-menuitem",
        disabled: function (aKey, aOpt) {
          return (gIsClippingsTreeEmpty);
        }
      },
      restoreFromBackup: {
        name: browser.i18n.getMessage("mnuRestoreFromBackup"),
        className: "ae-menuitem"
      },
      separator1: "--------",
      importFromFile: {
        name: browser.i18n.getMessage("mnuImport"),
        className: "ae-menuitem"
      },
      exportToFile: {
        name: browser.i18n.getMessage("mnuExport"),
        className: "ae-menuitem",
        disabled: function (aKey, aOpt) {
          return (gIsClippingsTreeEmpty);
        }
      },
      moreToolsSubmenu: {
        name: browser.i18n.getMessage("mnuMoreTools"),
        items: {
          removeAllSrcURLs: {
            name: browser.i18n.getMessage("mnuRemoveAllSrcURLs"),
            className: "ae-menuitem",
            disabled: function (aKey, aOpt) {
              return (gIsClippingsTreeEmpty);
            }
          },
        }
      },
      separator2: "--------",
      showHideSubmenu: {
        name: browser.i18n.getMessage("mnuShowHide"),
        items: {
          toggleDetailsPane: {
            name: browser.i18n.getMessage("mnuShowHideDetails"),
            className: "ae-menuitem",
            disabled: function (aKey, aOpt) {
              return (gIsClippingsTreeEmpty || aeClippingsTree.isFolderSelected() || aeClippingsTree.isSeparatorSelected());
            },
            icon: function (aOpt, $itemElement, aItemKey, aItem) {
              if ($("#source-url-bar").css("display") != "none"
                  && $("#options-bar").css("display") != "none") {
                return "context-menu-icon-checked";
              }
            }
          },
          togglePlchldrToolbar: {
            name: browser.i18n.getMessage("mnuShowHidePlchldrBar"),
            className: "ae-menuitem",
            disabled: function (aKey, aOpt) {
              return (gIsClippingsTreeEmpty || aeClippingsTree.isFolderSelected() || aeClippingsTree.isSeparatorSelected());
            },
            icon: function (aOpt, $itemElement, aItemKey, aItem) {
              if ($("#placeholder-toolbar").css("display") != "none") {
                return "context-menu-icon-checked";
              }
            }
          },         
          toggleStatusBar: {
            name: browser.i18n.getMessage("mnuShowHideStatusBar"),
            className: "ae-menuitem",
            icon: function (aOpt, $itemElement, aItemKey, aItem) {
              if ($("#status-bar").css("display") != "none") {
                return "context-menu-icon-checked";
              }
            }
          }
        }
      },
      maximizeWnd: {
        name: browser.i18n.getMessage("mnuMaximize"),
        className: "ae-menuitem",
        visible: function (aKey, aOpt) {
          return (gEnvInfo.os == "win" || DEBUG_WND_ACTIONS);
        },
        icon: function (aKey, aOpt) {
          if (gIsMaximized) {
            return "context-menu-icon-checked";
          }
        }
      },
      minimizeWhenInactive: {
        name: browser.i18n.getMessage("mnuMinimizeWhenInactive"),
        className: "ae-menuitem",
        visible: function (aKey, aOpt) {
          return (gEnvInfo.os == "linux" || DEBUG_WND_ACTIONS);
        },
        icon: function (aKey, aOpt) {
          if (gPrefs.clippingsMgrMinzWhenInactv) {
            return "context-menu-icon-checked";
          }
        }
      },
      windowCmdsSeparator: {
        type: "cm_separator",
        visible: function (akey, aOpt) {
          return (gEnvInfo.os != "mac" || DEBUG_WND_ACTIONS);
        }
      },
      openExtensionPrefs: {
        name: browser.i18n.getMessage("mnuShowExtPrefs"),
        className: "ae-menuitem"
      }
    }
  });

  aeInterxn.initContextMenuAriaRoles(".placeholder-menu");
  aeInterxn.initContextMenuAriaRoles(".tools-menu");

  $("#custom-plchldr").on("click", aEvent => { gCmd.insertCustomPlaceholder() });
  $("#auto-incr-plchldr").on("click", aEvent => { gCmd.insertNumericPlaceholder() });
  $("#show-shortcut-list").on("click", aEvent => { gCmd.showShortcutList() });

  gSearchBox.init();

  aeVisual.preloadMsgBoxIcons(true);
  aeVisual.preloadLafImages();
  aeVisual.cacheIcons(
    "newClipping_hover.svg",
    "newClipping-active-dk.svg",
    "newFolder_hover.svg",
    "newFolder-active-dk.svg",
    "moveTo_hover.svg",
    "moveTo-active-dk.svg",
    "delete_hover.svg",
    "delete-active-dk.svg",
    "undo_hover.svg",
    "options_hover.svg",
    "options_menuopen.svg",
    "shctkeys_hover.svg",
    "help_hover.svg",
    "customPlchldr.svg",
    "numericPlchldr.svg",
    "customPlchldr_hover.svg",
    "numericPlchldr_hover.svg",
    "options_dk_hover.svg",
    "options_dk_active.svg",
    "options_dk_menuopen.svg",
    "shctkeys_hover-dk.svg",
    "help-dk.svg",
    "ok_hover.svg",
    "ok_active.svg",
    "ok_hover_dk.svg",
    "ok_active_dk.svg",
    "cancel_hover.svg",
    "cancel_active.svg",
    "cancel_hover_dk.svg",
    "cancel_active_dk.svg",
    "folder-open.svg",
    "tree-fldr-open.svg",
    "tree-fldr-close.svg",
    "tree-fldr-open-dk.svg",
    "tree-fldr-close-dk.svg",
    "auto-minimize-on.svg",
    "auto-minimize-off.svg",
    "auto-minimize-on-dk.svg",
    "auto-minimize-off-dk.svg"
  );
}


function initInstantEditing()
{
  $("#clipping-name").attr("placeholder", browser.i18n.getMessage("clipMgrNameHint")).blur(aEvent => {
    let tree = aeClippingsTree.getTree();
    let selectedNode = tree.activeNode;
    let name = aEvent.target.value;
    let id = parseInt(selectedNode.key);

    if (selectedNode.isFolder()) {
      if (name) {
        gCmd.editFolderNameIntrl(id, name, gCmd.UNDO_STACK);
      }
      else {
        aEvent.target.value = browser.i18n.getMessage("untitledFolder");
        gCmd.editFolderNameIntrl(id, browser.i18n.getMessage("untitledFolder"), gCmd.UNDO_STACK);
      }
    }
    else {
      if (name) {
        gCmd.editClippingNameIntrl(id, name, gCmd.UNDO_STACK);
      }
      else {
        aEvent.target.value = browser.i18n.getMessage("untitledClipping");
        gCmd.editClippingNameIntrl(id, browser.i18n.getMessage("untitledClipping"), gCmd.UNDO_STACK);
      }
    }
  });
  
  $("#clipping-text").attr("placeholder", browser.i18n.getMessage("clipMgrContentHint")).blur(aEvent => {
    let tree = aeClippingsTree.getTree();
    let selectedNode = tree.activeNode;
    let id = parseInt(selectedNode.key);

    if (! selectedNode.folder) {
      let content = aEvent.target.value;
      gCmd.editClippingContentIntrl(id, content, gCmd.UNDO_STACK);
    }
  }).attr("spellcheck", gPrefs.checkSpelling);

  gItemNameEditor = new InstantEditor("#clipping-name");
  gClippingContentEditor = new InstantEditor("#clipping-text");
}


function initIntroBannerAndHelpDlg()
{
  const isWin = gEnvInfo.os == "win";
  const isMacOS = gEnvInfo.os == "mac";
  const isLinux = gEnvInfo.os == "linux";

  function buildKeyMapTable(aTableDOMElt)
  {
    let shctKeys = [];
    if (isMacOS) {
      shctKeys = [
        "\u2326", "esc", "\u2318C", "\u2318D", "\u2318F", "\u2318W", "\u2318Z",
        "F1", "F2 / \u21e7\u2318Z", "\u2318F10"
      ];
    }
    else {
      let altRedo;
      if (isWin) {
        altRedo = `${browser.i18n.getMessage("keyCtrl")}+Y`;
      }
      else {
        altRedo = `${browser.i18n.getMessage("keyCtrl")}+${browser.i18n.getMessage("keyShift")}+Z`;
      }
      shctKeys = [
        browser.i18n.getMessage("keyDel"),
        browser.i18n.getMessage("keyEsc"),
        `${browser.i18n.getMessage("keyCtrl")}+C`,
        `${browser.i18n.getMessage("keyCtrl")}+D`,
        `${browser.i18n.getMessage("keyCtrl")}+F`,
        `${browser.i18n.getMessage("keyCtrl")}+W`,
        `${browser.i18n.getMessage("keyCtrl")}+Z`,
        "F1",
        `F2 / ${altRedo}`,
        `${browser.i18n.getMessage("keyCtrl")}+F10`,
      ];
    }

    function buildKeyMapTableRow(aShctKey, aCmdL10nStrIdx, aIsCompactKey=false)
    {
      let tr = document.createElement("tr");
      let tdKey = document.createElement("td");
      let tdCmd = document.createElement("td");
      tdKey.appendChild(document.createTextNode(aShctKey));
      tdCmd.appendChild(document.createTextNode(browser.i18n.getMessage(aCmdL10nStrIdx)));

      if (aIsCompactKey) {
        tdKey.className = "condensed";
      }

      tr.appendChild(tdKey);
      tr.appendChild(tdCmd);

      return tr;
    }

    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[0], "clipMgrIntroCmdDel"));
    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[1], "clipMgrIntroCmdClearSrchBar"));
    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[2], "clipMgrIntroCpyClpTxt"));
    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[3], "clipMgrIntroCmdDetailsPane"));
    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[4], "clipMgrIntroCmdSrch"));
    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[5], "clipMgrIntroCmdClose"));
    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[6], "clipMgrIntroCmdUndo"));
    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[7], "clipMgrIntroCmdShowIntro"));
    aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[8], "clipMgrIntroCmdRedo", isLinux));

    if (!isLinux) {
      aTableDOMElt.appendChild(buildKeyMapTableRow(shctKeys[9], "clipMgrIntroCmdMaximize"));
    }
  }

  let shctKeyTbls = $(".shortcut-key-tbl");

  for (let tbl of shctKeyTbls) {
    buildKeyMapTable(tbl);
  }
}


function initDialogs()
{
  initIntroBannerAndHelpDlg();

  gDialog.shctKeyConflict = new aeDialog("#shortcut-key-conflict-msgbox");
  gDialog.shctKeyConflict.onAccept = function (aEvent)
  {
    gDialog.shctKeyConflict.close();

    // NOTE: As of Firefox 57b8, this doesn't do anything.
    $("#clipping-key")[0].selectedIndex = gShortcutKey.getPrevSelectedIndex();
  };

  gDialog.clippingMissingSrcURL = new aeDialog("#clipping-missing-src-url-msgbar");
  gDialog.noUndoNotify = new aeDialog("#no-undo-msgbar");
  gDialog.noRedoNotify = new aeDialog("#no-redo-msgbar");
  gDialog.clipboardEmpty = new aeDialog("#clipboard-empty-msgbar");
  gDialog.actionUnavailable = new aeDialog("#action-not-available");

  gDialog.requestExtPerm = new aeDialog("#request-ext-perm-dlg");
  gDialog.requestExtPerm.setProps({
    extPerm: null,
    extPermStrKeys: {
      clipboardRead: "extPrmClipbdR",
      clipboardWrite: "extPrmClipbdW",
    },
  });

  gDialog.requestExtPerm.setPermission = function (aPermission)
  {
    this.extPerm = aPermission;
  };

  gDialog.requestExtPerm.onFirstInit = function ()
  {
    let extName = browser.i18n.getMessage("extName");
    this.find("#grant-ext-perm").text(browser.i18n.getMessage("extPermInstr", extName));
  };
  gDialog.requestExtPerm.onInit = function ()
  {
    if (! this.extPerm) {
      throw new ReferenceError("Extension permission keyword not set");
    }

    let strKey = this.extPermStrKeys[this.extPerm];
    this.find(".dlg-content ul > li").text(browser.i18n.getMessage(strKey));
  };

  gDialog.requestExtPerm.onUnload = function ()
  {
    this.extPerm = null;
    this.find(".dlg-content ul > li").text('');
  };

  gDialog.shortcutList = new aeDialog("#shortcut-list-dlg");
  gDialog.shortcutList.onFirstInit = async function ()
  {
    let keybPasteKeys = await browser.runtime.sendMessage({msgID: "get-shct-key-prefix-ui-str"});
    let shctPrefixKey = 0;
    $("#shortcut-instrxns").text(browser.i18n.getMessage("clipMgrShortcutHelpInstrxn", keybPasteKeys));
    let extVer = browser.runtime.getManifest().version;
    
    aeImportExport.setL10nStrings({
      shctTitle: browser.i18n.getMessage("expHTMLTitle"),
      hostAppInfo: browser.i18n.getMessage("expHTMLHostAppInfo", [extVer, gEnvInfo.hostAppName]),
      shctKeyInstrxns: browser.i18n.getMessage("expHTMLShctKeyInstrxn"),
      shctKeyCustNote: browser.i18n.getMessage("expHTMLShctKeyCustNote"),
      shctKeyColHdr: browser.i18n.getMessage("expHTMLShctKeyCol"),
      clippingNameColHdr: browser.i18n.getMessage("expHTMLClipNameCol"),
    });

    $("#export-shct-list").on("click", aEvent => {
      aeImportExport.getShortcutKeyListHTML(true).then(aHTMLData => {
        let blobData = new Blob([aHTMLData], { type: "text/html;charset=utf-8"});
        let downldOpts = {
          url: URL.createObjectURL(blobData),
          filename: aeConst.HTML_EXPORT_SHORTCUTS_FILENAME,
          saveAs: true,
        };
        return browser.downloads.download(downldOpts);

      }).catch(aErr => {
        if (aErr.fileName == "undefined") {
          // User cancel
        }
        else {
          console.error(aErr);
          window.alert("Sorry, an error occurred while creating the export file.\n\nDetails:\n" + getErrStr(aErr));
        }
      });
    });
  };

  gDialog.shortcutList.onInit = async function ()
  {
    let shctListHTML;
    try {
      shctListHTML = await aeImportExport.getShortcutKeyListHTML(false);
    }
    catch (e) {
      console.error("Clippings/wx::pg.js: gDialog.shortcutList.onInit(): " + e);
      return;
    }

    $("#shortcut-list-content").append(sanitizeHTML(shctListHTML));

    let tbodyElt = $("#shortcut-list-dlg > #shortcut-list-content > table > tbody");
    tbodyElt.attr("tabindex", "0");

    let dlgElts = [
      tbodyElt[0],
      $("#shortcut-list-dlg > .dlg-btns > #export-shct-list")[0],
      $("#shortcut-list-dlg > .dlg-btns > .dlg-accept")[0],
    ];
    this.initKeyboardNavigation(dlgElts);
  };

  gDialog.shortcutList.onUnload = function ()
  {
    $("#shortcut-list-content").empty();
  };

  gDialog.insCustomPlchldr = new aeDialog("#custom-placeholder-dlg");
  gDialog.insCustomPlchldr.validatePlaceholderName = function (aName) {
    if (aName.match(/[^a-zA-Z0-9_\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]/)) {
      return false;
    }
    return true;    
  };
  gDialog.insCustomPlchldr.onFirstInit = function ()
  {
    $("#custom-plchldr-name").prop("placeholder", browser.i18n.getMessage("placeholderNameHint"));
    $("#custom-plchldr-name").on("keydown", aEvent => {
      if ($(aEvent.target).hasClass("input-error")) {
        $(aEvent.target).removeClass("input-error");
      }
    });
  };
  gDialog.insCustomPlchldr.onInit = function ()
  {
    $("#custom-plchldr-default-val").val("");
    $("#custom-plchldr-name").removeClass("input-error").val("");
  };
  gDialog.insCustomPlchldr.onShow = function ()
  {
    $("#custom-plchldr-name").trigger("focus");
  };
  gDialog.insCustomPlchldr.onAccept = function ()
  {
    let placeholderName = $("#custom-plchldr-name").val();
    if (! placeholderName) {
      $("#custom-plchldr-name").trigger("focus");
      return;
    }
    
    if (! this.validatePlaceholderName(placeholderName)) {
      $("#custom-plchldr-name").addClass("input-error").trigger("focus");
      return;
    }

    let placeholderValue = $("#custom-plchldr-default-val").val();
    let placeholder = "$[" + placeholderName;

    if (placeholderValue) {
      placeholder = placeholder + "{" + placeholderValue + "}]";
    }
    else {
      placeholder = placeholder + "]";
    }

    let contentTextArea = $("#clipping-text");
    contentTextArea.trigger("focus");
    insertTextIntoTextbox(contentTextArea, placeholder);
    this.close();
  };

  gDialog.insAutoIncrPlchldr = new aeDialog("#numeric-placeholder-dlg");
  gDialog.insAutoIncrPlchldr.onFirstInit = function ()
  {
    $("#numeric-plchldr-name").prop("placeholder", browser.i18n.getMessage("placeholderNameHint"));
    $("#numeric-plchldr-name").on("keydown", aEvent => {
      if ($(aEvent.target).hasClass("input-error")) {
        $(aEvent.target).removeClass("input-error");
      }
    });
  };
  gDialog.insAutoIncrPlchldr.onInit = function ()
  {
    $("#numeric-plchldr-name").removeClass("input-error").val("");
  };
  gDialog.insAutoIncrPlchldr.onShow = function ()
  {
    $("#numeric-plchldr-name").trigger("focus");
  };
  gDialog.insAutoIncrPlchldr.onAccept = function ()
  {
    let placeholderName = $("#numeric-plchldr-name").val();
    if (! placeholderName) {
      $("#numeric-plchldr-name").trigger("focus");
      return;
    }
    
    if (! gDialog.insCustomPlchldr.validatePlaceholderName(placeholderName)) {
      $("#numeric-plchldr-name").addClass("input-error").trigger("focus");
      return;
    }

    let placeholder = "#[" + placeholderName + "]";

    let contentTextArea = $("#clipping-text");
    contentTextArea.trigger("focus");
    insertTextIntoTextbox(contentTextArea, placeholder);
    this.close();
  };

  gDialog.insDateTimePlchldr = new aeDialog("#insert-date-time-placeholder-dlg");
  gDialog.insDateTimePlchldr.setProps({
    dateFormats: [
      "dddd, MMMM Do, YYYY",
      "MMMM D, YYYY",
      "MM/DD/YYYY",
      "YYYY-MM-DD",
      "D MMMM YYYY",
      "D.M.YYYY",
      "DD-MMM-YYYY",
      "MM/DD/YYYY h:mm A",
      "ddd, MMM DD, YYYY hh:mm:ss A ZZ",
    ],
    timeFormats: [
      "h:mm A",
      "HH:mm",
      "HH:mm:ss",
    ],
  });
  gDialog.insDateTimePlchldr.onInit = function ()
  {
    let dtFmtList = $("#date-time-format-list")[0];

    if (gEnvInfo.os != "mac") {
      dtFmtList.setAttribute("size", "11");
    }

    let lang = browser.i18n.getUILanguage();
    if (lang.search(/en/) == -1) {
      // Handle non-English locales.
      this.dateFormats = [
        "LL",
        "ll",
        "l",
        "YYYY-MM-DD",
        "lll",
        "LLLL",
        "llll",
      ];
      this.timeFormats = [
        "LT",
      ];
    }
    
    let date = new Date();
    let defaultDateFmtOpt = document.createElement("option");
    defaultDateFmtOpt.setAttribute("value", "DATE");
    defaultDateFmtOpt.appendChild(document.createTextNode(date.toLocaleDateString()));
    dtFmtList.appendChild(defaultDateFmtOpt);

    for (let dateFmt of this.dateFormats) {
      let dateFmtOpt = document.createElement("option");
      dateFmtOpt.setAttribute("value", dateFmt);
      let dateFmtOptTxt = document.createTextNode(moment().format(dateFmt));
      dateFmtOpt.appendChild(dateFmtOptTxt);
      dtFmtList.appendChild(dateFmtOpt);
    }

    let defaultTimeFmtOpt = document.createElement("option");
    defaultTimeFmtOpt.setAttribute("value", "TIME");
    defaultTimeFmtOpt.appendChild(document.createTextNode(date.toLocaleTimeString()));
    dtFmtList.appendChild(defaultTimeFmtOpt);

    for (let timeFmt of this.timeFormats) {
      let timeFmtOpt = document.createElement("option");
      timeFmtOpt.setAttribute("value", timeFmt);
      let timeFmtOptTxt = document.createTextNode(moment().format(timeFmt));
      timeFmtOpt.appendChild(timeFmtOptTxt);
      dtFmtList.appendChild(timeFmtOpt);
    }
  };
  gDialog.insDateTimePlchldr.onShow = function ()
  {
    let fmtList = $("#date-time-format-list")[0];
    fmtList.trigger("focus");
    fmtList.selectedIndex = 0;
  };
  gDialog.insDateTimePlchldr.onAccept = function ()
  {
    let placeholder = "";
    let dtFmtList = $("#date-time-format-list")[0];
    let selectedFmt = dtFmtList.options[dtFmtList.selectedIndex].value;

    if (selectedFmt == "DATE" || selectedFmt == "TIME") {
      placeholder = "$[" + selectedFmt + "]";
    }
    else {
      if (dtFmtList.selectedIndex > this.dateFormats.length) {
        placeholder = "$[TIME(" + selectedFmt + ")]";
      }
      else {
        placeholder = "$[DATE(" + selectedFmt + ")]";
      }
    }

    this.close();

    let contentTextArea = $("#clipping-text");
    contentTextArea.trigger("focus");
    insertTextIntoTextbox(contentTextArea, placeholder);
  };
  gDialog.insDateTimePlchldr.onUnload = function ()
  {
    $("#date-time-format-list").empty();
  };
  
  gDialog.importFromFile = new aeDialog("#import-dlg");
  gDialog.importFromFile.setProps({
    IMP_APPEND: 0,
    IMP_REPLACE: 1,
    mode: 0,
  });

  gDialog.importFromFile.onFirstInit = function ()
  {
    $("#import-clippings-browse").on("click", aEvent => {
      let inputFile = $("#import-clippings-file-upload")[0];
      inputFile.showPicker();
    });

    $("#import-clippings-file-upload").on("change", aEvent => {
      $("#import-error").text("").hide();

      let inputFileElt = aEvent.target;
      if (inputFileElt.files.length > 0) {
        let file = inputFileElt.files[0];

        if (aeImportExport.isValidFileType(file)) {
          $("#import-clippings-file-path").val(file.name);
          $("#import-dlg button.dlg-accept").removeAttr("disabled");
        }
        else {
          $("#import-clippings-file-path").val("");
          $("#import-dlg button.dlg-accept").attr("disabled", "true");
        }
      }
      if (this.mode == this.IMP_REPLACE && !gIsClippingsTreeEmpty) {
        $("#restore-backup-warning").show();
      }
    });

    $("#import-clippings-file-path").on("contextmenu", aEvent => {
      aEvent.preventDefault();
    }).on("focus", aEvent => { aEvent.target.select() });
  };

  gDialog.importFromFile.onInit = function ()
  {
    if (this.mode == this.IMP_REPLACE) {
      $("#import-clippings-label").text(browser.i18n.getMessage("labelSelBkupFile"));
      $("#import-clippings-replc-shct-keys-checkbox").hide();
      $("#import-formats").hide();
      
      if (! gIsClippingsTreeEmpty) {
        $("#restore-backup-warning").show();
      }

      $("#import-dlg-action-btn").text(browser.i18n.getMessage("btnRestoreBkup"));
    }
    else {
      $("#import-clippings-label").text(browser.i18n.getMessage("labelSelImportFile"));
      $("#import-clippings-replc-shct-keys-checkbox").show();
      $("#import-formats").show();
      $("#restore-backup-warning").hide();
      $("#import-dlg-action-btn").text(browser.i18n.getMessage("btnImport"));
    }

    $("#import-clippings-file-path").val("");
    $("#import-dlg button.dlg-accept").attr("disabled", "true");
    gSuppressAutoMinzWnd = true;

    // Delay to allow time to switch to import or restore backup UI.
    setTimeout(() => {
      this.find("#import-clippings-browse")[0].focus();
    }, 200);
  };

  gDialog.importFromFile.onUnload = function ()
  {   
    $("#import-error").text("").hide();
    $("#import-dlg #import-clippings-file-upload").val("");
    $("#import-clippings-replc-shct-keys")[0].checked = true;
    gSuppressAutoMinzWnd = false;
  };
  gDialog.importFromFile.onAccept = function (aEvent)
  {
    let currClippingsData;
    
    function importFile(aAppendItems)
    {
      let inputFileElt = $("#import-clippings-file-upload")[0];
      let fileList = inputFileElt.files;

      if (fileList.length == 0) {
        return;
      }
      
      $("#import-progress-bar").show();

      let importFile = fileList[0];
      log(`Clippings Manager: Selected import file: '${importFile.name}'; file size: ${importFile.size} bytes`);

      let fileReader = new FileReader();
      fileReader.addEventListener("load", aEvent => {
        let rawData = aEvent.target.result;
        let replaceShortcutKeys = ($("#import-clippings-replc-shct-keys:checked").length > 0);
        
        try {
          if (importFile.name.endsWith(".json")) {
            if (!aeImportExport.isValidClippingsJSON(rawData)
                && !aeImportExport.isValidTextSnippetsJSON(rawData)) {
              throw new Error(`Import file "${importFile.name}" is invalid.`);
            }
            aeImportExport.importFromJSON(rawData, replaceShortcutKeys, aAppendItems);
          }
          else if (importFile.name.endsWith(".rdf")) {
            aeImportExport.importFromRDF(rawData, replaceShortcutKeys, aAppendItems);
          }
        }
        catch (e) {
          $("#import-progress-bar").hide();
          warn(e);
          $("#import-error").text(browser.i18n.getMessage("importError")).show();

          if (aAppendItems) {
            browser.runtime.sendMessage({
              msgID: "import-finished",
              isSuccess: false,
            });
          }
          else {
            log("Clippings/wx::pg.js: Restore from backup file has failed.  Rolling back.");
            aeImportExport.importFromJSON(currClippingsData, true, aAppendItems);
            setTimeout(() => {
              // Restoring the current clippings data will change the IDs of
              // clippings and folders, so force a rebuild of the Clippings
              // context menu.
              browser.runtime.sendMessage({
                msgID: "import-finished",
                isSuccess: true,
              });
            }, REBUILD_BRWS_CXT_MENU_DELAY);
          }

          return;
        }

        log("Clippings/wx::pg.js: gDialog.importFromFile.onAccept()::importFile(): Importing Clippings data asynchronously.");
        
        $("#import-error").text("").hide();
        $("#import-progress-bar").hide();
        gDialog.importFromFile.close();
        gSuppressAutoMinzWnd = false;

        gDialog.importConfirmMsgBox.setMessage(browser.i18n.getMessage("clipMgrImportConfirm", importFile.name));
        gDialog.importConfirmMsgBox.showModal();
      });

      fileReader.readAsText(importFile);
    } // END nested function

    if (this.mode == this.IMP_REPLACE) {
      info("Clippings/wx::pg.js: Import dialog mode: Restore From Backup");

      $("#restore-backup-warning").hide();

      // Create an in-memory backup of the existing data.  If the restore fails
      // due to bad JSON import data, then roll back by restoring this backup.
      let excludeSyncFldrID = null;
      if (gPrefs.syncClippings) {
        excludeSyncFldrID = gPrefs.syncFolderID;
      }
      aeImportExport.exportToJSON(true, false, aeConst.ROOT_FOLDER_ID, excludeSyncFldrID, true).then(aJSONData => {
        currClippingsData = aJSONData;
        return browser.runtime.sendMessage({msgID: "import-started"});

      }).then(() => {
        gClippingsDB.transaction("rw", gClippingsDB.clippings, gClippingsDB.folders, () => {
          log("Clippings/wx::pg.js: gDialog.importFromFile.onAccept(): Starting restore from backup file.\nDeleting all clippings and folders (except the 'Synced Clippings' folder, if Sync Clippings turned on).");

	  gCmd.recentAction = gCmd.ACTION_RESTORE_BACKUP;

          gClippingsDB.folders.each((aItem, aCursor) => {
            if ("isSync" in aItem) {
              // Don't delete the Synced Clippings folder.
              return;
            }

            let fldrID = aItem.id + "F";         
            if (! gSyncedItemsIDs.has(fldrID)) {
              gClippingsSvc.deleteFolder(parseInt(fldrID));
            }
          }).then(() => {
            return gClippingsDB.clippings.each((aItem, aCursor) => {
              let clpgID = aItem.id + "C";
              if (! gSyncedItemsIDs.has(clpgID)) {
                gClippingsSvc.deleteClipping(parseInt(clpgID));
              }
            });
          }).then(() => {
            log("Clippings/wx::pg.js: Finished deleting clippings and folders. Clearing undo stack and starting import of backup file.");

            gCmd.undoStack.clear();
            gCmd.redoStack.clear();
            importFile(false);
          });
        }).catch(aErr => {
          console.error("Clippings/wx::pg.js: gDialog.importFromFile.onAccept(): " + aErr);
        });
      });      
    }
    else {
      info("Clippings/wx::pg.js: Import dialog mode: Import File");
      gCmd.recentAction = gCmd.ACTION_IMPORT;

      browser.runtime.sendMessage({msgID: "import-started"}).then(() => {
        importFile(true);
      });
    }
  };
  
  gDialog.exportToFile = new aeDialog("#export-dlg");
  gDialog.exportToFile.setProps({
    FMT_CLIPPINGS_WX: 0,
    FMT_HTML: 1,
    FMT_CSV: 2,
    inclSrcURLs: false,
    inclSep: false,
    fmtDesc: [
      browser.i18n.getMessage("expFmtClippings6Desc"), // Clippings
      browser.i18n.getMessage("expFmtHTMLDocDesc"),    // HTML Document
      browser.i18n.getMessage("expFmtCSVDesc"),        // CSV File
    ],
  });

  gDialog.exportToFile.onFirstInit = function ()
  {
    $("#export-format-list").change(aEvent => {
      let selectedFmtIdx = aEvent.target.selectedIndex;
      $("#format-description").text(this.fmtDesc[selectedFmtIdx]);

      if (selectedFmtIdx == this.FMT_CLIPPINGS_WX) {
        $("#include-src-urls").prop("disabled", false).prop("checked", this.inclSrcURLs);
        $("#export-incl-separators").prop("disabled", false).prop("checked", this.inclSep);
      }
      else if (selectedFmtIdx == this.FMT_HTML || selectedFmtIdx == this.FMT_CSV) {
        $("#include-src-urls").prop("disabled", true).prop("checked", false);
        $("#export-incl-separators").prop("disabled", true).prop("checked", false);
      }
    });

    $("#include-src-urls").on("click", aEvent => {
      this.inclSrcURLs = aEvent.target.checked;
    });
    $("#export-incl-separators").on("click", aEvent => {
      this.inclSep = aEvent.target.checked;
    });
  };

  gDialog.exportToFile.onInit = function ()
  {
    this.inclSrcURLs = true;
    this.inclSep = true;
    gSuppressAutoMinzWnd = true;

    this.find("#export-format-list")[0].selectedIndex = this.FMT_CLIPPINGS_WX;
    this.find("#format-description").text(this.fmtDesc[this.FMT_CLIPPINGS_WX]);
    this.find("#include-src-urls").prop("checked", this.inclSrcURLs).prop("disabled", false);
    this.find("#export-incl-separators").prop("checked", this.inclSep).prop("disabled", false);
  };

  gDialog.exportToFile.onShow = function ()
  {
    $("#export-format-list")[0].focus();
  };

  gDialog.exportToFile.onAfterAccept = function ()
  {
    function saveToFile(aBlobData, aFilename)
    {
      browser.downloads.download({
        url: URL.createObjectURL(aBlobData),
        filename: aFilename,
        saveAs: true
      }).then(aDownldItemID => {
        gSuppressAutoMinzWnd = false;
        setStatusBarMsg(browser.i18n.getMessage("statusExportDone"));

        return browser.downloads.search({ id: aDownldItemID });

      }).then(aDownldItems => {

        if (aDownldItems && aDownldItems.length > 0) {
          let exportFilePath = aDownldItems[0].filename;
          gDialog.exportConfirmMsgBox.setMessage(browser.i18n.getMessage("clipMgrExportConfirm", exportFilePath));
          gDialog.exportConfirmMsgBox.showModal();
        }
      }).catch(aErr => {
        gSuppressAutoMinzWnd = false;
        if (aErr.fileName == "undefined") {
          setStatusBarMsg();
        }
        else {
          console.error(aErr);
          setStatusBarMsg(browser.i18n.getMessage("statusExportFailed"));
          window.alert(browser.i18n.getMessage("exportError", aErr));
        }
      });
    }

    let excludeSyncFldrID = null;
    if (gPrefs.syncClippings) {
      excludeSyncFldrID = gPrefs.syncFolderID;
    }
    
    let selectedFmtIdx = $("#export-format-list")[0].selectedIndex;
    setStatusBarMsg(browser.i18n.getMessage("statusExportStart"));

    if (selectedFmtIdx == this.FMT_CLIPPINGS_WX) {
      let inclSrcURLs = $("#include-src-urls").prop("checked");
      let inclSeparators = $("#export-incl-separators").prop("checked");

      aeImportExport.exportToJSON(inclSrcURLs, false, aeConst.ROOT_FOLDER_ID, excludeSyncFldrID, true, inclSeparators).then(aJSONData => {
        let blobData = new Blob([aJSONData], {type: "application/json;charset=utf-8"});

        saveToFile(blobData, aeConst.CLIPPINGS_EXPORT_FILENAME);
	gCmd.recentAction = gCmd.ACTION_EXPORT;
	
      }).catch(aErr => {
        window.alert("Sorry, an error occurred while exporting to Clippings 6 format.\n\nDetails:\n" + getErrStr(aErr));
        setStatusBarMsg(browser.i18n.getMessage("statusExportFailed"));
        gSuppressAutoMinzWnd = false;
      });
    }
    else if (selectedFmtIdx == this.FMT_HTML) {
      aeImportExport.exportToHTML().then(aHTMLData => {
        let blobData = new Blob([aHTMLData], { type: "text/html;charset=utf-8"});
        saveToFile(blobData, aeConst.HTML_EXPORT_FILENAME);
	gCmd.recentAction = gCmd.ACTION_EXPORT;
	
      }).catch(aErr => {
        window.alert("Sorry, an error occurred while exporting to HTML Document format.\n\nDetails:\n" + getErrStr(aErr));
        setStatusBarMsg(browser.i18n.getMessage("statusExportFailed"));
        gSuppressAutoMinzWnd = false;
      });
    }
    else if (selectedFmtIdx == this.FMT_CSV) {
      aeImportExport.exportToCSV(excludeSyncFldrID).then(aCSVData => {
        let blobData = new Blob([aCSVData], { type: "text/csv;charset=utf-8" });
        saveToFile(blobData, aeConst.CSV_EXPORT_FILENAME);
	gCmd.recentAction = gCmd.ACTION_EXPORT;

      }).catch(aErr => {
        window.alert("Sorry, an error occurred while exporting to CSV format.\n\nDetails:\n" + getErrStr(aErr));
        setStatusBarMsg(browser.i18n.getMessage("statusExportFailed"));
        gSuppressAutoMinzWnd = false;
      });
    }
  };

  gDialog.importConfirmMsgBox = new aeDialog("#import-confirm-msgbox");
  gDialog.importConfirmMsgBox.setMessage = function (aMessage)
  {
    $("#import-confirm-msgbox > .msgbox-content").text(aMessage);
  };
  gDialog.importConfirmMsgBox.onShow = async function ()
  {
    if (gPrefs.clippingsUnchanged) {
      await aePrefs.setPrefs({ clippingsUnchanged: false });
    }
  };
  gDialog.importConfirmMsgBox.onAfterAccept = async function ()
  {
    await browser.runtime.sendMessage({
      msgID: "import-finished",
      isSuccess: true,
    });
    await rebuildClippingsTree();
  };

  gDialog.exportConfirmMsgBox = new aeDialog("#export-confirm-msgbox");
  gDialog.exportConfirmMsgBox.setMessage = function (aMessage)
  {
    $("#export-confirm-msgbox > .msgbox-content").text(aMessage);
  };

  gDialog.backupConfirmMsgBox = new aeDialog("#backup-confirm-msgbox");
  gDialog.backupConfirmMsgBox.setMessage = function (aMessage)
  {
    $("#backup-confirm-msgbox > .msgbox-content").text(aMessage);
  };
  gDialog.backupConfirmMsgBox.onShow = async function ()
  {
    await aePrefs.setPrefs({ clippingsUnchanged: true });
  };
  gDialog.backupConfirmMsgBox.onAfterAccept = async function ()
  {
    if (gIsBackupMode) {
      closeWnd();
    }
  };
  
  gDialog.removeAllSrcURLs = new aeDialog("#remove-all-source-urls-dlg");
  gDialog.removeAllSrcURLs.onFirstInit = function ()
  {
    this.focusedSelector = ".dlg-btns > .dlg-accept";
    this.find(".dlg-btns > .dlg-btn-yes").on("click", aEvent => {
      this.close();
      gCmd.removeAllSrcURLsIntrl();
    });
  };

  gDialog.removeAllSrcURLsConfirm = new aeDialog("#all-src-urls-removed-confirm-msgbar");
  gDialog.removeAllSrcURLsConfirm.onInit = function ()
  {
    // Reselect the selected tree node to force a call to updateDisplay().
    aeClippingsTree.getTree().reactivate(true);
  };

  gDialog.restoreSrcURLs = new aeDialog("#restored-src-urls-msgbar");
  gDialog.restoreSrcURLs.onInit = function ()
  {
    aeClippingsTree.getTree().reactivate(true);
  };

  gDialog.moveTo = new aeDialog("#move-dlg");
  gDialog.moveTo.setProps({
    fldrTree: null,
    selectedFldrNode: null,
  });
  gDialog.moveTo.resetTree = function ()
  {
    if (! this.fldrTree) {
      return;
    }
    let fldrTree = this.fldrTree.getTree();
    fldrTree.clear();
    this.fldrTree = null;
    this.selectedFldrNode = null;

    // Destroy and then recreate the element used to instantiate Fancytree,
    // so that we start fresh when the dialog is invoked again.
    $("#move-to-fldr-tree").children().remove();
    let parentElt = $("#move-to-fldr-tree").parent();
    parentElt.children("#move-to-fldr-tree").remove();
    $('<div id="move-to-fldr-tree"></div>').insertAfter("#activate-move-to-fldr-tree");
  };

  gDialog.moveTo.onFirstInit = function ()
  {
    $("#copy-instead-of-move").on("click", aEvent => {
      if (aEvent.target.checked) {
        if (aeClippingsTree.getTree().activeNode.folder) {
          $("#move-to-label").text(browser.i18n.getMessage("labelCopyFolder"));
        }
        else {
          $("#move-to-label").text(browser.i18n.getMessage("labelCopyClipping"));
        }
        $("#move-dlg-action-btn").text(browser.i18n.getMessage("btnCopy"));

        // Clear any error messages since copying to same folder is allowed.
        $("#move-error").text('');
      }
      else {
        if (aeClippingsTree.getTree().activeNode.folder) {
          $("#move-to-label").text(browser.i18n.getMessage("labelMoveFolder"));
        }
        else {
          $("#move-to-label").text(browser.i18n.getMessage("labelMoveClipping"));
        }
        $("#move-dlg-action-btn").text(browser.i18n.getMessage("btnMove"));
      }
    });
  };

  gDialog.moveTo.onInit = function ()
  {    
    if (this.fldrTree) {
      this.fldrTree.getTree().getNodeByKey(Number(aeConst.ROOT_FOLDER_ID).toString()).setActive();
    }
    else {
      let hideSyncFldr = gPrefs.isSyncReadOnly && !gPrefs.cxtMenuSyncItemsOnly;
      this.fldrTree = new aeFolderPicker(
        "#move-to-fldr-tree",
        gClippingsDB,
        aeConst.ROOT_FOLDER_ID,
        browser.i18n.getMessage("rootFldrName"),
        aeFolderPicker.ROOT_FOLDER_CLS,
        null,
        hideSyncFldr
      );

      // Attach event handler every time the folder tree is regenerated.
      this.find("#move-to-fldr-tree").on("click", aEvent => {
        log("Clippings::pg.js: gDialog.moveTo: Detected 'click' event in the folder tree");
        $("#move-error").text('');
      });
    }

    // Workaround to allow keyboard navigation into the folder tree list.
    $("#activate-move-to-fldr-tree").on("focus", aEvent => {
      try {
        this.fldrTree.getContainer().focus();
      }
      catch (e) {
        // Ignore thrown exception; it still works.  
      }
    });

    let activeNode = aeClippingsTree.getTree().activeNode;
    let nodeID = parseInt(activeNode.key);
    let isSyncedItem;

    if (activeNode.folder) {
      $("#move-to-label").text(browser.i18n.getMessage("labelMoveFolder"));
      isSyncedItem = gSyncedItemsIDs.has(nodeID + "F");
    }
    else {
      $("#move-to-label").text(browser.i18n.getMessage("labelMoveClipping"));
      isSyncedItem = gSyncedItemsIDs.has(nodeID + "C");
    }

    // Only allow copying a clipping or folder out of Synced Clippings folder
    // if sync file is read-only.
    if (gPrefs.syncClippings && gPrefs.isSyncReadOnly && isSyncedItem) {
      $("#copy-instead-of-move").trigger("click").prop("disabled", true);
    }
  };

  gDialog.moveTo.onCancel = function (aEvent)
  {
    this.resetTree();
    this.close();
  };

  gDialog.moveTo.onAccept = function (aEvent)
  {
    let clippingsMgrTree = aeClippingsTree.getTree();
    let selectedNode = clippingsMgrTree.activeNode;
    let id = parseInt(selectedNode.key);
    let parentNode = selectedNode.getParent();

    this.selectedFldrNode = this.fldrTree.getTree().activeNode;

    let parentFolderID = (parentNode.isRootNode() ? aeConst.ROOT_FOLDER_ID : parseInt(parentNode.key));
    let destFolderID = parseInt(this.selectedFldrNode.key);

    log(`clippingsMgr.js: Move To dialog: ID of selected item: ${id}; it is ${selectedNode.isFolder()} that the selected item in the clippings tree is a folder; current parent of selected item: ${parentFolderID}; move or copy to folder ID: ${destFolderID}`);
    
    // Don't allow moving/copying to Synced Clippings folder if the sync file
    // is read-only.
    if (gSyncedItemsIDs.has(destFolderID + "F") && gPrefs.isSyncReadOnly) {
      $("#move-error").text(browser.i18n.getMessage("syncFldrRdOnly"));
      return;
    }

    let makeCopy = $("#copy-instead-of-move").prop("checked");

    if (parentFolderID == destFolderID && !makeCopy) {
      $("#move-error").text(browser.i18n.getMessage("errMoveToSameParent"));
      return;
    }

    // Handle case where selected folder and destination folder are the same.
    if (selectedNode.isFolder() && id == destFolderID) {
      $("#move-error").text(browser.i18n.getMessage("errMoveToSubfldr"));
      return;
    }

    // Prevent infinite recursion when moving or copying a folder into one of
    // its subfolders.
    if (this.selectedFldrNode.isFolder()) {
      let parentNode, parentID;
      parentNode = this.selectedFldrNode.getParent();
      parentID = parentNode.isRootNode() ? aeConst.ROOT_FOLDER_ID : parseInt(parentNode.key);

      while (parentID != aeConst.ROOT_FOLDER_ID) {
        if (parentID == id) {
          $("#move-error").text(browser.i18n.getMessage("errMoveToSubfldr"));
          return;
        }
        parentNode = parentNode.getParent();
        parentID = parentNode.isRootNode() ? aeConst.ROOT_FOLDER_ID : parseInt(parentNode.key);
      }
    }

    if (selectedNode.isFolder()) {
      if (makeCopy) {
        gCmd.copyFolderIntrl(id, destFolderID, gCmd.UNDO_STACK);
      }
      else {
        gCmd.moveFolderIntrl(id, destFolderID, gCmd.UNDO_STACK);
      }
    }
    else {
      if (makeCopy) {
        gCmd.copyClippingIntrl(id, destFolderID, gCmd.UNDO_STACK);
      }
      else {
        gCmd.moveClippingIntrl(id, destFolderID, gCmd.UNDO_STACK);
      }
    }

    this.resetTree();
    this.close();
  };

  gDialog.moveTo.onUnload = function ()
  {
    $("#copy-instead-of-move").prop("checked", false).prop("disabled", false);
    $("#move-dlg-action-btn").text(browser.i18n.getMessage("btnMove"));
    $("#move-error").text('');
  };

  gDialog.showOnlySyncedItemsReminder = new aeDialog("#show-only-synced-items-reminder");
  gDialog.showOnlySyncedItemsReminder.isDelayedOpen = false;
  
  gDialog.showOnlySyncedItemsReminder.onShow = function ()
  {
    aePrefs.setPrefs({clippingsMgrShowSyncItemsOnlyRem: false});
    setTimeout(() => {
      let acceptBtn = $("#show-only-synced-items-reminder > .dlg-btns > .dlg-accept")[0];
      acceptBtn.focus();
    }, 100);
  };

  gDialog.syncProgress = new aeDialog("#sync-progress");
  gDialog.syncFldrFull = new aeDialog("#sync-fldr-full-error-msgbox");
  gDialog.syncFldrReadOnly = new aeDialog("#sync-file-readonly-msgbar");
  gDialog.miniHelp = new aeDialog("#mini-help-dlg");
  gDialog.genericMsgBox = new aeDialog("#generic-msg-box");
}


function buildClippingsTree()
{
  let treeData = [];
  
  aeClippingsTree.build(aeConst.ROOT_FOLDER_ID, gPrefs).then(aTreeData => {
    if (aTreeData.length == 0) {
      treeData = setEmptyClippingsState();
    }
    else {
      treeData = aTreeData;
    }

    $("#clippings-tree").fancytree({
      extensions: ["dnd5", "filter"],

      debugLevel: 0,
      autoScroll: true,
      source: treeData,
      selectMode: 1,
      strings: { noData: browser.i18n.getMessage("clipMgrNoItems") },
      icon: (gIsClippingsTreeEmpty ? false : true),

      init: function (aEvent, aData) {
        let rootNode = aData.tree.getRootNode();
        if (rootNode.children.length > 0 && !gIsClippingsTreeEmpty) {
          rootNode.children[0].setActive();
        }
      },

      activate: function (aEvent, aData) {
        log("Clippings/wx::pg.js: Activate event fired on clippings tree");
        updateDisplay(aEvent, aData);
      },

      async dblclick(aEvent, aData) {
        log("Clippings/wx::pg.js: Double-click event fired on clippings tree");
        updateDisplay(aEvent, aData);

        if (aData.targetType == "title" || aData.targetType == "icon") {
          if (! aData.node.isFolder()) {
            let clippingID = parseInt(aData.node.key);
            gCmd.pasteClipping(clippingID);
          }
        }
      },

      dnd5: {
        autoExpandMS: 1000,
        preventRecursion: true,
        preventVoidMoves: true,
        scroll: true,

        dragStart: function (aNode, aData) {
          // Prevent drag 'n drop out of Synced Clippings folder if sync file
          // is read-only.
          let nodeID = parseInt(aNode.key);
          let isSyncedItem = gSyncedItemsIDs.has(nodeID + (aNode.folder ? "F" : "C"));
          if (gPrefs.syncClippings && gPrefs.isSyncReadOnly && isSyncedItem) {
            return false;
          }
          
          gReorderedTreeNodeNextSibling = aNode.getNextSibling();
          return true;
        },

        dragEnd: function (aNode, aData) {
          gReorderedTreeNodeNextSibling = null;
        },

        dragEnter: function (aNode, aData) {
          if (! aNode.isFolder()) {
            // Prevent attempt to drop a node into a non-folder node; in such a
            // case, only allow reordering of nodes.
            return ["before", "after"];
          }
          
          aData.dataTransfer.dropEffect = "move";
          return true;
        },

        async dragDrop(aNode, aData)
        {
          if (gIsClippingsTreeEmpty) {
            return;
          }

          // Prevent dropping into a non-folder node.
          if (!aNode.isFolder() && aData.hitMode == "over") {
            return;
          }

          function getStaticID(aSyncedItemID)
          {
            let rv;
            if (gPrefs.syncClippings) {
              for (let [key, value] of gSyncedItemsIDMap) {
                if (value == aSyncedItemID) {
                  rv = key;
                  break;
                }
              }
            }
            return rv;
          }
          // END nested function

          let parentNode = aNode.getParent();
          
          if (aData.otherNode) {           
            let newParentID = aeConst.ROOT_FOLDER_ID;

            if (aNode.isFolder() && aData.hitMode == "over") {
              newParentID = parseInt(aNode.key);
            }
            else {
              if (parentNode.isRootNode()) {
                newParentID = aeConst.ROOT_FOLDER_ID;
              }
              else {
                newParentID = parseInt(parentNode.key);
              }
            }

            let oldParentID;
            if (aData.otherNode.getParent().isRootNode()) {
              oldParentID = aeConst.ROOT_FOLDER_ID;
            }
            else {
              oldParentID = parseInt(aData.otherNode.getParent().key);
            }

            let id = parseInt(aData.otherNode.key);

            if (gPrefs.syncClippings && aData.otherNode.isFolder() && id == gPrefs.syncFolderID
                && newParentID != aeConst.ROOT_FOLDER_ID) {
              warn("The Synced Clippings folder cannot be moved.");
              return;
            }

            // Prevent drag 'n drop into Synced Clippings folder if sync file
            // is read-only.
            if (gPrefs.syncClippings && gPrefs.isSyncReadOnly
                && gSyncedItemsIDs.has(newParentID + "F")) {
              setTimeout(() => { gDialog.syncFldrReadOnly.openPopup() }, 100);
              return;
            }

            await browser.runtime.sendMessage({msgID: "dnd-move-started"});

            aData.otherNode.moveTo(aNode, aData.hitMode);
            
            log(`Clippings/wx::clippingsMgr.js::#clippings-tree.dnd5.dragDrop(): ID of moved clipping or folder: ${id}\nID of old parent folder: ${oldParentID}\nID of new parent folder: ${newParentID}`);

            let isReordering = false;

            if (newParentID == oldParentID) {
              log(`It appears that the node (key = ${aData.otherNode.key}) was just reordered, as it was moved within the same folder. Rebuilding Clippings context menu.`);
              isReordering = true;
            }
            else {
              // The following `gCmd` method calls will trigger rebuild of the
              // Clippings context menu, which will be suppressed by the
              // background script.
              if (aData.otherNode.isFolder()) {
                await gCmd.moveFolderIntrl(id, newParentID, gCmd.UNDO_STACK);
              }
              else {
                await gCmd.moveClippingIntrl(id, newParentID, gCmd.UNDO_STACK);
              }
            }

            log("Clippings/wx::pg.js::#clippings-tree.dnd5.dragDrop(): Updating display order");
            let destUndoStack = null;
            let undoInfo = null;
            
            if (isReordering) {
              let nextSiblingNode = gReorderedTreeNodeNextSibling;
              destUndoStack = gCmd.UNDO_STACK;
              
              undoInfo = {
                action: gCmd.ACTION_CHANGEPOSITION,
                id: parseInt(aData.otherNode.key),
                nodeKey: aData.otherNode.key,
                parentFolderID: newParentID,
                itemType: (aNode.folder ? gCmd.ITEMTYPE_FOLDER : gCmd.ITEMTYPE_CLIPPING),
                nextSiblingNodeKey: (nextSiblingNode ? nextSiblingNode.key : null),
              };

              if (gPrefs.syncClippings) {
                let sfx = aData.otherNode.isFolder() ? "F" : "C";
                let syncedNodeKey = `${undoInfo.id}${sfx}`;
                
                if (gSyncedItemsIDs.has(syncedNodeKey)) {
                  undoInfo.sid = getStaticID(syncedNodeKey);
                  if (nextSiblingNode) {
                    undoInfo.nextSiblingSID = getStaticID(undoInfo.nextSiblingNodeKey);
                  }
                  if (newParentID != gPrefs.syncFolderID && gSyncedItemsIDs.has(`${newParentID}F`)) {
                    undoInfo.parentFldrSID = getStaticID(`${newParentID}F`);
                  }
                }
              }
              
              log("Clippings/wx::pg.js: Saving undo info for clipping/folder reordering:");
              log(undoInfo);
            }
            
            await browser.runtime.sendMessage({msgID: "dnd-move-finished"});

            // Rebuild Clippings context menu only once.
            await gCmd.updateDisplayOrder(oldParentID, destUndoStack, undoInfo, !isReordering);
            if (!isReordering) {
              await gCmd.updateDisplayOrder(newParentID, null, null, false);
            }

            if (newParentID != oldParentID) {
              aNode.setExpanded();
            }
          }
          else {
            // Dropping a non-node.
            let dndData = aData.dataTransfer.getData("text");

            if (! dndData) {
              log("Clippings/wx::pg.js: #clippings-tree.dnd5.dragDrop(): Non-node was dropped into tree.  Unable to process its data; ignoring.");
              return;
            }
            
            log("Clippings/wx::pg.js: #clippings-tree.dnd5.dragDrop(): Non-node was dropped into tree.  Textual content detected.");
            
            aData.dataTransfer.effect = "copy";

            let parentID = aeConst.ROOT_FOLDER_ID;
            if (aNode.isFolder() && aData.hitMode == "over") {
              parentID = parseInt(aNode.key);
            }
            else {
              parentID = parentNode.isRootNode() ? aeConst.ROOT_FOLDER_ID : parseInt(parentNode.key);
            }

            let clipName = aeClippings.createClippingNameFromText(dndData);
            let clipContent = dndData;

            gCmd.newClippingWithContent(parentID, clipName, clipContent, gCmd.UNDO_STACK);
	    
            if (aNode.isFolder()) {
              aNode.setExpanded();
            }
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

    setStatusBarMsg(gIsClippingsTreeEmpty ? browser.i18n.getMessage("clipMgrStatusBar", "0") : null);

    // Context menu for the clippings tree.
    $.contextMenu({
      selector: "#clippings-tree > ul.ui-fancytree > li",
      className: "clippings-tree-cxt-menu",

      events: {
        activated(aOpts) {
          let mnu = aOpts.$menu;
          mnu[0].focus();  
        },
        
        show(aOpts) {
          let treeItemSpan = aOpts.$trigger[0].firstChild;
          if (treeItemSpan.classList.contains("fancytree-statusnode-nodata")) {
            // Hide the context menu if "No items found" in the search results
            // is selected.
            return false;
          }
          return (! gIsClippingsTreeEmpty);
        }
      },
      
      callback: function (aItemKey, aOpt, aRootMenu, aOriginalEvent) {
        function setLabel(aLabel) {
          let tree = aeClippingsTree.getTree();
          let selectedNode = tree.activeNode;
          if (!selectedNode || selectedNode.isFolder()) {
            return;
          }

          let clippingID = parseInt(selectedNode.key);
          gCmd.setLabelIntrl(clippingID, aLabel, gCmd.UNDO_STACK);
        }
        
        switch (aItemKey) {
	case "reloadSyncFolder":
	  gCmd.reloadSyncFolder();
	  break;
	  
        case "moveOrCopy":
          gCmd.moveClippingOrFolder();
          break;
          
        case "deleteItem":
          gCmd.deleteClippingOrFolder(gCmd.UNDO_STACK);
          break;
          
        case "gotoSrcURL":
          gCmd.openWebPageSourceURL();
          break;

        case "labelNone":
          setLabel("");
          break;
          
        case "labelRed":
        case "labelOrange":
        case "labelYellow":
        case "labelGreen":
        case "labelBlue":
        case "labelPurple":
        case "labelGrey":
          setLabel(aItemKey.substr(5).toLowerCase());
          break;

        case "insertSeparator":
        gCmd.insertSeparator(gCmd.UNDO_STACK);
        break;

        case "copyClippingText":
          gCmd.copyClippingTextToClipboard();
          break;

        default:
          window.alert("The selected action is not available right now.");
          break;
        }
      },
      
      items: {
        reloadSyncFolder: {
          name: browser.i18n.getMessage("mnuReloadSyncFldr"),
          className: "ae-menuitem",
          visible: function (aItemKey, aOpt) {
            let tree = aeClippingsTree.getTree();
            let selectedNode = tree.activeNode;
            
            if (!selectedNode || !selectedNode.isFolder()) {
              return false;
            }

            let folderID = parseInt(selectedNode.key);
            return (folderID == gPrefs.syncFolderID);
          }
        },

        moveOrCopy: {
          name: browser.i18n.getMessage("mnuMoveOrCopy"),
          className: "ae-menuitem",
          disabled: function (aKey, aOpt) {
            let tree = aeClippingsTree.getTree();
            let selectedNode = tree.activeNode;

            if (! selectedNode) {
              return false;
            }

            if (aeClippingsTree.isSeparatorSelected()) {
              return true;
            }

            let folderID = parseInt(selectedNode.key);
            return (selectedNode.isFolder() && folderID == gPrefs.syncFolderID);
          }
        },
        gotoSrcURL: {
          name: browser.i18n.getMessage("mnuGoToSrcURL"),
          className: "ae-menuitem",
          visible: function (aItemKey, aOpt) {
            return (!aeClippingsTree.isFolderSelected() && !aeClippingsTree.isSeparatorSelected());
          }
        },
        labelSubmenu: {
          name: browser.i18n.getMessage("mnuEditLabel"),
          visible: function (aItemKey, aOpt) {
            return (!aeClippingsTree.isFolderSelected() && !aeClippingsTree.isSeparatorSelected());
          },
          items: {
            labelNone: {
              name: browser.i18n.getMessage("none"),
              className: "ae-menuitem",
              icon: function (aOpt, $itemElement, aItemKey, aItem) {
                if (gClippingLabelPicker.selectedLabel == "") {
                  return "context-menu-icon-checked";
                }
              },
              disabled(aKey, aOpt) {
                let selectedNode = aeClippingsTree.getTree().activeNode;
                if (! selectedNode) {
                  return false;
                }
                return isReadOnlySyncedItem(selectedNode);
              },
            },
            labelRed: {
              name: browser.i18n.getMessage("labelRed"),
              className: "ae-menuitem clipping-label-red",
              icon: function (aOpt, $itemElement, aItemKey, aItem) {
                if (gClippingLabelPicker.selectedLabel == aItemKey.substr(5).toLowerCase()) {
                  return "context-menu-icon-checked";
                }
              },
              disabled(aKey, aOpt) {
                let selectedNode = aeClippingsTree.getTree().activeNode;
                if (! selectedNode) {
                  return false;
                }
                return isReadOnlySyncedItem(selectedNode);
              },
            },
            labelOrange: {
              name: browser.i18n.getMessage("labelOrange"),
              className: "ae-menuitem clipping-label-orange",
              icon: function (aOpt, $itemElement, aItemKey, aItem) {
                if (gClippingLabelPicker.selectedLabel == aItemKey.substr(5).toLowerCase()) {
                  return "context-menu-icon-checked";
                }
              },
              disabled(aKey, aOpt) {
                let selectedNode = aeClippingsTree.getTree().activeNode;
                if (! selectedNode) {
                  return false;
                }
                return isReadOnlySyncedItem(selectedNode);
              },
            },
            labelYellow: {
              name: browser.i18n.getMessage("labelYellow"),
              className: "ae-menuitem clipping-label-yellow",
              icon: function (aOpt, $itemElement, aItemKey, aItem) {
                if (gClippingLabelPicker.selectedLabel == aItemKey.substr(5).toLowerCase()) {
                  return "context-menu-icon-checked";
                }
              },
              disabled(aKey, aOpt) {
                let selectedNode = aeClippingsTree.getTree().activeNode;
                if (! selectedNode) {
                  return false;
                }
                return isReadOnlySyncedItem(selectedNode);
              },
            },
            labelGreen: {
              name: browser.i18n.getMessage("labelGreen"),
              className: "ae-menuitem clipping-label-green",
              icon: function (aOpt, $itemElement, aItemKey, aItem) {
                if (gClippingLabelPicker.selectedLabel == aItemKey.substr(5).toLowerCase()) {
                  return "context-menu-icon-checked";
                }
              },
              disabled(aKey, aOpt) {
                let selectedNode = aeClippingsTree.getTree().activeNode;
                if (! selectedNode) {
                  return false;
                }
                return isReadOnlySyncedItem(selectedNode);
              },
            },
            labelBlue: {
              name: browser.i18n.getMessage("labelBlue"),
              className: "ae-menuitem clipping-label-blue",
              icon: function (aOpt, $itemElement, aItemKey, aItem) {
                if (gClippingLabelPicker.selectedLabel == aItemKey.substr(5).toLowerCase()) {
                  return "context-menu-icon-checked";
                }
              },
              disabled(aKey, aOpt) {
                let selectedNode = aeClippingsTree.getTree().activeNode;
                if (! selectedNode) {
                  return false;
                }
                return isReadOnlySyncedItem(selectedNode);
              },
            },
            labelPurple: {
              name: browser.i18n.getMessage("labelPurple"),
              className: "ae-menuitem clipping-label-purple",
              icon: function (aOpt, $itemElement, aItemKey, aItem) {
                if (gClippingLabelPicker.selectedLabel == aItemKey.substr(5).toLowerCase()) {
                  return "context-menu-icon-checked";
                }
              },
              disabled(aKey, aOpt) {
                let selectedNode = aeClippingsTree.getTree().activeNode;
                if (! selectedNode) {
                  return false;
                }
                return isReadOnlySyncedItem(selectedNode);
              },
            },
            labelGrey: {
              name: browser.i18n.getMessage("labelGrey"),
              className: "ae-menuitem clipping-label-grey",
              icon: function (aOpt, $itemElement, aItemKey, aItem) {
                if (gClippingLabelPicker.selectedLabel == aItemKey.substr(5).toLowerCase()) {
                  return "context-menu-icon-checked";
                }
              },
              disabled(aKey, aOpt) {
                let selectedNode = aeClippingsTree.getTree().activeNode;
                if (! selectedNode) {
                  return false;
                }
                return isReadOnlySyncedItem(selectedNode);
              },
            },
          }
        },
        copyClippingTextSeparator: {
          type: "cm_separator",
          visible(aItemKey, aOpt) {
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
        insertSeparator: {
          name: browser.i18n.getMessage("mnuInsSeparator"),
          className: "ae-menuitem",
          disabled(aKey, aOpt) {
            let tree = aeClippingsTree.getTree();
            let selectedNode = tree.activeNode;
            if (! selectedNode) {
              return false;
            }
            if (isReadOnlySyncedItem(selectedNode)) {
              return true;
            }
            if (aeClippingsTree.isSeparatorSelected()) {
              return true;
            }
          }
        },
        separator0: "--------",
        deleteItem: {
          name: browser.i18n.getMessage("tbDelete"),
          className: "ae-menuitem",
          disabled: function (aKey, aOpt) {
            let tree = aeClippingsTree.getTree();
            let selectedNode = tree.activeNode;
            if (! selectedNode) {
              return false;
            }
            if (isReadOnlySyncedItem(selectedNode)) {
              return true;
            }

            let folderID = parseInt(selectedNode.key);
            return (selectedNode.isFolder() && folderID == gPrefs.syncFolderID);
          }
        }
      }
    });

    aeInterxn.initContextMenuAriaRoles(".clippings-tree-cxt-menu");

    if (gPrefs.syncClippings) {
      initSyncedClippingsTree();
    }

  }).catch(aErr => {
    console.error("pg.js::buildClippingsTree(): %s", aErr.message);
    showInitError();
  });
}


function isReadOnlySyncedItem(aTreeNode)
{
  let rv = false;
  if (! gPrefs.syncClippings) {
    return rv;
  }

  let nodeID = parseInt(aTreeNode.key);
  let isSyncedItem = gSyncedItemsIDs.has(nodeID + (aTreeNode.folder ? "F" : "C"));
  
  rv = (gPrefs.isSyncReadOnly && isSyncedItem);
  
  return rv;
}


async function rebuildClippingsTree()
{
  let tree = aeClippingsTree.getTree();
  let treeData = [];

  aeClippingsTree.build(aeConst.ROOT_FOLDER_ID, gPrefs).then(aTreeData => {
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
      gCmd.updateDisplayOrder(aeConst.ROOT_FOLDER_ID, null, null, true);
    }

    if (gPrefs.syncClippings) {
      gSyncedItemsIDs.clear();
      initSyncItemsIDLookupList();
      initSyncedClippingsTree();

      if (gPrefs.cxtMenuSyncItemsOnly) {
        if (gPrefs.clippingsMgrShowSyncItemsOnlyRem) {
          if (aeDialog.isOpen()) {
            gDialog.showOnlySyncedItemsReminder.isDelayedOpen = true;
          }
          else {
            gDialog.showOnlySyncedItemsReminder.showModal();
          }
        }
      }
      else {
        $("#clippings-tree").removeClass("cxt-menu-show-sync-items-only");
      }
    }
    
    return Promise.resolve(aTreeData);
  });
}


function initSyncedClippingsTree()
{
  gReloadSyncFldrBtn.show();
  $(".ae-synced-clippings-fldr").parent().addClass("ae-synced-clippings");

  if (gPrefs.cxtMenuSyncItemsOnly) {
    $("#clippings-tree").addClass("cxt-menu-show-sync-items-only");
  }
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
      if (gCmd.undoStack.length > 0) {
        gCmd.undoStack.refreshSyncedItems();
      }
      if (gCmd.redoStack.length > 0) {
        gCmd.redoStack.refreshSyncedItems();
      }
      
      aFnResolve();
    }).catch(aErr => {
      aFnReject(aErr);
    });
  });
}


function initTreeSplitter()
{
  // Adapted from https://codepen.io/lingtalfi/pen/zoNeJp
  // Requires Simple Drag library: https://github.com/lingtalfi/simpledrag
  var leftPane = document.getElementById("clippings-tree");
  var rightPane = document.getElementById("item-properties");
  var paneSep = document.getElementById("tree-splitter");

  // The script below constrains the target to move horizontally between a left and a right
  // virtual boundaries.
  // - the left limit is positioned at 10% of the screen width
  // - the right limit is positioned at 60% of the screen width
  var leftLimit = 10;
  var rightLimit = 60;

  paneSep.sdrag(function (el, pageX, startX, pageY, startY, fix) {

    fix.skipX = true;

    if (pageX < window.innerWidth * leftLimit / 100) {
      pageX = window.innerWidth * leftLimit / 100;
      fix.pageX = pageX;
    }
    if (pageX > window.innerWidth * rightLimit / 100) {
      pageX = window.innerWidth * rightLimit / 100;
      fix.pageX = pageX;
    }

    var cur = pageX / window.innerWidth * 100;
    if (cur < 0) {
      cur = 0;
    }
    if (cur > window.innerWidth) {
      cur = window.innerWidth;
    }


    var right = (100-cur-2);
    leftPane.style.width = cur + '%';
    rightPane.style.width = right + '%';

  }, null, 'horizontal');
}


function setEmptyClippingsState()
{
  let rv = [
    {title: browser.i18n.getMessage("clipMgrNoItems"), key: "0"}
  ];
  gIsClippingsTreeEmpty = true;
  $("#move, #delete").prop("disabled", true);
  $("#clipping-name, #clipping-text, #placeholder-toolbar, #source-url-bar, #options-bar").hide();
  $("#intro-content").show();
  
  return rv;
}


function unsetEmptyClippingsState()
{
  let tree = aeClippingsTree.getTree();
  let emptyMsgNode = tree.getNodeByKey("0");
  emptyMsgNode.remove();
  tree.options.icon = true;
  gIsClippingsTreeEmpty = false;
  $("#intro-content").hide();
  $("#clipping-name, #clipping-text").show();

  if (gPrefs.clippingsMgrDetailsPane) {
    $("#source-url-bar, #options-bar").show();
  }
  if (gPrefs.clippingsMgrPlchldrToolbar) {
    $("#placeholder-toolbar").show();
  }
}


function initShortcutKeyMenu()
{
  $("#clipping-key").change(aEvent => {
    let shortcutKeyMenu = aEvent.target;
    let shortcutKey = "";
    
    if (shortcutKeyMenu.selectedIndex != 0) {
      shortcutKey = shortcutKeyMenu.options[shortcutKeyMenu.selectedIndex].text;
    }

    // Check if the shortcut key is already assigned.
    let assignedKeysLookup = {};
    gClippingsDB.clippings.where("shortcutKey").notEqual("").each((aItem, aCursor) => {
      assignedKeysLookup[aItem.shortcutKey] = 1;
    }).then(() => {
      if (assignedKeysLookup[shortcutKey]) {
        gDialog.shctKeyConflict.showModal();
        return;
      }

      let selectedNode = aeClippingsTree.getTree().getActiveNode();
      if (! selectedNode) {
        console.warn("Can't set shortcut key if there is no clipping selected.");
        return;
      }

      let clippingID = parseInt(selectedNode.key);
      gClippingsSvc.updateClipping(clippingID, { shortcutKey });
    });
  });
}


function updateDisplay(aEvent, aData)
{
  if (gIsClippingsTreeEmpty) {
    $("#move, #delete").prop("disabled", true);
    $("#source-url-bar, #options-bar").hide();
    setStatusBarMsg(browser.i18n.getMessage("clipMgrStatusBar", "0"));
    return;
  }

  log("Clippings/wx::pg.js: Updating display...");

  if (gSearchBox.isActivated()) {
    gSearchBox.updateSearch();
    let numMatches = gSearchBox.getCountMatches();
    if (numMatches !== undefined) {
      setStatusBarMsg(browser.i18n.getMessage("numMatches", numMatches));
    }
  }
  else {
    setStatusBarMsg();
  }

  if (gSrcURLBar.isEditing()) {
    gSrcURLBar.cancelEdit();
  }
  
  let selectedItemID = parseInt(aData.node.key);

  if (aData.node.isFolder()) {
    $("#move, #delete, #clipping-name").prop("disabled", false);
    
    gClippingsDB.folders.get(selectedItemID).then(aResult => {
      $("#clipping-name").val(aResult.name);
      $("#clipping-text").val("").hide();

      $("#source-url-bar, #options-bar, #placeholder-toolbar").hide();
      $("#clipping-src-url").text("");
      let shortcutKeyMenu = $("#clipping-key")[0];
      shortcutKeyMenu.selectedIndex = 0;

      $("#item-properties").addClass("folder-only");

      if (gPrefs.syncClippings) {
        // Prevent moving, deleting or renaming of the Synced Clippings folder.
        // Also disable editing if this is a synced item and the sync data
        // is read-only.
        if (selectedItemID == gPrefs.syncFolderID) {
          $("#move, #delete, #clipping-name").prop("disabled", true);
        }
        else if (gSyncedItemsIDs.has(selectedItemID + "F") && gPrefs.isSyncReadOnly) {
          // Allow the Move/Copy toolbar button to be enabled, since copying
          // a read-only synced item is permitted.
          $("#delete, #clipping-name").prop("disabled", true);
        }
      }
      else {
        $("#move, #delete, #clipping-name").prop("disabled", false);
      }
    });
  }
  else {
    $("#item-properties").removeClass("folder-only");
    $(`#clipping-name, #clipping-text, #clipping-key, #clipping-label-picker,
       #edit-url-btn, #placeholder-toolbar > button`).prop("disabled", false);
    $("#options-bar label, #placeholder-toolbar label").removeAttr("disabled");
    
    gClippingsDB.clippings.get(selectedItemID).then(aResult => {
      $("#clipping-name").val(aResult.name);

      if (aResult.separator) {
        $("#move").prop("disabled", true);
        $("#delete").prop("disabled", false);
        $("#item-properties").addClass("folder-only");
        $("#clipping-name").prop("disabled", true);
        $("#clipping-text").val("").hide();
        $("#source-url-bar, #options-bar, #placeholder-toolbar").hide();
      }
      else {
        $("#move, #delete").prop("disabled", false);
        $("#clipping-text").val(aResult.content).show();

        if (gPrefs.clippingsMgrDetailsPane) {
          $("#source-url-bar, #options-bar").show();
        }

        if (gPrefs.clippingsMgrPlchldrToolbar) {
          $("#placeholder-toolbar").show();
        }

        if (aResult.sourceURL) {
          $("#clipping-src-url").html(sanitizeHTML(`<a href="${aResult.sourceURL}">${aResult.sourceURL}</a>`));
          $("#clipping-src-url > a").click(async (aEvent) => {
            aEvent.preventDefault();
            aeNavigator.gotoURL(aEvent.target.textContent);
          });
        }
        else {
          $("#clipping-src-url").text(browser.i18n.getMessage("none"));
        }
        
        let shortcutKeyMenu = $("#clipping-key")[0];
        shortcutKeyMenu.selectedIndex = 0;
        
        for (let i = 0; i < shortcutKeyMenu.options.length; i++) {
          if (shortcutKeyMenu[i].text == aResult.shortcutKey) {
            shortcutKeyMenu.selectedIndex = i;
            break;
          }
        }

        gClippingLabelPicker.selectedLabel = aResult.label;
      }

      // Disable editing if this is a synced item and the sync data is
      // read-only. But allow the Move/Copy toolbar button to be enabled,
      // since copying a read-only synced item is permitted.
      if (gSyncedItemsIDs.has(selectedItemID + "C") && gPrefs.isSyncReadOnly) {
        $("#delete").prop("disabled", true);
        $(`#clipping-name, #clipping-text, #clipping-key, #clipping-label-picker,
           #edit-url-btn, #placeholder-toolbar > button`).prop("disabled", true);
        $("#options-bar label, #placeholder-toolbar label").attr("disabled", "");
      }
    });
  }
}


function insertTextIntoTextbox(aTextboxElt, aInsertedText)
{
  let text, pre, post, pos;
  let textbox = aTextboxElt[0];
  
  text = textbox.value;

  if (textbox.selectionStart == textbox.selectionEnd) {
    var point = textbox.selectionStart;
    pre = text.substring(0, point);
    post = text.substring(point, text.length);
    pos = point + aInsertedText.length;
  }
  else {
    var p1 = textbox.selectionStart;
    var p2 = textbox.selectionEnd;
    pre = text.substring(0, p1);
    post = text.substring(p2, text.length);
    pos = p1 + aInsertedText.length;
  }

  textbox.value = pre + aInsertedText + post;
  textbox.selectionStart = pos;
  textbox.selectionEnd = pos;

  if (gPrefs.clippingsUnchanged) {
    aePrefs.setPrefs({ clippingsUnchanged: false });
  }
}


function recalcContentAreaHeight(aIsStatusBarVisible)
{
  let statusBarHgt = aIsStatusBarVisible ? "var(--statusbar-height)" : "0px";
  $("#content").css({ height: `calc(100% - var(--toolbar-height) - ${statusBarHgt})`});
}


function setStatusBarMsg(aMessage)
{
  if (aMessage) {
    $("#status-bar-msg").text(aMessage);
    return;
  }

  let tree = aeClippingsTree.getTree();
  $("#status-bar-msg").text(browser.i18n.getMessage("clipMgrStatusBar", tree.count()));
}


async function saveWindowGeometry()
{
  // Save the Clippings Manager tree width.
  let treeWidth = parseInt($("#clippings-tree").css("width"));
  if (treeWidth != gPrefs.clippingsMgrTreeWidth) {
    let clippingsMgrTreeWidth = treeWidth;
    await aePrefs.setPrefs({ clippingsMgrTreeWidth });
  }
  
  let scrWidth = window.screen.availWidth;
  
  // Stop saving window geometry if window is maximized, due to bugs/limitations
  // with detecting and getting geometry of maximized windows.
  if (window.outerWidth >= scrWidth) {
    warn("Clippings/wx::pg.js: saveWindowGeometry(): Not saving window geometry for maximized window.");
    return;
  }
  
  let savedWndGeom = gPrefs.clippingsMgrWndGeom;

  if (!savedWndGeom || savedWndGeom.w != window.outerWidth
      || savedWndGeom.h != window.outerHeight
      || savedWndGeom.x != window.screenX || savedWndGeom.y != window.screenY) {
    let clippingsMgrWndGeom = {
      w: window.outerWidth, h: window.outerHeight,
      x: window.screenX, y: window.screenY,
    };

    log("Clippings/wx::pg.js: saveWindowGeometry():");
    log(clippingsMgrWndGeom);

    await aePrefs.setPrefs({ clippingsMgrWndGeom });
  }
}


function setSaveWndGeometryInterval(aSaveWndGeom)
{
  if (aSaveWndGeom) {
    setSaveWndGeometryInterval.intvID = setInterval(async () => {
      await saveWindowGeometry();
    }, gPrefs.clippingsMgrSaveWndGeomIntv);    
  }
  else {
    if (!! setSaveWndGeometryInterval.intvID) {
      clearInterval(setSaveWndGeometryInterval.intvID);
      setSaveWndGeometryInterval.intvID = null;
    }
  }
}
setSaveWndGeometryInterval.intvID = null;


function closeWnd()
{
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}


function showBanner(aMessage)
{
  let bannerElt = $("#banner");
  let bannerMsgElt = $("#banner-msg");

  bannerMsgElt.children().remove();
  bannerMsgElt.text(aMessage);
  bannerElt.css("display", "block");
}


//
// DOM utility
//

function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, {SAFE_FOR_JQUERY: true});
}


//
// Error reporting and debugging output
//

function showInitError()
{
  let errorMsgBox = new aeDialog("#init-error-msgbox");
  errorMsgBox.onInit = function () {
    $("#init-error-msgbox > .dlg-content > .msgbox-error-msg").text(browser.i18n.getMessage("initError"));
  };
  errorMsgBox.onAccept = function () {
    closeWnd();
  };

  errorMsgBox.showModal();
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


function handlePushSyncItemsError(aError)
{
  if (!gErrorPushSyncItems) {
    // Show sync errors only once during the Clippings Manager session.
    // Pushing sync changes can happen numerous times, and repeated error
    // messages will annoy the user.
    let errorMsgBox = new aeDialog("#sync-error-msgbox");
    errorMsgBox.onInit = function () {
      this.find(".dlg-content > .msgbox-error-msg").text(browser.i18n.getMessage("syncPushFailed"));
    };
    errorMsgBox.showModal();
    gErrorPushSyncItems = true;
  }
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
