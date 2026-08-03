/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function clippingsMgrCmds()
{
  return {
    // IDs of undoStack actions
    ACTION_EDITNAME: 1,
    ACTION_EDITCONTENT: 2,
    ACTION_DELETECLIPPING: 3,
    ACTION_CREATENEW: 4,
    ACTION_CHANGEPOSITION: 5,
    ACTION_CREATENEWFOLDER: 6,
    ACTION_DELETEFOLDER: 7,
    ACTION_MOVETOFOLDER: 8,
    ACTION_COPYTOFOLDER: 9,
    ACTION_DELETEEMPTYFOLDER: 10,
    ACTION_SETSHORTCUTKEY: 11,
    ACTION_SETLABEL: 12,
    ACTION_SET_SRC_URL: 13,
    ACTION_REMOVE_ALL_SRC_URLS: 14,
    ACTION_BACKUP: 15,
    ACTION_RESTORE_BACKUP: 16,
    ACTION_IMPORT: 17,
    ACTION_EXPORT: 18,
    ACTION_RELOAD_SYNC_FLDR: 19,
    ACTION_INSERT_SEPARATOR: 20,

    // flags for aDestUndoStack parameter of functions for reversible actions
    UNDO_STACK: 1,
    REDO_STACK: 2,

    // Differentiate between clippings and folders, since they can have the same
    // ID in the database.
    ITEMTYPE_CLIPPING: 1,
    ITEMTYPE_FOLDER: 2,

    // Keep track of the most recent action.
    // This was previously required for the now-eliminated `onBatchChanges`
    // database event handler.
    _recentAction: null,

    undoStack: {
      length: 0,
      _stack: [],

      push(aState)
      {
        if (gPrefs.syncClippings) {
          if ([gCmd.ACTION_MOVETOFOLDER, gCmd.ACTION_COPYTOFOLDER,
            gCmd.ACTION_CREATENEW, gCmd.ACTION_CREATENEWFOLDER]
              .includes(aState.action)) {
            if ("sid" in aState) {
              if (! gSyncedItemsIDMap.has(aState.sid)) {
                delete aState.sid;
              }
            }
            else {
              // Add static ID if it is a synced item.
              let sfx = "";
              if (aState.itemType == gCmd.ITEMTYPE_CLIPPING) {
                sfx = "C";
              }
              else if (aState.itemType == gCmd.ITEMTYPE_FOLDER) {
                sfx = "F";
              }

              for (let [key, value] of gSyncedItemsIDMap) {
                if (value == `${aState.id}${sfx}`) {
                  aState.sid = key;
                  break;
                }
              }
            }
          }
          else if (aState.action == gCmd.ACTION_MOVETOFOLDER) {
            if (! ("newParentFldrSID" in aState)) {
              let isNewParentFldrSynced = false;
              for (let [key, value] of gSyncedItemsIDMap) {
                if (value == `${aState.newParentFldrID}F`) {
                  aState.newParentFldrSID = key;
                  isNewParentFldrSynced = true;
                  break;
                }
              }
              // Remote static ID on the item if it wasn't moved to a
              // synced folder.
              if (!isNewParentFldrSynced && aState.newParentFldrID != gPrefs.syncFolderID) {
                delete aState.sid;
              }
            }
            if (! ("oldParentFldrSID" in aState)) {
              for (let [key, value] of gSyncedItemsIDMap) {
                if (value == `${aState.oldParentFldrID}F`) {
                  aState.oldParentFldrSID = key;
                  break;
                }
              }
            }
          }
          else if ([gCmd.ACTION_DELETECLIPPING, gCmd.ACTION_DELETEFOLDER].includes(aState.action)) {
            // The static ID of a synced item is no longer needed because it is
            // moved to the hidden deleted items folder.
            delete aState.sid;
          }
          else if (aState.action == gCmd.ACTION_CHANGEPOSITION) {
            if (aState.nextSiblingNodeKey) {
              if (! ("nextSiblingSID" in aState)) {
                for (let [key, value] of gSyncedItemsIDMap) {
                  if (value == aState.nextSiblingNodeKey) {
                    aState.nextSiblingSID = key;
                    break;
                  }
                }
              }
            }
            else {
              delete aState.nextSiblingSID;
            }
          }
        }

        this._stack.push(aState);
        this.length++;
      },

      pop() {
        var rv = this._stack.pop();
        this.length--;
        return rv;
      },

      getLastItem() {
        let rv = null;

        if (this.length > 0) {
          rv = this._stack[this.length - 1];
        }
        return rv;
      },

      clear() {
        this._stack = [];
        this.length = 0;
      },

      refreshSyncedItems()
      {
        if (! gPrefs.syncClippings) {
          return;
        }

        for (let item of this._stack) {
          if ("sid" in item) {
            let xid = gSyncedItemsIDMap.get(item.sid);
            item.id = parseInt(xid);
            if ("nodeKey" in item) {
              item.nodeKey = xid;
            }
          }
          if ("parentFldrSID" in item) {
            let xpfid = gSyncedItemsIDMap.get(item.parentFldrSID);
            if ("parentFolderID" in item) {
              item.parentFolderID = parseInt(xpfid);
            }
            else {
              item.parentFldrID = parseInt(xpfid);
            }
          }
          if ("oldParentFldrSID" in item) {
            let xopfid = gSyncedItemsIDMap.get(item.oldParentFldrSID);
            item.oldParentFldrID = parseInt(xopfid);
          }
          if ("newParentFldrSID" in item) {
            let xnpfid = gSyncedItemsIDMap.get(item.newParentFldrSID);
            item.newParentFldrID = parseInt(xnpfid);
          }
          if ("destFldrSID" in item) {
            let xdfid = gSyncedItemsIDMap.get(item.destFldrSID);
            item.destFldrID = parseInt(xdfid);
          }
          if ("nextSiblingSID" in item) {
            item.nextSiblingNodeKey = gSyncedItemsIDMap.get(item.nextSiblingSID);
          }

          if (item.action == gCmd.ACTION_REMOVE_ALL_SRC_URLS) {
            item.clippingsWithSrcURLs.forEach(aClipping => {
              // Update IDs of synced clippings whose source URLs were removed.
              if ("sid" in aClipping) {
                let xid = gSyncedItemsIDMap.get(aClipping.sid);
                if (xid) {
                  aClipping.id = parseInt(xid);
                }
                else {
                  delete aClipping.sid;
                }
              }
            });
          }
        };
      }
    },

    // Redo - only 1 undo action is reversible
    redoStack: {
      length: 0,
      _lastUndo: null,

      push(aState)
      {
        if (gPrefs.syncClippings) {
          if ([gCmd.ACTION_DELETECLIPPING, gCmd.ACTION_DELETEFOLDER,
            gCmd.ACTION_MOVETOFOLDER].includes(aState.action)) {
            if ("sid" in aState) {
              if (! gSyncedItemsIDMap.has(aState.sid)) {
                delete aState.sid;
              }
            }
            else {
              let sfx = "";
              if (aState.itemType == gCmd.ITEMTYPE_CLIPPING) {
                sfx = "C";
              }
              else if (aState.itemType == gCmd.ITEMTYPE_FOLDER) {
                sfx = "F";
              }

              for (let [key, value] of gSyncedItemsIDMap) {
                if (value == `${aState.id}${sfx}`) {
                  aState.sid = key;
                  break;
                }
              }
            }
          }
          else if ([gCmd.ACTION_COPYTOFOLDER, gCmd.ACTION_CREATENEW, gCmd.ACTION_CREATENEWFOLDER]
              .includes(aState.action)) {
            // The static ID of a synced item is no longer needed because it is
            // moved to the hidden deleted items folder.
            delete aState.sid;
          }
          else if (aState.action == gCmd.ACTION_CHANGEPOSITION) {
            if (aState.nextSiblingNodeKey) {
              if (! ("nextSiblingSID" in aState)) {
                for (let [key, value] of gSyncedItemsIDMap) {
                  if (value == aState.nextSiblingNodeKey) {
                    aState.nextSiblingSID = key;
                    break;
                  }
                }
              }
            }
            else {
              delete aState.nextSiblingSID;
            }
          }
        }

        this._lastUndo = aState;
        this.length = (this.length == 0 ? 1 : 1);
      },

      pop()
      {
        var rv = {};
        for (let ppty in this._lastUndo) {
          rv[ppty] = this._lastUndo[ppty];
        }
        this._lastUndo = null;
        this.length = 0;
        return rv;
      },

      clear()
      {
        this._lastUndo = null;
        this.length = 0;
      },

      refreshSyncedItems()
      {
        if (! gPrefs.syncClippings) {
          return;
        }
        if (! this._lastUndo) {
          return;
        }

        if ("sid" in this._lastUndo) {
          let xid = gSyncedItemsIDMap.get(this._lastUndo.sid);
          this._lastUndo.id = parseInt(xid);
          if ("nodeKey" in this._lastUndo) {
            this._lastUndo.nodeKey = xid;
          }
        }
        if ("parentFldrSID" in this._lastUndo) {
          let xpfid = gSyncedItemsIDMap.get(this._lastUndo.parentFldrSID);
          if ("parentFolderID" in this._lastUndo) {
            this._lastUndo.parentFolderID = parseInt(xpfid);
          }
          else {
            this._lastUndo.parentFldrID = parseInt(xpfid);
          }
        }
        if ("oldParentFldrSID" in this._lastUndo) {
          let xopfid = gSyncedItemsIDMap.get(this._lastUndo.oldParentFldrSID);
          this._lastUndo.oldParentFldrID = parseInt(xopfid);
        }
        if ("newParentFldrSID" in this._lastUndo) {
          let xnpfid = gSyncedItemsIDMap.get(this._lastUndo.newParentFldrSID);
          this._lastUndo.newParentFldrID = parseInt(xnpfid);
        }
        if ("destFldrSID" in this._lastUndo) {
          let dfid = gSyncedItemsIDMap.get(this._lastUndo.destFldrSID);
          this._lastUndo.destFldrID = parseInt(dfid);
        }
        if ("nextSiblingSID" in this._lastUndo) {
          this._lastUndo.nextSiblingNodeKey = gSyncedItemsIDMap.get(this._lastUndo.nextSiblingSID);
        }

        if (this._lastUndo.action == gCmd.ACTION_REMOVE_ALL_SRC_URLS) {
          this._lastUndo.clippingsWithSrcURLs.forEach(aClipping => {
            // Update IDs of synced clippings whose source URLs were removed.
            if ("sid" in aClipping) {
              let xid = gSyncedItemsIDMap.get(aClipping.sid);
              if (xid) {
                aClipping.id = parseInt(xid);
              }
              else {
                delete aClipping.sid;
              }
            }
          });
        }
      }
    },

    get recentAction()
    {
      return this._recentAction;
    },

    set recentAction(aActionID)
    {
      return (this._recentAction = aActionID);
    },

    getRecentActionInfo()
    {
      let rv = null;
      let recentAction = this.undoStack.getLastItem();

      if (recentAction) {
        rv = recentAction;
      }

      return rv;
    },

    newClipping(aDestUndoStack)
    {
      if (gIsClippingsTreeEmpty) {
        unsetEmptyClippingsState();
      }

      let tree = aeClippingsTree.getTree();
      let selectedNode = tree.activeNode;
      let parentFolderID = aeConst.ROOT_FOLDER_ID;
      let displayOrder = 0;

      if (selectedNode) {
        parentFolderID = this._getParentFldrIDOfTreeNode(selectedNode);
        let parentFldrChildNodes = selectedNode.getParent().getChildren();
        if (parentFldrChildNodes === undefined) {
          warn("Clippings: clippingsMgr/cmds.js: gCmd.newClipping(): Can't get child nodes of the parent node, because Fancytree lazy loading is in effect!");
        }
        else {
          displayOrder = parentFldrChildNodes.length;
        }
      }

      if (gSyncedItemsIDs.has(parentFolderID + "F") && gPrefs.isSyncReadOnly) {
        setTimeout(() => { gDialog.syncFldrReadOnly.openPopup() }, 100);
        return;
      }

      this.recentAction = this.ACTION_CREATENEW;

      let name = browser.i18n.getMessage("newClipping");
      let newClipping = {
        name,
        content: "",
        shortcutKey: "",
        parentFolderID,
        label: "",
        sourceURL: "",
        displayOrder,
      };

      if (gSyncedItemsIDs.has(parentFolderID + "F")) {
        newClipping.sid = aeUUID();
      }

      let parentFldrSID;

      gClippingsDB.folders.get(parentFolderID).then(aFolder => {
        if (aFolder && aFolder.id != gPrefs.syncFolderID && "sid" in aFolder) {
          parentFldrSID = aFolder.sid;
        }
        return gClippingsSvc.createClipping(newClipping);

      }).then(aNewClippingID => {
        this._unsetClippingsUnchangedFlag();

        if (aDestUndoStack == this.UNDO_STACK) {
          let state = {
            action: this.ACTION_CREATENEW,
            id: aNewClippingID,
            itemType: this.ITEMTYPE_CLIPPING,
            parentFldrID: parentFolderID,
          };

          if (gSyncedItemsIDs.has(parentFolderID + "F")) {
            if ("sid" in newClipping) {
              state.sid = newClipping.sid;
            }
            if (parentFldrSID) {
              state.parentFldrSID = parentFldrSID;
            }
          }

          this.undoStack.push(state);
        }

        if (gSyncedItemsIDs.has(parentFolderID + "F")) {
          gSyncedItemsIDs.add(aNewClippingID + "C");
          gSyncedItemsIDMap.set(newClipping.sid, aNewClippingID + "C");
          browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"})
              .then(handlePushSyncUpdatesResponse)
              .catch(handlePushSyncItemsError);
        }
      });
    },

    newClippingWithContent: function (aParentFolderID, aName, aContent, aDestUndoStack)
    {
      if (gIsClippingsTreeEmpty) {
        unsetEmptyClippingsState();
      }

      let tree = aeClippingsTree.getTree();
      let parentFolderID = aParentFolderID;

      this.recentAction = this.ACTION_CREATENEW;

      let newClipping = {
        name: aName,
        content: aContent,
        shortcutKey: "",
        parentFolderID,
        label: "",
        sourceURL: "",
        displayOrder: 999999,
      };

      if (gSyncedItemsIDs.has(parentFolderID + "F")) {
        newClipping.sid = aeUUID();
      }

      let parentFldrSID;

      gClippingsDB.folders.get(parentFolderID).then(aFolder => {
        if (aFolder && aFolder.id != gPrefs.syncFolderID && "sid" in aFolder) {
          parentFldrSID = aFolder.sid
        }
        return gClippingsSvc.createClipping(newClipping);

      }).then(aNewClippingID => {
        this._unsetClippingsUnchangedFlag();

        if (aDestUndoStack == this.UNDO_STACK) {
          let state = {
            action: this.ACTION_CREATENEW,
            id: aNewClippingID,
            itemType: this.ITEMTYPE_CLIPPING,
            parentFldrID: parentFolderID,
          };

          if (gSyncedItemsIDs.has(parentFolderID + "F")) {
            state.sid = newClipping.sid;
            if (parentFldrSID) {
              state.parentFldrSID = parentFldrSID;
            }
          }

          this.undoStack.push(state);
        }

        if (gSyncedItemsIDs.has(parentFolderID + "F")) {
          gSyncedItemsIDs.add(aNewClippingID + "C");
          gSyncedItemsIDMap.set(newClipping.sid, aNewClippingID + "C");
          browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"})
              .then(handlePushSyncUpdatesResponse)
              .catch(handlePushSyncItemsError);
        }
      });
    },

    async newClippingFromClipboard()
    {
      let perms = await browser.permissions.getAll();
      if (! perms.permissions.includes("clipboardRead")) {
        gDialog.requestExtPerm.setPermission("clipboardRead");
        gDialog.requestExtPerm.showModal();
        return;
      }

      let content = await navigator.clipboard.readText();
      if (content == "") {
        setTimeout(() => {gDialog.clipboardEmpty.openPopup()}, 100);
        return;
      }

      content = DOMPurify.sanitize(content);
      let name = aeClippings.createClippingNameFromText(content);

      let tree = aeClippingsTree.getTree();
      let selectedNode = tree.activeNode;
      let parentFolderID = aeConst.ROOT_FOLDER_ID;

      if (selectedNode) {
        parentFolderID = this._getParentFldrIDOfTreeNode(selectedNode);
        let parentFldrChildNodes = selectedNode.getParent().getChildren();
        if (parentFldrChildNodes === undefined) {
          warn("Clippings: clippingsMgr/cmds.js: gCmd.newClippingFromClipboard(): Can't get child nodes of the parent node, because Fancytree lazy loading is in effect!");
        }
      }

      // If attempting to create new clipping in the Synced Clippings folder
      // when sync file is read-only, create in the root folder instead.
      if (gPrefs.syncClippings && gPrefs.isSyncReadOnly
          && gSyncedItemsIDs.has(parentFolderID + "F")) {
        parentFolderID = aeConst.ROOT_FOLDER_ID;
      }

      // If attempting to create new clipping in the Synced Clippings folder
      // when sync file is read-only, create in the root folder instead.
      if (gPrefs.syncClippings && gPrefs.isSyncReadOnly
          && gSyncedItemsIDs.has(parentFolderID + "F")) {
        parentFolderID = aeConst.ROOT_FOLDER_ID;
      }

      this.newClippingWithContent(parentFolderID, name, content, gCmd.UNDO_STACK);
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
        gDialog.requestExtPerm.setPermission("clipboardWrite");
        gDialog.requestExtPerm.showModal();
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

    newFolder: function (aDestUndoStack)
    {
      if (gIsClippingsTreeEmpty) {
        unsetEmptyClippingsState();
      }

      let tree = aeClippingsTree.getTree();
      let selectedNode = tree.activeNode;
      let parentFolderID = aeConst.ROOT_FOLDER_ID;
      let displayOrder = 0;

      if (selectedNode) {
        parentFolderID = this._getParentFldrIDOfTreeNode(selectedNode);
        let parentFldrChildNodes = selectedNode.getParent().getChildren();
        if (parentFldrChildNodes === undefined) {
          warn("Clippings: clippingsMgr/cmds.js: gCmd.newFolder(): Can't get child nodes of the parent node, because Fancytree lazy loading is in effect!");
        }
        else {
          displayOrder = parentFldrChildNodes.length;
        }
      }

      if (gSyncedItemsIDs.has(parentFolderID + "F") && gPrefs.isSyncReadOnly) {
        setTimeout(() => { gDialog.syncFldrReadOnly.openPopup() }, 100);
        return;
      }

      this.recentAction = this.ACTION_CREATENEWFOLDER;

      let newFolder = {
        name: browser.i18n.getMessage("newFolder"),
        parentFolderID,
        displayOrder,
      };

      if (gSyncedItemsIDs.has(parentFolderID + "F")) {
        newFolder.sid = aeUUID();
      }

      let parentFldrSID;

      gClippingsDB.folders.get(parentFolderID).then(aFolder => {
        if (aFolder && aFolder.id != gPrefs.syncFolderID && "sid" in aFolder) {
          parentFldrSID = aFolder.sid
        }
        return gClippingsSvc.createFolder(newFolder);

      }).then(aNewFolderID => {
        this._unsetClippingsUnchangedFlag();

        if (aDestUndoStack == this.UNDO_STACK) {
          let state = {
            action: this.ACTION_CREATENEWFOLDER,
            id: aNewFolderID,
            itemType: this.ITEMTYPE_FOLDER,
            parentFldrID: parentFolderID,
          };

          if (gSyncedItemsIDs.has(parentFolderID + "F")) {
            state.sid = newFolder.sid;
            if (parentFldrSID) {
              state.parentFldrSID = parentFldrSID;
            }
          }

          this.undoStack.push(state);
        }

        if (gSyncedItemsIDs.has(parentFolderID + "F")) {
          gSyncedItemsIDs.add(aNewFolderID + "F");
          gSyncedItemsIDMap.set(newFolder.sid, aNewFolderID + "F");
          browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"})
              .then(handlePushSyncUpdatesResponse)
              .catch(handlePushSyncItemsError);
        }
      });
    },

    async moveClippingOrFolder()
    {
      if (gIsClippingsTreeEmpty) {
        return;
      }

      let tree = aeClippingsTree.getTree();
      let selectedNode = tree.activeNode;

      if (selectedNode) {
        if (selectedNode.isFolder()) {
          // Disallow if New Clipping dialog is open to prevent errors due to saving
          // a new clipping into a non-existent folder.
          let pingResp;
          try {
            pingResp = await browser.runtime.sendMessage({msgID: "ping-new-clipping-dlg"});
          }
          catch {}
          if (pingResp) {
            gDialog.actionUnavailable.openPopup();
            return;
          }

          let folderID = parseInt(selectedNode.key);
          if (folderID == gPrefs.syncFolderID) {
            console.warn("Cannot move the Synced Clippings folder.");
            return;
          }
        }
        else {
          if (selectedNode.extraClasses == "ae-separator") {
            // Don't allow moving/copying a separator.
            return;
          }
        }
      }

      gDialog.moveTo.showModal();
    },

    async deleteClippingOrFolder(aDestUndoStack)
    {
      if (gIsClippingsTreeEmpty) {
        return;
      }

      let tree = aeClippingsTree.getTree();
      let selectedNode = tree.activeNode;
      if (! selectedNode) {
        return;
      }

      let parentFolderID = this._getParentFldrIDOfTreeNode(selectedNode);

      if (gSyncedItemsIDs.has(parentFolderID + "F") && gPrefs.isSyncReadOnly) {
        setTimeout(() => { gDialog.syncFldrReadOnly.openPopup() }, 100);
        return;
      }

      let id = parseInt(selectedNode.key);
      let sid, parentFldrSID;  // Permanent IDs for synced items.
      let isSeparator = false;
      let displayOrder = null;  // For separators.

      if (selectedNode.isFolder()) {
        let pingResp;
        try {
          pingResp = await browser.runtime.sendMessage({msgID: "ping-new-clipping-dlg"});
        }
        catch {}
        if (pingResp) {
          gDialog.actionUnavailable.openPopup();
          return;
        }

        if (id == gPrefs.syncFolderID) {
          console.warn("Cannot delete the Synced Clippings folder, because Sync Clippings is turned on.");
          return;
        }

        gClippingsDB.folders.get(id).then(aFolder => {
          if (! aFolder) {
            throw new Error("No folder found for ID " + id);
          }

          if ("sid" in aFolder) {
            sid = aFolder.sid;
          }
          return gClippingsDB.folders.get(parentFolderID);

        }).then(aFolder => {
          if (aFolder && aFolder.id != gPrefs.syncFolderID && "sid" in aFolder) {
            parentFldrSID = aFolder.sid;
          }

          let folderChg = {
            parentFolderID: aeConst.DELETED_ITEMS_FLDR_ID,
            sid: undefined,
          };

          this.recentAction = this.ACTION_DELETEFOLDER;
          return gClippingsSvc.updateFolder(id, folderChg);

        }).then(aNumUpd => {
          this._unsetClippingsUnchangedFlag();

          if (aDestUndoStack == this.UNDO_STACK) {
            let state = {
              action: this.ACTION_DELETEFOLDER,
              itemType: this.ITEMTYPE_FOLDER,
              id,
              parentFolderID
            };
            if (gSyncedItemsIDs.has(parentFolderID + "F")) {
              state.sid = sid;
              if (parentFldrSID) {
                state.parentFldrSID = parentFldrSID;
              }
            }

            this.undoStack.push(state);
          }

          if (gSyncedItemsIDs.has(parentFolderID + "F")) {
            browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(() => {
              gSyncedItemsIDs.delete(id + "F");
              gSyncedItemsIDMap.delete(sid);
            }).catch(handlePushSyncItemsError);
          }
        }).catch(aErr => {
          console.error("Clippings: clippingsMgr/cmds.js: gCmd.deleteClippingOrFolder(): " + aErr);
        });
      }
      else {
        gClippingsDB.clippings.get(id).then(aClipping => {
          if (! aClipping) {
            throw new Error("No clipping found for ID " + id);
          }

          if ("sid" in aClipping) {
            sid = aClipping.sid;
          }

          if (aClipping.separator) {
            isSeparator = true;
            displayOrder = aClipping.displayOrder;
          }

          return gClippingsDB.folders.get(parentFolderID);

        }).then(aFolder => {
          if (aFolder && aFolder.id != gPrefs.syncFolderID && "sid" in aFolder) {
            parentFldrSID = aFolder.sid;
          }

          let clippingChg = {
            parentFolderID: aeConst.DELETED_ITEMS_FLDR_ID,
            shortcutKey: "",
            sid: undefined,
          };

          this.recentAction = this.ACTION_DELETECLIPPING;
          return gClippingsSvc.updateClipping(id, clippingChg);

        }).then(aNumUpd => {
          this._unsetClippingsUnchangedFlag();

          if (aDestUndoStack == this.UNDO_STACK) {
            let state = {
              action: this.ACTION_DELETECLIPPING,
              itemType: this.ITEMTYPE_CLIPPING,
              id,
              parentFolderID,
            };
            if (gSyncedItemsIDs.has(parentFolderID + "F")) {
              state.sid = sid;
              if (parentFldrSID) {
                state.parentFldrSID = parentFldrSID;
              }
            }

            if (isSeparator) {
              state.isSeparator = true;
              state.displayOrder = displayOrder;
            }

            this.undoStack.push(state);
          }

          if (gSyncedItemsIDs.has(parentFolderID + "F")) {
            browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(() => {
              gSyncedItemsIDs.delete(id + "C");
              gSyncedItemsIDMap.delete(sid);
            }).catch(handlePushSyncItemsError);
          }
        }).catch(aErr => {
          console.error("Clippings: clippingsMgr/cmds.js: gCmd.deleteClippingOrFolder(): " + aErr);
        });
      }
    },


    async insertSeparator(aDestUndoStack)
    {
      if (gIsClippingsTreeEmpty) {
        unsetEmptyClippingsState();
      }

      let tree = aeClippingsTree.getTree();
      let selectedNode = tree.activeNode;
      let parentFolderID = aeConst.ROOT_FOLDER_ID;
      let displayOrder = 0;

      if (selectedNode) {
        parentFolderID = this._getParentFldrIDOfTreeNode(selectedNode);
        let parentFldrChildNodes = selectedNode.getParent().getChildren();
        if (parentFldrChildNodes === undefined) {
          warn("Clippings/mx::pg.js: gCmd.insertSeparator(): Can't get child nodes of the parent node, because Fancytree lazy loading is in effect!");
        }
      }

      if (gSyncedItemsIDs.has(parentFolderID + "F") && gPrefs.isSyncReadOnly) {
        setTimeout(() => { gDialog.syncFldrReadOnly.openPopup() }, 100);
        return;
      }

      // Force displayOrder to be updated on all folder menu items so that the
      // separator is inserted in the correct position.
      await this.updateDisplayOrder(parentFolderID, null, null, true);

      let id = parseInt(selectedNode.key);

      // Calculate display order.
      if (selectedNode.isFolder()) {
        // Insert separator before the selected item. But insert after if the
        // selected node is the first item, since the menus API won't render a
        // separator if it's the first item on the menu.
        let fldr = await gClippingsDB.folders.get(id);
        if (fldr.displayOrder == 0) {
          displayOrder = 0;
        }
        else if (fldr.displayOrder == 1 && parentFolderID == aeConst.ROOT_FOLDER_ID) {
          // Root folder displayOrder numbering starts at 1 to accommodate the
          // Synced Clippings folder.
          displayOrder = 1;
        }
        else {
          displayOrder = fldr.displayOrder - 1;
        }
      }
      else {
        let clipping = await gClippingsDB.clippings.get(id);
        if (clipping.displayOrder == 0) {
          displayOrder = 0;
        }
        else if (clipping.displayOrder == 1 && parentFolderID == aeConst.ROOT_FOLDER_ID) {
          displayOrder = 1;
        }
        else {
          displayOrder = clipping.displayOrder - 1;
        }
      }
      log("Clippings/mx::pg.js: gCmd.insertSeparator(): At position: " + displayOrder);

      this.recentAction = this.ACTION_INSERT_SEPARATOR;

      let newSeparator = {
        name: browser.i18n.getMessage("sepName"),
        content: "",
        shortcutKey: "",
        parentFolderID,
        label: "",
        sourceURL: "",
        displayOrder,
        separator: true,
      };

      if (gSyncedItemsIDs.has(parentFolderID + "F")) {
        newSeparator.sid = aeUUID();
      }

      let parentFldrSID;

      let folder = await gClippingsDB.folders.get(parentFolderID);
      if (folder && folder.id != gPrefs.syncFolderID && "sid" in folder) {
        parentFldrSID = folder.sid;
      }

      let newSeparatorID = await gClippingsSvc.createClipping(newSeparator);
      this._unsetClippingsUnchangedFlag();

      await this.updateDisplayOrder(parentFolderID, null, null, true);

      let state = {
        action: this.ACTION_INSERT_SEPARATOR,
        id: newSeparatorID,
        parentFldrID: parentFolderID,
        displayOrder,
        separator: true,
      };
      this._pushToUndoStack(aDestUndoStack, state);

      if (gSyncedItemsIDs.has(parentFolderID + "F")) {
        gSyncedItemsIDs.add(newSeparatorID + "C");
        gSyncedItemsIDMap.set(newSeparator.sid, newSeparatorID + "C");
        let resp;
        try {
          resp = await browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"});
          handlePushSyncUpdatesResponse(resp);
        }
        catch (e) {
          handlePushSyncItemsError(e);
        }
      }
    },


    // Internal commands are NOT meant to be invoked directly from the UI.
    moveClippingIntrl(aClippingID, aNewParentFldrID, aDestUndoStack)
    {
      if (gIsClippingsTreeEmpty) {
        unsetEmptyClippingsState();
      }

      return new Promise((aFnResolve, aFnReject) => {
        let oldParentFldrID, sid, oldParentFldrSID, newParentFldrSID,
            clippingChg, clipping;
        this.recentAction = this.ACTION_MOVETOFOLDER;

        gClippingsDB.clippings.get(aClippingID).then(aClipping => {
          if (! aClipping) {
            throw new Error("Clipping not found for ID " + aClippingID);
          }

          clipping = aClipping;
          oldParentFldrID = aClipping.parentFolderID;
          if ("sid" in aClipping) {
            sid = aClipping.sid;
          }
          clippingChg = {
            parentFolderID: aNewParentFldrID,
          };

          if (gSyncedItemsIDs.has(aNewParentFldrID + "F")) {
            if (! sid) {
              // Set permanent ID of synced item if it wasn't already so.
              sid = aeUUID();
            }
            clippingChg.sid = sid;
          }
          else {
            clippingChg.sid = undefined;
          }

          if (aClipping.separator && aClipping.displayOrder > 0
              && aNewParentFldrID != aeConst.DELETED_ITEMS_FLDR_ID) {
            // Position the separator in the correct sequence.
            clippingChg.displayOrder = aClipping.displayOrder - 1;
          }

          if (oldParentFldrID == aeConst.DELETED_ITEMS_FLDR_ID) {
            return null;
          }

          return gClippingsDB.folders.get(oldParentFldrID);

        }).then(aFolder => {
          if (aFolder && oldParentFldrID != gPrefs.syncFolderID && "sid" in aFolder) {
            oldParentFldrSID = aFolder.sid;
          }

          if (aNewParentFldrID == aeConst.DELETED_ITEMS_FLDR_ID) {
            return null;
          }
          return gClippingsDB.folders.get(aNewParentFldrID);

        }).then(aFolder => {
          if (aFolder && aNewParentFldrID != gPrefs.syncFolderID && "sid" in aFolder) {
            newParentFldrSID = aFolder.sid;
          }
          return gClippingsSvc.updateClipping(aClippingID, clippingChg, clipping);

        }).then(aNumUpd => {
          this._unsetClippingsUnchangedFlag();
          if (aNewParentFldrID == aeConst.DELETED_ITEMS_FLDR_ID) {
            return null;
          }
          return this.updateDisplayOrder(aNewParentFldrID, null, null, true);

        }).then(() => {
          let state = {
            action: this.ACTION_MOVETOFOLDER,
            itemType: this.ITEMTYPE_CLIPPING,
            id: aClippingID,
            oldParentFldrID,
            newParentFldrID: aNewParentFldrID
          };

          if (gSyncedItemsIDs.has(aNewParentFldrID + "F")) {
            if ("sid" in clippingChg) {
              state.sid = clippingChg.sid;
            }
            else {
              state.sid = sid;
            }
            if (newParentFldrSID) {
              state.newParentFldrSID = newParentFldrSID;
            }
          }
          if (oldParentFldrSID) {
            state.oldParentFldrSID = oldParentFldrSID;
          }

          if (gSyncedItemsIDs.has(aNewParentFldrID + "F")
              || gSyncedItemsIDs.has(oldParentFldrID + "F")) {
            browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(aResp => {
              // Remove clipping from synced items set if it was moved out of a
              // synced folder.
              if (gSyncedItemsIDs.has(aClippingID + "C")
                  && !gSyncedItemsIDs.has(aNewParentFldrID + "F")) {
                gSyncedItemsIDs.delete(aClippingID + "C");
                gSyncedItemsIDMap.delete(sid);
              }

              // Add clipping to synced items set if moved to a synced folder.
              if (gSyncedItemsIDs.has(aNewParentFldrID + "F")) {
                gSyncedItemsIDs.add(aClippingID + "C");
                gSyncedItemsIDMap.set(sid, aClippingID + "C");
              }
              this._pushToUndoStack(aDestUndoStack, state);
              aFnResolve();
              handlePushSyncUpdatesResponse(aResp);
            }).catch(handlePushSyncItemsError);
          }
          else {
            this._pushToUndoStack(aDestUndoStack, state);
            aFnResolve();
          }
        }).catch(aErr => {
          console.error("Clippings: clippingsMgr/cmds.js: gCmd.moveClippingIntrl(): " + aErr);
          aFnReject(aErr);
        });
      });
    },

    copyClippingIntrl(aClippingID, aDestFldrID, aDestUndoStack)
    {
      this.recentAction = this.ACTION_COPYTOFOLDER;

      let clippingCpy = {};
      let clipping, sid, destFldrSID;

      gClippingsDB.clippings.get(aClippingID).then(aClipping => {
        if (! aClipping) {
          throw new Error("Clipping not found for ID " + aClippingID);
        }

        clipping = aClipping;
        let tree = aeClippingsTree.getTree();
        let parentFldrNode;
        if (aDestFldrID == aeConst.ROOT_FOLDER_ID) {
          parentFldrNode = tree.rootNode
        }
        else {
          parentFldrNode = tree.getNodeByKey(aDestFldrID + "F");
        }
        let parentFldrChildNodes = parentFldrNode.getChildren();
        let displayOrder = parentFldrChildNodes ? parentFldrChildNodes.length : 0;

        clippingCpy = {
          name: aClipping.name,
          content: aClipping.content,
          shortcutKey: "",
          parentFolderID: aDestFldrID,
          label: aClipping.label,
          sourceURL: aClipping.sourceURL,
          displayOrder
        };

        if (gSyncedItemsIDs.has(aDestFldrID + "F")) {
          sid = aeUUID();
          clippingCpy.sid = sid;
        }

        if (aDestFldrID == aeConst.DELETED_ITEMS_FLDR_ID) {
          return null;
        }
        return gClippingsDB.folders.get(aDestFldrID);

      }).then(aFolder => {
        if (aFolder && aFolder.id != gPrefs.syncFolderID && "sid" in aFolder) {
          destFldrSID = aFolder.sid;
        }

        return gClippingsSvc.createClipping(clippingCpy);

      }).then(aNewClippingID => {
        this._unsetClippingsUnchangedFlag();

        if (aDestUndoStack == this.UNDO_STACK) {
          let state = {
            action: this.ACTION_COPYTOFOLDER,
            id: aNewClippingID,
            itemType: this.ITEMTYPE_CLIPPING,
            destFldrID: aDestFldrID,
          };

          if (gSyncedItemsIDs.has(aDestFldrID + "F")) {
            if ("sid" in clipping) {
              state.sid = clipping.sid;
            }
            else {
              state.sid = sid;
            }
            if (destFldrSID) {
              state.destFldrSID = destFldrSID;
            }
          }
          this.undoStack.push(state);
        }

        if (gSyncedItemsIDs.has(aDestFldrID + "F")) {
          browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(aResp => {
            gSyncedItemsIDs.add(aNewClippingID + "C");
            gSyncedItemsIDMap.set(sid, aNewClippingID + "C");
            handlePushSyncUpdatesResponse(aResp);
          }).catch(handlePushSyncItemsError);
        }
      }).catch(aErr => {
        console.error("Clippings: clippingsMgr/cmds.js: gCmd.copyClippingIntrl(): " + aErr);
      });
    },

    moveFolderIntrl(aFolderID, aNewParentFldrID, aDestUndoStack)
    {
      if (gIsClippingsTreeEmpty) {
        unsetEmptyClippingsState();
      }

      return new Promise((aFnResolve, aFnReject) => {
        let oldParentFldrID, sid, oldParentFldrSID, newParentFldrSID,
            folderChg, folder;
        this.recentAction = this.ACTION_MOVETOFOLDER;

        gClippingsDB.folders.get(aFolderID).then(aFolder => {
          if (! aFolder) {
            throw new Error("Folder not found for ID " + aFolderID);
          }

          folder = aFolder;
          oldParentFldrID = aFolder.parentFolderID;
          if ("sid" in aFolder) {
            sid = aFolder.sid;
          }
          folderChg = {
            parentFolderID: aNewParentFldrID,
          };

          if (gSyncedItemsIDs.has(aNewParentFldrID + "F")) {
            if (! sid) {
              // Set permanent ID of synced item if it wasn't already so.
              sid = aeUUID();
            }
            folderChg.sid = sid;
          }
          else {
            folderChg.sid = undefined;
          }
          if (oldParentFldrID == aeConst.DELETED_ITEMS_FLDR_ID) {
            return null;
          }
          return gClippingsDB.folders.get(oldParentFldrID);

        }).then(aFolder => {
          if (aFolder && oldParentFldrID != gPrefs.syncFolderID && "sid" in aFolder) {
            oldParentFldrSID = aFolder.sid;
          }

          if (aNewParentFldrID == aeConst.DELETED_ITEMS_FLDR_ID) {
            return null;
          }
          return gClippingsDB.folders.get(aNewParentFldrID);

        }).then(aFolder => {
          if (aFolder && aNewParentFldrID != gPrefs.syncFolderID && "sid" in aFolder) {
            newParentFldrSID = aFolder.sid;
          }
          return gClippingsSvc.updateFolder(aFolderID, folderChg, folder);

        }).then(aNumUpd => {
          this._unsetClippingsUnchangedFlag();

          let state = {
            action: this.ACTION_MOVETOFOLDER,
            itemType: this.ITEMTYPE_FOLDER,
            id: aFolderID,
            oldParentFldrID,
            newParentFldrID: aNewParentFldrID
          };

          if (gSyncedItemsIDs.has(aNewParentFldrID + "F")) {
            if ("sid" in folderChg) {
              state.sid = folderChg.sid;
            }
            else {
              state.sid = sid;
            }
            if (newParentFldrSID) {
              state.newParentFldrSID = newParentFldrSID;
            }
          }
          if (oldParentFldrSID) {
            state.oldParentFldrSID = oldParentFldrSID;
          }

          if (gSyncedItemsIDs.has(aNewParentFldrID + "F")
              || gSyncedItemsIDs.has(oldParentFldrID + "F")) {
            browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(aResp => {
              if (gSyncedItemsIDs.has(aFolderID + "F")
                  && !gSyncedItemsIDs.has(aNewParentFldrID + "F")) {
                gSyncedItemsIDs.delete(aFolderID + "F");
                gSyncedItemsIDMap.delete(sid);
              }

              if (gSyncedItemsIDs.has(aNewParentFldrID + "F")) {
                gSyncedItemsIDs.add(aFolderID + "F");
                gSyncedItemsIDMap.set(sid, aFolderID + "F");
              }
              this._pushToUndoStack(aDestUndoStack, state);
              handlePushSyncUpdatesResponse(aResp);
              aFnResolve();
            }).catch(handlePushSyncItemsError);
          }
          else {
            this._pushToUndoStack(aDestUndoStack, state);
            aFnResolve();
          }
        }).catch(aErr => {
          console.error("Clippings: clippingsMgr/cmds.js: gCmd.moveFolderIntrl(): " + aErr);
          aFnReject(aErr);
        });
      });
    },

    copyFolderIntrl(aFolderID, aDestFldrID, aDestUndoStack)
    {
      let newFldrID = null;

      this.recentAction = this.ACTION_COPYTOFOLDER;

      gClippingsListener.copyStarted();
      browser.runtime.sendMessage({msgID: "copy-started"});

      let folderCpy = {};
      let folder, sid, destFldrSID;

      gClippingsDB.folders.get(aFolderID).then(aFolder => {
        if (! aFolder) {
          throw new Error("Folder not found for ID " + aFolderID);
        }

        folder = aFolder;
        let tree = aeClippingsTree.getTree();
        let parentFldrNode;
        if (aDestFldrID == aeConst.ROOT_FOLDER_ID) {
          parentFldrNode = tree.rootNode
        }
        else {
          parentFldrNode = tree.getNodeByKey(aDestFldrID + "F");
        }
        let parentFldrChildNodes = parentFldrNode.getChildren();
        let displayOrder = parentFldrChildNodes ? parentFldrChildNodes.length : 0;

        folderCpy = {
          name: aFolder.name,
          parentFolderID: aDestFldrID,
          displayOrder,
        };

        if (gSyncedItemsIDs.has(aDestFldrID + "F")) {
          sid = aeUUID();
          folderCpy.sid = sid;
        }

        if (aDestFldrID == aeConst.DELETED_ITEMS_FLDR_ID) {
          return null;
        }
        return gClippingsDB.folders.get(aDestFldrID);

      }).then(aFolder => {
        if (aFolder && aFolder.id != gPrefs.syncFolderID && "sid" in aFolder) {
          destFldrSID = aFolder.sid;
        }

        return gClippingsSvc.createFolder(folderCpy);

      }).then(aNewFolderID => {
        newFldrID = aNewFolderID;

        gClippingsListener.copiedItems.push({
          id: newFldrID,
          itemType: this.ITEMTYPE_FOLDER,
          name: folderCpy.name,
          parentFolderID: folderCpy.parentFolderID,
        });

        return this._copyFolderHelper(aFolderID, aNewFolderID);

      }).then(() => {
        this._unsetClippingsUnchangedFlag();

        if (aDestUndoStack == this.UNDO_STACK) {
          let state = {
            action: this.ACTION_COPYTOFOLDER,
            id: newFldrID,
            itemType: this.ITEMTYPE_FOLDER,
            destFldrID: aDestFldrID,
          };
          if (gSyncedItemsIDs.has(aDestFldrID + "F")) {
            if ("sid" in folder) {
              state.sid = folder.sid;
            }
            else {
              state.sid = sid;
            }
            if (destFldrSID) {
              state.destFldrSID = destFldrSID;
            }
          }
          this.undoStack.push(state);
        }

        if (gSyncedItemsIDs.has(aDestFldrID + "F")) {
          browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(aResp => {
            gSyncedItemsIDs.add(newFldrID + "F");
            gSyncedItemsIDMap.set(sid, newFldrID + "F");
            handlePushSyncUpdatesResponse(aResp);
          }).catch(handlePushSyncItemsError);
        }

        gClippingsListener.copyFinished(newFldrID);
        browser.runtime.sendMessage({
          msgID: "copy-finished",
          itemCopyID: newFldrID,
        });

      }).catch(aErr => {
        console.error("Clippings: clippingsMgr/cmds.js: gCmd.copyFolderIntrl(): " + aErr);
      });
    },

    editFolderNameIntrl: function (aFolderID, aName, aDestUndoStack)
    {
      let that = this;

      return new Promise((aFnResolve, aFnReject) => {
        let oldName = "";
        let sid;

        gClippingsDB.folders.get(aFolderID).then(aFolder => {
          if (! aFolder) {
            throw new Error("Folder not found for ID " + aFolderID);
          }

          oldName = aFolder.name;

          if (aName == oldName) {
            return 0;
          }

          if ("sid" in aFolder) {
            sid = aFolder.sid;
          }

          that.recentAction = that.ACTION_EDITNAME;
          return gClippingsSvc.updateFolder(aFolderID, { name: aName }, aFolder);

        }).then(aNumUpd => {
          this._unsetClippingsUnchangedFlag();

          if (aNumUpd && aDestUndoStack == that.UNDO_STACK) {
            let state = {
              action: that.ACTION_EDITNAME,
              id: aFolderID,
              name: aName,
              oldName,
              itemType: that.ITEMTYPE_FOLDER
            };
            if (gSyncedItemsIDs.has(aFolderID + "F")) {
              state.sid = sid;
            }

            that.undoStack.push(state);
          }

          if (gSyncedItemsIDs.has(aFolderID + "F")) {
            browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(aResp => {
              handlePushSyncUpdatesResponse(aResp);
              aFnResolve();
            }).catch(aErr => {
              handlePushSyncItemsError(aErr);
            });
          }
          else {
            aFnResolve();
          }
        }).catch(aErr => {
          console.error("Clippings: clippingsMgr/cmds.js: gCmd.editFolderNameIntrl(): " + aErr);
          aFnReject(aErr);
        });
      });
    },

    editClippingNameIntrl: function (aClippingID, aName, aDestUndoStack)
    {
      let that = this;

      return new Promise((aFnResolve, aFnReject) => {
        let oldName = "";
        let sid;

        gClippingsDB.clippings.get(aClippingID).then(aClipping => {
          if (! aClipping) {
            throw new Error("Clipping not found for ID " + aClippingID);
          }

          if ("sid" in aClipping) {
            sid = aClipping.sid;
          }

          oldName = aClipping.name;
          if (aName == oldName) {
            return 0;
          }

          that.recentAction = that.ACTION_EDITNAME;
          return gClippingsSvc.updateClipping(aClippingID, { name: aName }, aClipping);

        }).then(aNumUpd => {
          this._unsetClippingsUnchangedFlag();

          if (aNumUpd && aDestUndoStack == that.UNDO_STACK) {
            let state = {
              action: that.ACTION_EDITNAME,
              id: aClippingID,
              name: aName,
              oldName,
              itemType: that.ITEMTYPE_CLIPPING
            };
            if (gSyncedItemsIDs.has(aClippingID + "C")) {
              state.sid = sid;
            }

            that.undoStack.push(state);
          }

          if (gSyncedItemsIDs.has(aClippingID + "C")) {
            browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(aResp => {
              handlePushSyncUpdatesResponse(aResp);
              aFnResolve();
            }).catch(aErr => {
              handlePushSyncItemsError(aErr);
            });
          }
          else {
            aFnResolve();
          }
        }).catch(aErr => {
          console.error("Clippings: clippingsMgr/cmds.js: gCmd.editClippingNameIntrl(): " + aErr);
          aFnReject(aErr);
        });
      });
    },

    editClippingContentIntrl: function (aClippingID, aContent, aDestUndoStack)
    {
      let that = this;

      return new Promise((aFnResolve, aFnReject) => {
        let oldContent = "";
        let sid;

        gClippingsDB.clippings.get(aClippingID).then(aClipping => {
          if (! aClipping) {
            throw new Error("Clipping not found for ID " + aClippingID);
          }

          if ("sid" in aClipping) {
            sid = aClipping.sid;
          }

          oldContent = aClipping.content;
          if (aContent == oldContent) {
            return 0;
          }

          that.recentAction = that.ACTION_EDITCONTENT;
          return gClippingsSvc.updateClipping(aClippingID, { content: aContent }, aClipping);

        }).then(aNumUpd => {
          this._unsetClippingsUnchangedFlag();

          if (aNumUpd && aDestUndoStack == that.UNDO_STACK) {
            let state = {
              action: that.ACTION_EDITCONTENT,
              id: aClippingID,
              content: aContent,
              oldContent,
              itemType: that.ITEMTYPE_CLIPPING
            };
            if (gSyncedItemsIDs.has(aClippingID + "C")) {
              state.sid = sid;
            }

            that.undoStack.push(state);
          }

          if (gSyncedItemsIDs.has(aClippingID + "C")) {
            browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(aResp => {
              handlePushSyncUpdatesResponse(aResp);
              aFnResolve();
            }).catch(aErr => {
              handlePushSyncItemsError(aErr);
            });
          }
          else {
            aFnResolve();
          }
        }).catch(aErr => {
          console.error("Clippings: clippingsMgr/cmds.js: gCmd.editClippingContentIntrl(): " + aErr);
          aFnReject(aErr);
        });
      });
    },

    setLabelIntrl: function (aClippingID, aLabel, aDestUndoStack)
    {
      let selectedNode = aeClippingsTree.getTree().activateKey(aClippingID + "C");
      let oldLabel, sid;

      this.recentAction = this.ACTION_SETLABEL;

      gClippingsDB.clippings.get(aClippingID).then(aClipping => {
        if (! aClipping) {
          throw new Error("Clipping not found for ID " + aClippingID);
        }

        oldLabel = aClipping.label;

        if ("sid" in aClipping) {
          sid = aClipping.sid;
        }
        return gClippingsSvc.updateClipping(aClippingID, { label: aLabel }, aClipping);

      }).then(aNumUpd => {
        // Set the icon color on the tree list.
        if (selectedNode.extraClasses !== undefined) {
          let result = selectedNode.extraClasses.match(/ae\-clipping\-label\-[a-z]+/);
          if (result) {
            selectedNode.removeClass(result[0]);
          }
        }

        if (aLabel) {
          selectedNode.addClass(`ae-clipping-label-${aLabel}`);
        }

        gClippingLabelPicker.selectedLabel = aLabel;

        this._unsetClippingsUnchangedFlag();
        if (aDestUndoStack == this.UNDO_STACK) {
          let state = {
            action: this.ACTION_SETLABEL,
            id: aClippingID,
            label: aLabel,
            oldLabel
          };
          if (gSyncedItemsIDs.has(aClippingID + "C")) {
            state.sid = sid;
          }

          this.undoStack.push(state);
        }

        if (gSyncedItemsIDs.has(aClippingID + "C")) {
          browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(aResp => {
            handlePushSyncUpdatesResponse(aResp);
          }).catch(handlePushSyncItemsError);
        }
      }).catch(aErr => {
        handlePushSyncItemsError(aErr);
        console.error("Clippings: clippingsMgr/cmds.js: gCmd.setLabel(): " + aErr);
      });
    },

    updateDisplayOrder: function (aFolderID, aDestUndoStack, aUndoInfo, aSuppressClippingsMenuRebuild)
    {
      let tree = aeClippingsTree.getTree();
      let folderNode;

      if (aFolderID == aeConst.ROOT_FOLDER_ID) {
        folderNode = tree.getRootNode();
      }
      else {
        folderNode = tree.getNodeByKey(aFolderID + "F");
      }

      return new Promise((aFnResolve, aFnReject) => {
        let childNodes = folderNode.getChildren();
        if (! childNodes) {  // Empty folder.
          aFnResolve();
          return;
        }

        this.recentAction = this.ACTION_CHANGEPOSITION;

        gClippingsDB.transaction("rw", gClippingsDB.folders, gClippingsDB.clippings, () => {
          let seqUpdates = [];

          for (let i = 0; i < childNodes.length; i++) {
            let key = childNodes[i].key;
            let suffix = key.substring(key.length - 1);
            let seq = (aFolderID == aeConst.ROOT_FOLDER_ID ? (i + 1) : i);

            if (suffix == "F") {
              let fldrSeqUpd = gClippingsSvc.updateFolder(parseInt(childNodes[i].key), { displayOrder: seq });
              seqUpdates.push(fldrSeqUpd);
            }
            else if (suffix == "C") {
              let clipSeqUpd = gClippingsSvc.updateClipping(parseInt(childNodes[i].key), { displayOrder: seq });
              seqUpdates.push(clipSeqUpd);
            }
          }

          Promise.all(seqUpdates).then(aNumUpd => {
            log(`Clippings/wx::clippingsMgr.js: gCmd.updateDisplayOrder(): Display order updates for each folder item is completed (folder ID = ${aFolderID})`);

            this._unsetClippingsUnchangedFlag();
            if (aDestUndoStack == this.UNDO_STACK) {
              this.undoStack.push(aUndoInfo);
            }

            if (! aSuppressClippingsMenuRebuild) {
              browser.runtime.sendMessage({msgID: "rebuild-cxt-menu"});
            }

            if (aFolderID == gPrefs.syncFolderID || gSyncedItemsIDs.has(aFolderID + "F")) {
              browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"}).then(() => {
                log("Clippings: clippingsMgr/cmds.js: :gCmd.updateDisplayOrder(): Saved the display order for synced items.");
              });
            }

            aFnResolve();
          });
        }).catch(aErr => {
          console.error("Clippings: clippingsMgr/cmds.js: :gCmd.updateDisplayOrder(): %s", aErr.message);
          aFnReject(aErr);
        });
      });
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
        gDialog.clippingMissingSrcURL.openPopup();
        return;
      }

      aeNavigator.gotoURL(clipping.sourceURL, aeNavigator.TARGET_NEW_WINDOW);
    },


    removeAllSrcURLsIntrl()
    {
      let clippingsWithSrcURLs = [];

      gClippingsDB.clippings.where("sourceURL").notEqual("").each((aItem, aCursor) => {
        let clipping = {
          id: aItem.id,
          srcURL: aItem.sourceURL,
        };

        if ("sid" in aItem) {
          clipping.sid = aItem.sid;
        }

        clippingsWithSrcURLs.push(clipping);

      }).then(() => {
        this._unsetClippingsUnchangedFlag();
        gCmd.undoStack.push({
          action: gCmd.ACTION_REMOVE_ALL_SRC_URLS,
          clippingsWithSrcURLs,
        });
        return gClippingsDB.clippings.toCollection().modify({sourceURL: ""});

      }).then(aNumUpd => {
        gDialog.removeAllSrcURLsConfirm.openPopup();

        if (gPrefs.syncClippings) {
          browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"})
              .catch(handlePushSyncItemsError);
        }
      });
    },


    async pasteClipping(aClippingID)
    {
      if (ENABLE_PASTE_CLIPPING) {
        log(`Clippings/wx::clippingsMgr.js: gCmd.pasteClipping(): clipping ID = ${aClippingID}`);

        let resp = await browser.runtime.sendMessage({
          msgID: "paste-clipping-by-name",
          clippingID: aClippingID,
          fromClippingsMgr: true
        });

        // Must close this window, or else pasting won't work!
        closeWnd();
      }
      else {
        warn("Clippings: clippingsMgr/cmds.js: gCmd.pasteClipping(): Action disabled");
      }
    },

    showShortcutList: function ()
    {
      gDialog.shortcutList.showModal(false);
    },

    insertCustomPlaceholder: function ()
    {
      gDialog.insCustomPlchldr.showModal();
    },

    insertNumericPlaceholder: function ()
    {
      gDialog.insAutoIncrPlchldr.showModal();
    },

    insertFormattedDateTimePlaceholder: function ()
    {
      gDialog.insDateTimePlchldr.showModal();
    },

    insertClippingInClippingPlaceholder()
    {
      let contentTextArea = $("#clipping-text");
      let arg = browser.i18n.getMessage("plchldrClipClipArg");
      let plchldr = "$[CLIPPING(" + arg + ")]";
      insertTextIntoTextbox(contentTextArea, plchldr);

      // Select the placeholder argument.
      contentTextArea[0].selectionStart = contentTextArea[0].selectionEnd - arg.length - 2;
      contentTextArea[0].selectionEnd -= 2;
    },

    showHidePlaceholderToolbar: function ()
    {
      let currSetting = gPrefs.clippingsMgrPlchldrToolbar;
      aePrefs.setPrefs({ clippingsMgrPlchldrToolbar: !currSetting });

      if (gIsClippingsTreeEmpty) {
        return;
      }

      let tree = aeClippingsTree.getTree();
      let selectedNode = tree.activeNode;
      if (! selectedNode) {
        return;
      }

      if (! selectedNode.isFolder()) {
        $("#placeholder-toolbar").toggle();
      }
    },

    showHideDetailsPane: function ()
    {
      let currSetting = gPrefs.clippingsMgrDetailsPane;
      aePrefs.setPrefs({ clippingsMgrDetailsPane: !currSetting });

      if (gIsClippingsTreeEmpty) {
        return;
      }

      let tree = aeClippingsTree.getTree();
      let selectedNode = tree.activeNode;
      if (! selectedNode) {
        return;
      }

      if (! selectedNode.isFolder()) {
        $("#source-url-bar, #options-bar").toggle();
      }
    },

    showHideStatusBar: function ()
    {
      $("#status-bar").toggle();
      let isVisible = $("#status-bar").css("display") != "none";
      recalcContentAreaHeight(isVisible);

      aePrefs.setPrefs({ clippingsMgrStatusBar: isVisible });
    },

    async toggleMaximize()
    {
      let wnd = await browser.windows.getCurrent();
      let updWndInfo = {
        state: (wnd.state == "maximized" ? "normal" : "maximized")
      };

      let updWnd = browser.windows.update(browser.windows.WINDOW_ID_CURRENT, updWndInfo);
      gIsMaximized = updWnd.state == "maximized";
    },

    toggleMinimizeWhenInactive()
    {
      let currSetting = gPrefs.clippingsMgrMinzWhenInactv;
      aePrefs.setPrefs({clippingsMgrMinzWhenInactv: !currSetting});
      $("#minz-when-inactv-mode").attr("data-checked", !currSetting);
    },

    openExtensionPrefs: function ()
    {
      browser.runtime.openOptionsPage();
    },

    backup: function ()
    {
      const INCLUDE_SRC_URLS = true;

      this.recentAction = this.ACTION_BACKUP;
      setStatusBarMsg(browser.i18n.getMessage("statusSavingBkup"));

      let excludeSyncFldrID = null;
      if (gPrefs.syncClippings) {
        excludeSyncFldrID = gPrefs.syncFolderID;
      }

      let blobData;
      aeImportExport.exportToJSON(INCLUDE_SRC_URLS, false, aeConst.ROOT_FOLDER_ID, excludeSyncFldrID, true, true).then(aJSONData => {
        blobData = new Blob([aJSONData], { type: "application/json;charset=utf-8"});

        gSuppressAutoMinzWnd = true;

        let filename = aeConst.CLIPPINGS_BACKUP_FILENAME;
        if (gPrefs.backupFilenameWithDate) {
          filename = aeConst.CLIPPINGS_BACKUP_FILENAME_WITH_DATE.replace("%s", moment().format("YYYY-MM-DD"));
        }

        browser.downloads.download({
          url: URL.createObjectURL(blobData),
          filename,
          saveAs: true

        }).then(aDownldItemID => {
          setStatusBarMsg(browser.i18n.getMessage("statusSavingBkupDone"));
          gSuppressAutoMinzWnd = false;

          return browser.downloads.search({ id: aDownldItemID });

        }).then(aDownldItems => {

          if (aDownldItems && aDownldItems.length > 0) {
            let backupFilePath = aDownldItems[0].filename;
            gDialog.backupConfirmMsgBox.setMessage(browser.i18n.getMessage("clipMgrBackupConfirm", backupFilePath));
            gDialog.backupConfirmMsgBox.showModal();
          }

        }).catch(aErr => {
          if (aErr.fileName == "undefined") {
            setStatusBarMsg();
          }
          else {
            console.error(aErr);
            setStatusBarMsg(browser.i18n.getMessage("statusSavingBkupFailed"));
            window.alert(browser.i18n.getMessage("backupError", aErr));
          }
          gSuppressAutoMinzWnd = false;
        });
      }).catch(aErr => {
        window.alert("Sorry, an error occurred during the backup.\n\nDetails:\n" + getErrStr(aErr));
        setStatusBarMsg(browser.i18n.getMessage("statusSavingBkupFailed"));
      });
    },


    backupExtern()
    {
      if (aeDialog.isOpen()) {
        // Don't interrupt any dialogs that may be open when the user clicked the
        // backup reminder notification.
        return;
      }

      this.backup();
    },


    async restoreFromBackup()
    {
      // Disallow if New Clipping dialog is open to prevent errors due to saving
      // a new clipping into a non-existent folder.
      let pingResp;
      try {
        pingResp = await browser.runtime.sendMessage({msgID: "ping-new-clipping-dlg"});
      }
      catch {}
      if (pingResp) {
        gDialog.actionUnavailable.openPopup();
        return;
      }

      gDialog.importFromFile.mode = gDialog.importFromFile.IMP_REPLACE;
      gDialog.importFromFile.showModal();
    },

    importFromFile: function ()
    {
      gDialog.importFromFile.mode = gDialog.importFromFile.IMP_APPEND;
      gDialog.importFromFile.showModal();
    },

    exportToFile: function ()
    {
      gDialog.exportToFile.showModal();
    },

    async reloadSyncFolder()
    {
      let pingResp;
      try {
        pingResp = await browser.runtime.sendMessage({msgID: "ping-new-clipping-dlg"});
      }
      catch {}

      if (pingResp) {
        gDialog.actionUnavailable.openPopup();
        return;
      }

      this.recentAction = this.ACTION_RELOAD_SYNC_FLDR;
      browser.runtime.sendMessage({
        msgID: "refresh-synced-clippings",
        rebuildClippingsMenu: false,
      });

      aeDialog.cancelDlgs();
      await this.reloadSyncFolderIntrl();
    },

    async reloadSyncFolderIntrl()
    {
      let afterSyncFldrReloadDelay = await aePrefs.getPref("afterSyncFldrReloadDelay");

      gDialog.syncProgress.showModal(false);

      setTimeout(async () => {
        await rebuildClippingsTree();
        gDialog.syncProgress.close();
      }, afterSyncFldrReloadDelay);
    },

    removeAllSrcURLs: function ()
    {
      gDialog.removeAllSrcURLs.showModal();
    },

    showMiniHelp: function ()
    {
      if ($("#intro-content").css("display") == "none") {
        gDialog.miniHelp.showModal();
      }
      else {
        gDialog.genericMsgBox.showModal();
      }
    },

    async undo()
    {
      let pingResp;
      try {
        pingResp = await browser.runtime.sendMessage({msgID: "ping-new-clipping-dlg"});
      }
      catch {}

      if (pingResp) {
        gDialog.actionUnavailable.openPopup();
        return;
      }

      if (this.undoStack.length == 0) {
        setTimeout(() => { gDialog.noUndoNotify.openPopup() }, 100);
        return;
      }

      let undo = this.undoStack.pop();

      if (undo.action == this.ACTION_DELETECLIPPING) {
        await this.moveClippingIntrl(undo.id, undo.parentFolderID);
        this.redoStack.push(undo);
      }
      else if (undo.action == this.ACTION_DELETEFOLDER) {
        await this.moveFolderIntrl(undo.id, undo.parentFolderID);
        this.redoStack.push(undo);
      }
      else if (undo.action == this.ACTION_MOVETOFOLDER) {
        if (undo.itemType == this.ITEMTYPE_CLIPPING) {
          await this.moveClippingIntrl(undo.id, undo.oldParentFldrID);
          this.redoStack.push(undo);
        }
        else if (undo.itemType == this.ITEMTYPE_FOLDER) {
          await this.moveFolderIntrl(undo.id, undo.oldParentFldrID);
          this.redoStack.push(undo);
        }
      }
      else if (undo.action == this.ACTION_COPYTOFOLDER) {
        if (undo.itemType == this.ITEMTYPE_CLIPPING) {
          await this.moveClippingIntrl(undo.id, aeConst.DELETED_ITEMS_FLDR_ID);
          this.redoStack.push(undo);
        }
        else if (undo.itemType == this.ITEMTYPE_FOLDER) {
          await this.moveFolderIntrl(undo.id, aeConst.DELETED_ITEMS_FLDR_ID);
          this.redoStack.push(undo);
        }
      }
      else if (undo.action == this.ACTION_CREATENEW
          || undo.action == this.ACTION_INSERT_SEPARATOR) {
        await this.moveClippingIntrl(undo.id, aeConst.DELETED_ITEMS_FLDR_ID);
        this.redoStack.push(undo);
      }
      else if (undo.action == this.ACTION_CREATENEWFOLDER) {
        await this.moveFolderIntrl(undo.id, aeConst.DELETED_ITEMS_FLDR_ID);
        this.redoStack.push(undo);
      }
      else if (undo.action == this.ACTION_EDITNAME) {
        if (undo.itemType == this.ITEMTYPE_CLIPPING) {
          this.editClippingNameIntrl(undo.id, undo.oldName).then(() => {
            let clpNode = aeClippingsTree.getTree().activateKey(undo.id + "C");
            clpNode.title = undo.oldName;
            $("#clipping-name").val(undo.oldName).trigger("select");
            this.redoStack.push(undo);
          }).catch(aErr => {});
        }
        else if (undo.itemType == this.ITEMTYPE_FOLDER) {
          this.editFolderNameIntrl(undo.id, undo.oldName).then(() => {
            let fldrNode = aeClippingsTree.getTree().activateKey(undo.id + "F");
            fldrNode.title = undo.oldName;
            $("#clipping-name").val(undo.oldName).trigger("select");
            this.redoStack.push(undo);
          }).catch(aErr => {});
        }
      }
      else if (undo.action == this.ACTION_EDITCONTENT) {
        this.editClippingContentIntrl(undo.id, undo.oldContent).then(() => {
          aeClippingsTree.getTree().activateKey(undo.id + "C");
          $("#clipping-text").val(undo.oldContent).trigger("select");
          this.redoStack.push(undo);
        }).catch(aErr => {});
      }
      else if (undo.action == this.ACTION_SETLABEL) {
        this.setLabelIntrl(undo.id, undo.oldLabel);
        this.redoStack.push(undo);
      }
      else if (undo.action == this.ACTION_CHANGEPOSITION) {
        let tree = aeClippingsTree.getTree();
        let itemNode = tree.getNodeByKey(undo.nodeKey);
        let parentFldrID = undo.parentFolderID;
        let redoNextSiblingNode = itemNode.getNextSibling();

        if (undo.nextSiblingNodeKey) {
          let nextSiblingNode = tree.getNodeByKey(undo.nextSiblingNodeKey);
          log(`Clippings/wx::clippingsMgr.js: gCmd.undo(): Reordering the tree node (key=${itemNode.key}), placing it before sibling node (key=${undo.nextSiblingNodeKey})`);
          log(`Current next sibling node key: ${(redoNextSiblingNode ? redoNextSiblingNode.key : null)} (this will be saved to the Redo stack)`)
          itemNode.moveTo(nextSiblingNode, "before");
        }
        else {
          if (parentFldrID == aeConst.ROOT_FOLDER_ID) {
            let rootFldrNode = tree.rootNode;
            log(`Clippings/wx::clippingsMgr.js: gCmd.undo(): Moving the tree node (key=${itemNode.key}) back to be the last node of the root folder.`);
            itemNode.moveTo(rootFldrNode, "child");
          }
          else {
            let parentFldrNodeKey = parentFldrID + "F";
            log(`Clippings/wx::clippingsMgr.js: gCmd.undo(): Moving the tree node (key=${itemNode.key}) back to be the last node of its parent (key=${parentFldrNodeKey}).`);
            let parentFldrNode = tree.getNodeByKey(parentFldrID + "F");
            itemNode.moveTo(parentFldrNode, "child");
          }
        }

        this.updateDisplayOrder(parentFldrID);

        undo.nextSiblingNodeKey = redoNextSiblingNode ? redoNextSiblingNode.key : null;
        if (gPrefs.syncClippings) {
          // Change the static ID of the next sibling node.
          if (redoNextSiblingNode) {
            for (let [key, value] of gSyncedItemsIDMap) {
              if (value == redoNextSiblingNode.key) {
                undo.nextSiblingSID = key;
                break;
              }
            }

          }
          else {
            delete undo.nextSiblingSID;
          }
        }

        this.redoStack.push(undo);
      }
      else if (undo.action == gCmd.ACTION_REMOVE_ALL_SRC_URLS) {
        let numUpdates = [];
        for (let clipping of undo.clippingsWithSrcURLs) {
          numUpdates.push(gClippingsDB.clippings.update(Number(clipping.id), {
            sourceURL: clipping.srcURL,
          }));
        }

        await Promise.all(numUpdates);
        this.redoStack.push(undo);
        gDialog.restoreSrcURLs.openPopup();

        if (gPrefs.syncClippings) {
          browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"})
              .catch(handlePushSyncItemsError);
        }
      }
    },

    async redo()
    {
      let pingResp;
      try {
        pingResp = await browser.runtime.sendMessage({msgID: "ping-new-clipping-dlg"});
      }
      catch {}

      if (pingResp) {
        gDialog.actionUnavailable.openPopup();
        return;
      }

      if (this.redoStack.length == 0) {
        setTimeout(() => { gDialog.noRedoNotify.openPopup() }, 100);
        return;
      }

      let redo = this.redoStack.pop();

      if (redo.action == this.ACTION_DELETECLIPPING) {
        await this.moveClippingIntrl(redo.id, aeConst.DELETED_ITEMS_FLDR_ID);
        this.undoStack.push(redo);
      }
      else if (redo.action == this.ACTION_DELETEFOLDER) {
        await this.moveFolderIntrl(redo.id, aeConst.DELETED_ITEMS_FLDR_ID);
        this.undoStack.push(redo);
      }
      else if (redo.action == this.ACTION_MOVETOFOLDER) {
        if (redo.itemType == this.ITEMTYPE_CLIPPING) {
          await this.moveClippingIntrl(redo.id, redo.newParentFldrID);
          this.undoStack.push(redo);
        }
        else if (redo.itemType == this.ITEMTYPE_FOLDER) {
          await this.moveFolderIntrl(redo.id, redo.newParentFldrID);
          this.undoStack.push(redo);
        }
      }
      else if (redo.action == this.ACTION_COPYTOFOLDER) {
        if (redo.itemType == this.ITEMTYPE_CLIPPING) {
          await this.moveClippingIntrl(redo.id, redo.destFldrID);
          this.undoStack.push(redo);
        }
        else if (redo.itemType == this.ITEMTYPE_FOLDER) {
          await this.moveFolderIntrl(redo.id, redo.destFldrID);
          this.undoStack.push(redo);
        }
      }
      else if (redo.action == this.ACTION_CREATENEW
          || redo.action == this.ACTION_INSERT_SEPARATOR) {
        await this.moveClippingIntrl(redo.id, redo.parentFldrID);
        this.undoStack.push(redo);
      }
      else if (redo.action == this.ACTION_CREATENEWFOLDER) {
        await this.moveFolderIntrl(redo.id, redo.parentFldrID);
        this.undoStack.push(redo);
      }
      else if (redo.action == this.ACTION_EDITNAME) {
        if (redo.itemType == this.ITEMTYPE_CLIPPING) {
          this.editClippingNameIntrl(redo.id, redo.name).then(() => {
            let clpNode = aeClippingsTree.getTree().activateKey(redo.id + "C");
            clpNode.title = redo.name;
            $("#clipping-name").val(redo.name).trigger("select");
            this.undoStack.push(redo);
          }).catch(aErr => {});
        }
        else if (redo.itemType == this.ITEMTYPE_FOLDER) {
          this.editFolderNameIntrl(redo.id, redo.name).then(() => {
            let fldrNode = aeClippingsTree.getTree().activateKey(redo.id + "F");
            fldrNode.title = redo.name;
            $("#clipping-name").val(redo.name).trigger("select");
            this.undoStack.push(redo);
          }).catch(aErr => {});
        }
      }
      else if (redo.action == this.ACTION_EDITCONTENT) {
        this.editClippingContentIntrl(redo.id, redo.content).then(() => {
          aeClippingsTree.getTree().activateKey(redo.id + "C");
          $("#clipping-text").val(redo.content).trigger("select");
          this.undoStack.push(redo);
        }).catch(aErr => {});
      }
      else if (redo.action == this.ACTION_SETLABEL) {
        this.setLabelIntrl(redo.id, redo.label);
        this.undoStack.push(redo);
      }
      else if (redo.action == this.ACTION_CHANGEPOSITION) {
        let tree = aeClippingsTree.getTree();
        let itemNode = tree.getNodeByKey(redo.nodeKey);
        let parentFldrID = redo.parentFolderID;
        let undoNextSiblingNode = itemNode.getNextSibling();;

        if (redo.nextSiblingNodeKey) {
          let nextSiblingNode = tree.getNodeByKey(redo.nextSiblingNodeKey);
          log(`Clippings/wx::clippingsMgr.js: gCmd.redo(): Reordering the tree node (key=${itemNode.key}), placing it before sibling node (key=${redo.nextSiblingNodeKey})`);
          itemNode.moveTo(nextSiblingNode, "before");
        }
        else {
          if (parentFldrID == aeConst.ROOT_FOLDER_ID) {
            let rootFldrNode = tree.rootNode;
            log(`Clippings/wx::clippingsMgr.js: gCmd.redo(): Moving the tree node (key=${itemNode.key}) back to be the last node of the root folder.`);
            itemNode.moveTo(rootFldrNode, "child");
          }
          else {
            let parentFldrNodeKey = parentFldrID + "F";
            log(`Clippings/wx::clippingsMgr.js: gCmd.redo(): Moving the tree node (key=${itemNode.key}) back to be the last node of its parent (key=${parentFldrNodeKey}).`);
            let parentFldrNode = tree.getNodeByKey(parentFldrID + "F");
            itemNode.moveTo(parentFldrNode, "child");
          }
        }

        this.updateDisplayOrder(parentFldrID);

        redo.nextSiblingNodeKey = undoNextSiblingNode ? undoNextSiblingNode.key : null;
        if (gPrefs.syncClippings) {
          // Change the static ID of the next sibling node.
          if (undoNextSiblingNode) {
            for (let [key, value] of gSyncedItemsIDMap) {
              if (value == undoNextSiblingNode.key) {
                redo.nextSiblingSID = key;
                break;
              }
            }
          }
          else {
            delete redo.nextSiblingSID;
          }
        }

        this.undoStack.push(redo);
      }
      else if (redo.action == this.ACTION_REMOVE_ALL_SRC_URLS) {
        let numUpdates = [];
        redo.clippingsWithSrcURLs.forEach(aClipping => {
          numUpdates.push(gClippingsDB.clippings.update(Number(aClipping.id), {sourceURL: ""}));
        });

        await Promise.all(numUpdates);
        this.undoStack.push(redo);
        gDialog.removeAllSrcURLsConfirm.openPopup();

        if (gPrefs.syncClippings) {
          browser.runtime.sendMessage({msgID: "push-sync-fldr-updates"})
              .catch(handlePushSyncItemsError);
        }
      }
    },


    //
    // Helper methods
    //

    _getParentFldrIDOfTreeNode: function (aNode)
    {
      let rv = null;
      let parentNode = aNode.getParent();
      rv = (parentNode.isRootNode() ? aeConst.ROOT_FOLDER_ID : parseInt(parentNode.key));

      return rv;
    },

    _copyFolderHelper: function (aSrcFldrID, aTargFldrID)
    {
      return new Promise((aFnResolve, aFnReject) => {
        gClippingsDB.transaction("rw", gClippingsDB.clippings, gClippingsDB.folders, () => {
          gClippingsDB.folders.where("parentFolderID").equals(aSrcFldrID).each((aItem, aCursor) => {
            let folderCpy = {
              name: aItem.name,
              parentFolderID: aTargFldrID,
            };
            gClippingsSvc.createFolder(folderCpy).then(aNewSubFldrID => {
              gClippingsListener.copiedItems.push({
                id: aNewSubFldrID,
                itemType: gCmd.ITEMTYPE_FOLDER,
                name: folderCpy.name,
                parentFolderID: folderCpy.parentFolderID,
              });
              this._copyFolderHelper(aItem.id, aNewSubFldrID);
            });

          }).then(() => {
            return gClippingsDB.clippings.where("parentFolderID").equals(aSrcFldrID).each((aItem, aCursor) => {
              let clippingCpy = {
                name: aItem.name,
                content: aItem.content,
                shortcutKey: "",
                sourceURL: aItem.sourceURL,
                label: aItem.label,
                parentFolderID: aTargFldrID,
              };
              gClippingsSvc.createClipping(clippingCpy).then(aNewClippingID => {
                gClippingsListener.copiedItems.push({
                  id: aNewClippingID,
                  itemType: gCmd.ITEMTYPE_CLIPPING,
                  name: clippingCpy.name,
                  parentFolderID: clippingCpy.parentFolderID,
                  label: clippingCpy.label,
                });
              });
            });
          }).then(() => {
            aFnResolve();
          });
        }).catch(aErr => {
          console.error("Clippings: clippingsMgr/cmds.js: gCmd._copyFolderHelper(): " + aErr);
          aFnReject(aErr);
        });
      });
    },

    _unsetClippingsUnchangedFlag()
    {
      if (gPrefs.clippingsUnchanged) {
        aePrefs.setPrefs({ clippingsUnchanged: false });
      }
    },

    _pushToUndoStack(aDestUndoStack, aState)
    {
      if (aDestUndoStack == this.UNDO_STACK) {
        this.undoStack.push(aState);
      }
      else if (aDestUndoStack == this.REDO_STACK) {
        this.redoStack.push(aState);
      }
    },
  };
}
