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

const DEBUG = true;

const DEFAULT_NEW_CLIPPING_NAME = "New Clipping";
const DEFAULT_NEW_FOLDER_NAME = "New Folder";
const DEFAULT_UNTITLED_CLIPPING_NAME = "Untitled Clipping";
const DEFAULT_UNTITLED_FOLDER_NAME = "Untitled Folder";

const ROOT_FOLDER_ID = 0;

var gOS;
var gClippingsDB;
var gClippings;
var gClippingsListener;
var gIsClippingsTreeEmpty;


$(document).ready(() => {
  gClippings = chrome.extension.getBackgroundPage();

  if (gClippings) {
    gClippingsDB = gClippings.getClippingsDB();
    log("Clippings/wx: clippingsMgr: Successfully opened Clippings DB");
  }
  else {
    showBanner("Error initializing Clippings Manager: Unable to locate parent browser window.");
  }

  chrome.runtime.getPlatformInfo(aInfo => { gOS = aInfo.os; });

  let clippingsListeners = gClippings.getClippingsListeners();
  
  gClippingsListener = {
    origin: clippingsListeners.ORIGIN_CLIPPINGS_MGR,
    
    // TO DO: Check if the clipping or folder was created outside Clippings
    // Manager; if so, always created them under the root level.
    
    newClippingCreated: function (aID, aData) {
      if (gIsClippingsTreeEmpty) {
        unsetEmptyClippingsState();
      }

      let tree = getClippingsTree();
      let selectedNode = tree.activeNode;
      let newNodeData = {
        key: aID + "C",
        title: aData.name
      };

      let newNode = null;

      if (selectedNode) {
        if (aData.parentFolderID == ROOT_FOLDER_ID) {
          newNode = tree.rootNode.addNode(newNodeData);
        }
        else {
          // TO DO: Why is getNodeByKey() sometimes returning null? (issue #89)
          let parentNode = tree.getNodeByKey(aData.parentFolderID + "F");
          newNode = parentNode.addNode(newNodeData);
        }
      }
      else {
        // No clippings or folders.
        newNode = tree.rootNode.addNode(newNodeData);
      }
      
      newNode.makeVisible().then(() => {
        newNode.setActive();
        $("#clipping-name").val(aData.name);
        $("#clipping-text").val("");
      });
    },

    newFolderCreated: function (aID, aData) {
      if (gIsClippingsTreeEmpty) {
        unsetEmptyClippingsState();
      }
      
      let tree = getClippingsTree();
      let selectedNode = tree.activeNode;
      let newNodeData = {
        key: aID + "F",
        title: aData.name,
        folder: true,
        children: []
      };

      let newNode = null;
    
      if (selectedNode) {
        if (aData.parentFolderID == ROOT_FOLDER_ID) {
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

      newNode.makeVisible().then(() => {
        newNode.setActive();
        $("#clipping-name").val(aData.name);
        $("#clipping-text").val("");
      });
    },

    clippingChanged: function (aID, aData, aOldData) {
      let tree = getClippingsTree();
      let changedNode = tree.getNodeByKey(aID + "C");

      changedNode.setTitle(aData.name);
      $("#clipping-name").val(aData.name);
    },

    folderChanged: function (aID, aData, aOldData) {
      let tree = getClippingsTree();
      let changedNode = tree.getNodeByKey(aID + "F");

      changedNode.setTitle(aData.name);
      $("#clipping-name").val(aData.name);
    },

    clippingDeleted: function (aID, aOldData) {
      this._removeClippingsTreeNode(aID + "C");
    },

    folderDeleted: function (aID, aOldData) {
      this._removeClippingsTreeNode(aID + "F");
    },

    afterBatchChanges: function () {
      window.location.reload();
    },

    // Helper method
    _removeClippingsTreeNode: function (aID) {
      let tree = getClippingsTree();
      let targetNode = tree.getNodeByKey(aID);
      let deletedNodeIdx = targetNode.getIndex();
      let prevSibNode = targetNode.getPrevSibling();
      let nextSibNode = targetNode.getNextSibling();
      let parentNode = targetNode.getParent();
      
      targetNode.remove();

      if (tree.count() == 0) {
        tree.options.icon = false;
        let emptyMsgNode = setEmptyClippingsState();
        tree.rootNode.addNode(emptyMsgNode);
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
    }
  };

  clippingsListeners.add(gClippingsListener);

  initToolbarButtons();
  initInstantEditing();
  initShortcutKeyMenu();
  initImport();
  buildClippingsTree();
});


$(window).on("beforeunload", function () {
  let clippingsListeners = gClippings.getClippingsListeners();
  clippingsListeners.remove(gClippingsListener);
});


function initToolbarButtons()
{
  $("#new-clipping").click(aEvent => {
    if (gIsClippingsTreeEmpty) {
      unsetEmptyClippingsState();
    }
    
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let parentFolderID = ROOT_FOLDER_ID;
    
    if (selectedNode) {
      let parentNode = selectedNode.getParent();
      parentFolderID = (parentNode.isRootNode() ? ROOT_FOLDER_ID : parseInt(parentNode.key));
    }

    let createClipping = gClippingsDB.clippings.add({
      name: DEFAULT_NEW_CLIPPING_NAME,
      content: "",
      shortcutKey: "",
      parentFolderID: parentFolderID,
      label: "",
      sourceURL: ""
    });

    createClipping.then(aNewClippingID => {
      // TO DO: Add new clipping creation to undo stack.
    });
  });

  $("#new-folder").click(aEvent => {
    if (gIsClippingsTreeEmpty) {
      unsetEmptyClippingsState();
    }

    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let parentFolderID = ROOT_FOLDER_ID;
    
    if (selectedNode) {
      let parentNode = selectedNode.getParent();
      parentFolderID = (parentNode.isRootNode() ? ROOT_FOLDER_ID : parseInt(parentNode.key));
    }
    
    let createFolder = gClippingsDB.folders.add({
      name: DEFAULT_NEW_FOLDER_NAME,
      parentFolderID: parentFolderID
    });

    createFolder.then(aNewFolderID => {
      // TO DO: Add new folder creation to undo stack.
    });
  });

  $("#delete").click(aEvent => {
    if (gIsClippingsTreeEmpty) {
      return;
    }

    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    if (! selectedNode) {
      return;
    }

    let id = parseInt(selectedNode.key);
    
    if (selectedNode.isFolder()) {
      gClippingsDB.folders.delete(id).then(() => {
        // TO DO: Add folder deletion to undo stack.
      });
    }
    else {
      gClippingsDB.clippings.delete(id).then(() => {
        // TO DO: Add clipping deletion to undo stack.
      });
    }
  });
}


function initInstantEditing()
{
  $("#clipping-name").blur(aEvent => {
    log("Clippings/wx::clippingsMgr.js: Blur event fired on clipping name textbox");
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let name = aEvent.target.value;
    let id = parseInt(selectedNode.key);

    if (selectedNode.isFolder()) {
      name = (name ? name : DEFAULT_UNTITLED_FOLDER_NAME);
      gClippingsDB.folders.update(id, { name });
    }
    else {
      name = (name ? name : DEFAULT_UNTITLED_CLIPPING_NAME);
      gClippingsDB.clippings.update(id, { name });
    }
  });
  
  $("#clipping-text").blur(aEvent => {
    log("Clippings/wx::clippingsMgr.js: Blur event fired on clipping content text area");
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let id = parseInt(selectedNode.key);

    if (! selectedNode.folder) {
      let text = aEvent.target.value;
      gClippingsDB.clippings.update(id, { content: text });
    }
  });
}


function getClippingsTree()
{
  let rv = $("#clippings-tree").fancytree("getTree");
  return rv;
}


function buildClippingsTree()
{
  let treeData = [];

  gClippingsDB.transaction("r", gClippingsDB.folders, gClippingsDB.clippings, () => {
    gClippingsDB.folders.where("parentFolderID").equals(ROOT_FOLDER_ID).each((aItem, aCursor) => {
      let folderNode = {
        key: aItem.id + "F",
        title: aItem.name,
        folder: true
      };

      let childNodes = buildClippingsTreeHelper(ROOT_FOLDER_ID, aItem);
      folderNode.children = childNodes;

      treeData.push(folderNode);
    }).then(() => {
      return gClippingsDB.clippings.where("parentFolderID").equals(ROOT_FOLDER_ID).each((aItem, aCursor) => {
        let clippingNode = {
          key: aItem.id + "C",
          title: aItem.name
        };

        treeData.push(clippingNode);
      });
    }).then(() => {
      if (treeData.length == 0) {
        treeData = setEmptyClippingsState();
      }
      
      $("#clippings-tree").fancytree({
        extensions: ["dnd5"],
        
        source: treeData,
        selectMode: 1,
        icon: (gIsClippingsTreeEmpty ? false : true),

        init: function (aEvent, aData) {
          let rootNode = aData.tree.getRootNode();
          if (rootNode.children.length > 0 && !gIsClippingsTreeEmpty) {
            rootNode.children[0].setActive();
          }
        },

        activate: function (aEvent, aData) {
          log("Clippings/wx::clippingsMgr.js: Activate event fired on clippings tree");
          updateDisplay(aEvent, aData);
        },

        dnd5: {
          preventRecursiveMoves: true,
          preventVoidMoves: true,
          scroll: true,

          dragStart: function (aNode, aData) {
            return true;
          },

          dragEnter: function (aNode, aData) {
            aData.dataTransfer.dropEffect = "move";
            return true;
          },

          dragDrop: function (aNode, aData) {
            if (aData.otherNode) {
              // Prevent dropping a node into a non-folder node.
              if (!aNode.isFolder() && aData.hitMode == "over") {
                return;
              }

              let parentNode = aNode.getParent();
              let newParentID = ROOT_FOLDER_ID;
              
              if (aNode.isFolder() && aData.hitMode == "over") {
                newParentID = parseInt(aNode.key);
              }
              else {
                newParentID = (parentNode.isRootNode() ? ROOT_FOLDER_ID : parseInt(parentNode.key));
              }

              aData.otherNode.moveTo(aNode, aData.hitMode);

              let id = parseInt(aData.otherNode.key);
              log("clippingsMgr: ID of moved clipping or folder: " + id + "\nID of new parent folder: " + newParentID);

              if (aData.otherNode.isFolder()) {
                gClippingsDB.folders.update(id, { parentFolderID: newParentID });
              }
              else {
                gClippingsDB.clippings.update(id, { parentFolderID: newParentID });
              }
            }
            else {
              // Drop a non-node
              let dndData = aData.dataTransfer.getData("text");
              parentNode.addNode({ title: dndData }, aData.hitMode);

              // TO DO: Create the clipping in the database.
            }
            aNode.setExpanded();
          }
        }          
      });
    });
  }).catch(aErr => {
    console.error("Clippings/wx::buildContextMenu(): Database transaction failed! %s", aErr.message);
  });
}


function buildClippingsTreeHelper(aParentFolderID, aFolderData)
{
  let rv = [];
  let folderID = aFolderData.id;

  gClippingsDB.transaction("r", gClippingsDB.folders, gClippingsDB.clippings, () => {
    gClippingsDB.folders.where("parentFolderID").equals(folderID).each((aItem, aCursor) => {
      let folderNode = {
        key: aItem.id,
        title: aItem.name,
        folder: true
      }
      let childNodes = buildClippingsTreeHelper(folderID, aItem);
      folderNode.children = childNodes;

      rv.push(folderNode);
    }).then(() => {
      gClippingsDB.clippings.where("parentFolderID").equals(folderID).each((aItem, aCursor) => {
        let clippingNode = {
          key: aItem.id,
          title: aItem.name
        };
        rv.push(clippingNode);
      });
    });
  }).catch(aErr => {
    console.error("Clippings/wx::clippingsMgr.js::buildClippingsTreeHelper(): Database transaction failed! %s", aErr.message);
  });

  return rv;
}


function setEmptyClippingsState()
{
  var rv;
  rv = [{ title: "No clippings found.", key: "0" }];
  gIsClippingsTreeEmpty = true;
  $("#clipping-name, #clipping-text, #options-bar").hide();
  
  return rv;
}


function unsetEmptyClippingsState()
{
  let tree = getClippingsTree();
  let emptyMsgNode = tree.getNodeByKey("0");
  emptyMsgNode.remove();
  tree.options.icon = true;
  gIsClippingsTreeEmpty = false;
  $("#clipping-name, #clipping-text, #options-bar").show();
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
        window.alert("The selected shortcut key has already been assigned to another clipping. Please select a different shortcut key.");

          // TO DO: Select the previously-selected drop-down menu option.
        return;
      }

      let selectedNode = getClippingsTree().getActiveNode();
      if (! selectedNode) {
        console.warn("Can't set shortcut key if there is no clipping selected.");
        return;
      }

      let clippingID = parseInt(selectedNode.key);
      gClippingsDB.clippings.update(clippingID, { shortcutKey });
    });
  });
}


