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

var gOS;
var gClippingsDB;
var gClippings;

var gClippingsListener;


$(document).ready(() => {
  gClippings = chrome.extension.getBackgroundPage();

  if (gClippings) {
    gClippingsDB = gClippings.getClippingsDB();
    _log("Clippings/wx: clippingsMgr: Successfully opened Clippings DB");
  }
  else {
    showBanner("Error initializing Clippings Manager: Unable to locate parent browser window.");
  }

  chrome.runtime.getPlatformInfo(aInfo => { gOS = aInfo.os; });

  let clippingsListeners = gClippings.getClippingsListeners();
  
  gClippingsListener = {
    origin: clippingsListeners.ORIGIN_CLIPPINGS_MGR,

    newClippingCreated: function (aClippingID) {
      // TO DO: Check for clipping created outside Clippings Manager.
      // If so, then select it in the tree list and push to undo stack.
    },

    newFolderCreated: function (aFolderID) {
      // TO DO: Check for folder created outside Clippings Manager.
      // If so, then select it in the tree list and push to undo stack.
    },

    clippingChanged: function (aClippingID) {},

    folderChanged: function (aFolderID) {},

    clippingDeleted: function (aClippingID) {},

    folderDeleted: function (aFolderID) {},
    
    importDone: function (aNumItems) {
      // TO DO: Rebuild the clippings tree.
    }
  };

  clippingsListeners.add(gClippingsListener);
  
  gClippingsDB.clippings.count().then(aResult => {
    console.log("Number of clippings at root folder level: " + aResult);
    let numClippingsInRoot = aResult;
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
      let getClipping = gClippingsDB.clippings.get(selectedItemID);
      
      getClipping.then(aResult => {
        $("#clipping-name").val(aResult.name);
	$("#clipping-text").val(aResult.content);
      });
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
  showBanner(aError);
}


function _log(aMessage)
{
  if (DEBUG) {
    console.log(aMessage);
  }
}
