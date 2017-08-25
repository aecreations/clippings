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

const DEFAULT_CLIPPING_NAME = "New Clipping";
const DEFAULT_FOLDER_NAME = "New Folder";

var gOS;
var gClippingsDB;
var gClippings;

var gClippingsListener;


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

    // TO DO: In all the "created" methods, check if the dummy "No clipping"
    // message appears; if so, then remove the node for the dummy message
    // and set icon = true on the Fancytree widget.
    
    newClippingCreated: function (aID, aData) {
      let tree = getClippingsTree();
      let selectedNode = tree.activeNode;
      let newNodeData = {
        key: aID,
        title: aData.name
      };

      if (selectedNode) {
        let parentNode = selectedNode.getParent();
        newNode = parentNode.addNode(newNodeData);
      }
      else {
        // No clippings or folders.
        newNode = tree.rootNode.addNode(newNodeData);
      }
      newNode.setActive();

      $("#clipping-name").val(aData.name);
      $("#clipping-text").val("");
    },

    newFolderCreated: function (aID, aData) {
      let tree = getClippingsTree();
      let selectedNode = tree.activeNode;
      let newNodeData = {
        key: aID,
        title: aData.name,
        folder: true,
        children: []
      };

      let newNode = null;
    
      if (selectedNode) {
        let parentNode = selectedNode.getParent();
        newNode = parentNode.addNode(newNodeData);
      }
      else {
        // No clippings or folders.
        newNode = tree.rootNode.addNode(newNodeData);
      }
      newNode.setActive();

      $("#clipping-name").val(aData.name);
      $("#clipping-text").val("");
      // TO DO: Hide the clipping content textbox.
    },

    clippingChanged: function (aID, aData, aOldData) {},

    folderChanged: function (aID, aData, aOldData) {},

    clippingDeleted: function (aID, aOldData) {},

    folderDeleted: function (aID, aOldData) {},
    
    importDone: function (aNumItems) {
      // TO DO: Rebuild the clippings tree.
    }
  };

  clippingsListeners.add(gClippingsListener);

  initToolbarButtons();
  initInstantEditing();
  buildClippingsTree();
});


$(window).on("beforeunload", function () {
  let clippingsListeners = gClippings.getClippingsListeners();
  clippingsListeners.remove(gClippingsListener);
});


function initToolbarButtons()
{
  $("#new-clipping").click(aEvent => {
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let parentFolderID = 0;
    
    if (selectedNode) {
      let parentNode = selectedNode.getParent();
      parentFolderID = (parentNode.isRootNode() ? 0 : Number(parentNode.key));
    }

    let createNewClipping = gClippingsDB.clippings.add({
      name: DEFAULT_CLIPPING_NAME,
      content: "",
      shortcutKey: "",
      parentFolderID: parentFolderID
    });

    createNewClipping.then(aNewClippingID => {
      // TO DO: Add new clipping creation to undo stack.
    });
  });

  $("#new-folder").click(aEvent => {
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let parentFolderID = 0;
    
    if (selectedNode) {
      let parentNode = selectedNode.getParent();
      parentFolderID = (parentNode.isRootNode() ? 0 : Number(parentNode.key));
    }
    
    let createNewFolder = gClippingsDB.folders.add({
      name: DEFAULT_FOLDER_NAME,
      parentFolderID: parentFolderID
    });

    createNewFolder.then(aNewFolderID => {
      // TO DO: Add new folder creation to undo stack.
    });
  });
}


function initInstantEditing()
{
  $("#clipping-name").blur(aEvent => {
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let name = aEvent.target.value;
    selectedNode.setTitle(name);

    let id = Number(selectedNode.key);

    if (selectedNode.isFolder()) {
      gClippingsDB.folders.update(id, { name: name });
    }
    else {
      gClippingsDB.clippings.update(id, { name: name });
    }
  });
  
  $("#clipping-text").blur(aEvent => {
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let id = Number(selectedNode.key);

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
    let populateFolders = gClippingsDB.folders.where("parentFolderID").equals(0).each((aItem, aCursor) => {
      let folderNode = {
        key: aItem.id,
        title: aItem.name,
        folder: true
      };

      let childNodes = buildClippingsTreeHelper(0, aItem);
      folderNode.children = childNodes;

      treeData.push(folderNode);
    });

    populateFolders.then(() => {
      let populateClippings = gClippingsDB.clippings.where("parentFolderID").equals(0).each((aItem, aCursor) => {
        let clippingNode = {
          key: aItem.id,
          title: aItem.name
        };

        treeData.push(clippingNode);
      });

      populateClippings.then(() => {
        let isNoClippingsMsg = false;
        
        if (treeData.length == 0) {
          treeData = [{ title: "No clippings found." }];
          isNoClippingsMsg = true;
        }
        
        $("#clippings-tree").fancytree({
          extensions: ["dnd5"],
          
          source: treeData,
          selectMode: 1,
          icon: (isNoClippingsMsg ? false : true),

          init: function (aEvent, aData) {
            let rootNode = aData.tree.getRootNode();
            if (rootNode.children.length > 0 && !isNoClippingsMsg) {
              rootNode.children[0].setActive();
            }
          },

          activate: function (aEvent, aData) {
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
                let newParentID = 0;
                
                if (aNode.isFolder() && aData.hitMode == "over") {
                  newParentID = Number(aNode.key);
                }
                else {
                  newParentID = (parentNode.isRootNode() ? 0 : Number(parentNode.key));
                }

                aData.otherNode.moveTo(aNode, aData.hitMode);

                let id = Number(aData.otherNode.key);
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
    let populateFolders = gClippingsDB.folders.where("parentFolderID").equals(folderID).each((aItem, aCursor) => {
      let folderNode = {
        key: aItem.id,
        title: aItem.name,
        folder: true
      }
      let childNodes = buildClippingsTreeHelper(folderID, aItem);
      folderNode.children = childNodes;

      rv.push(folderNode);
    });

    populateFolders.then(() => {
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


function updateDisplay(aEvent, aData)
{
  // TO DO: Don't do anything if there are no clippings.
  
  let selectedItemID = Number(aData.node.key);

  if (aData.node.isFolder()) {
    let getFolder = gClippingsDB.folders.get(selectedItemID);
    getFolder.then(aResult => {
      $("#clipping-name").val(aResult.name);
      $("#clipping-text").val("");
      // TO DO: Hide clipping content textbox.
    });
  }
  else {
    let getClipping = gClippingsDB.clippings.get(selectedItemID);
    getClipping.then(aResult => {
      $("#clipping-name").val(aResult.name);
      // TO DO: Show clipping content textbox.
      $("#clipping-text").val(aResult.content);
    });
  }
}



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