function updateDisplay(aEvent, aData)
{
  if (gIsClippingsTreeEmpty) {
    $("#options-bar").hide()
    return;
  }

  log("Clippings/wx: clippingsMgr: Updating display...");

  let selectedItemID = parseInt(aData.node.key);

  if (aData.node.isFolder()) {
    let getFolder = gClippingsDB.folders.get(selectedItemID);
    getFolder.then(aResult => {
      $("#clipping-name").val(aResult.name);
      $("#clipping-text").val("").hide();

      $("#options-bar").hide()
      let shortcutKeyMenu = $("#clipping-key")[0];
      shortcutKeyMenu.selectedIndex = 0;
    });
  }
  else {
    let getClipping = gClippingsDB.clippings.get(selectedItemID);
    getClipping.then(aResult => {
      $("#clipping-name").val(aResult.name);
      $("#clipping-text").val(aResult.content).show();

      $("#options-bar").show()
      let shortcutKeyMenu = $("#clipping-key")[0];
      shortcutKeyMenu.selectedIndex = 0;
      
      for (let i = 0; i < shortcutKeyMenu.options.length; i++) {
        if (shortcutKeyMenu[i].text == aResult.shortcutKey) {
          shortcutKeyMenu.selectedIndex = i;
          break;
        }
      }
    });
  }
}


