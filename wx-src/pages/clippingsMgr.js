/* -*- mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
        title: aData.name,
        folder: false
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
        folder: true
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
  
  gClippingsDB.clippings.count().then(aResult => {
    let numClippingsInRoot = aResult;

    $("#status-bar-msg").text(numClippingsInRoot + " items");

    if (numClippingsInRoot > 0) {
      buildClippingsTree();
    }
    else {
      $("#clippings-tree").fancytree({
        source: [{title: "No clippings found.", key: 0}],
        icon: false
      });
    }
  }, onError);
  
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
    let id = Number(selectedNode.key);

    let name = aEvent.target.value;
    selectedNode.setTitle(name);

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

  let getRootClippings = gClippingsDB.clippings.where("parentFolderID").equals(0).each((aItem, aCursor) => {
    let treeNode = {
      key: aItem.id,
      title: aItem.name
    };

    treeData.push(treeNode);
  });

  getRootClippings.then(() => {
    $("#clippings-tree").fancytree({
      source: treeData,
      selectMode: 1,
      icon: true,

      init: function (aEvent, aData) {
        let rootNode = aData.tree.getRootNode();
        if (rootNode.children.length > 0) {
          rootNode.children[0].setActive();
        }
      },

      activate: function (aEvent, aData) {
        updateDisplay(aEvent, aData);
      }
    });
  });
}


function updateDisplay(aEvent, aData)
{
  gClippingsDB.clippings.count().then(aResult => {
    let numClippingsInRoot = aResult;

    if (numClippingsInRoot > 0) {
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
  });
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