// TEMPORARY
function initImport()
{
  aeImportExport.setDatabase(gClippingsDB);
  $("#import-clippings-file-upload").on("change", aEvent => { uploadImportFile(aEvent.target.files); });
  log("Clippings Manager: Initialized temporary import UI.");
}


function uploadImportFile(aFileList)
{
  if (aFileList.length == 0) {
    return;
  }
  
  let importFile = aFileList[0];
  console.log("Clippings Manager: Selected import file: '%s'\nFile size: %d bytes", importFile.name, importFile.size);

  let fileReader = new FileReader();
  fileReader.addEventListener("load", aEvent => {
    let rawData = aEvent.target.result;

    if (importFile.name.endsWith(".json")) {
      aeImportExport.importFromJSON(rawData);
    }
    else if (importFile.name.endsWith(".rdf")) {
      aeImportExport.importFromRDF(rawData);
    }
  });

  fileReader.readAsText(importFile);
}
// END TEMPORARY



function showBanner(aMessage)
{
  let bannerElt = $("#banner");
  let bannerMsgElt = $("#banner-msg");

  bannerMsgElt.children().remove();
  bannerMsgElt.text(aMessage);
  bannerElt.css("display", "block");
}


function onError(aError)
{
  showBanner(aError.message);

  if (DEBUG) {
    console.error(aError.message);
  }
}


function log(aMessage)
{
  if (DEBUG) { console.log(aMessage); }
}


function info(aMessage)
{
  if (DEBUG) { console.info(aMessage); }
}


function warn(aMessage)
{
  if (DEBUG) { console.warn(aMessage); }
}
