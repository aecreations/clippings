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

let gClippingsDB = null;
let gClippings = null;
let gParentFolderID = 0;


$(document).ready(() => {
  gClippings = chrome.extension.getBackgroundPage();

  if (gClippings) {
    gClippingsDB = gClippings.getClippingsDB();
  }
  else {
    console.error("Clippings/wx::new.js: Error initializing dialog - unable to locate parent browser window.");
    return;
  }

  if (gClippings.isGoogleChrome()) {
    chrome.runtime.sendMessage({ msgID: "init-new-clippings-dlg" }, aResp => {
      // TO DO: Same logic as for Firefox.
    });
  }
  else {
    // Firefox
    let sendMsg = browser.runtime.sendMessage({
      msgID: "init-new-clippings-dlg"
    });

    sendMsg.then(aResp => {
      if (! aResp) {
        console.warn("Clippings/wx::new.js: No response was received from the background script!");
        return;
      }

      $("#clipping-name").val(aResp.name).select().focus();
      $("#clipping-text").val(aResp.content);
    });
  }

  $("#clipping-name").blur(aEvent => {
    let name = aEvent.target.value;
    if (! name) {
      $("#clipping-name").val("New Clipping");
    }
  });

  initFolderPicker();
  initShortcutKeyMenu();
  
  $("#btn-accept").click(aEvent => { accept(aEvent) });
  $("#btn-cancel").click(aEvent => { cancel(aEvent) });
});


$(window).keypress(aEvent => {
  if (aEvent.key == "Enter") {
    accept(aEvent);
  }
  else if (aEvent.key == "Escape") {
    cancel(aEvent);
  }
});


function initFolderPicker()
{
  $("#folder-tree-btn").click(aEvent => {
    let popup = $("#folder-tree-popup");

    if (popup.css("visibility") == "hidden") {
      popup.css({ visibility: "visible" });
    }
    else {
      popup.css({ visibility: "hidden" });
    }
  });

  let treeData = [
    {
      title: "Clippings",
      key: 0,
      folder: true,
      expanded: true,
      children: []
    }
  ];

  let populateFolders = gClippingsDB.folders.where("parentFolderID").equals(0).each((aItem, aCursor) => {
    let folderNode = {
      key: aItem.id,
      title: aItem.name,
      folder: true
    };

    folderNode.children = buildFolderTree(0, aItem);
    treeData[0].children.push(folderNode);
  });

  populateFolders.then(() => {
    $("#folder-tree").fancytree({
      source: treeData,
      selectMode: 1,
      icon: true,

      init: function (aEvent, aData) {
        aData.tree.getRootNode().children[0].setActive();
      },

      click: function (aEvent, aData) {
        if (aData.targetType == "icon" || aData.targetType == "title") {
          selectFolder(aData);
          let popup = $("#folder-tree-popup");
          popup.css({ visibility: "hidden" });
        }
      }
    });
  });
}


function buildFolderTree(aParentFolderID, aFolderData)
{
  let rv = [];
  let folderID = aFolderData.id;

  gClippingsDB.folders.where("parentFolderID").equals(folderID).each((aItem, aCursor) => {
    let folderNode = {
      key: aItem.id,
      title: aItem.name,
      folder: true
    }

    folderNode.children = buildFolderTree(folderID, aItem);    
    rv.push(folderNode);
  });

  return rv;
}


function initShortcutKeyMenu()
{
  let shortcutKeyMenu = $("#clipping-key")[0];

  let assignedKeysLookup = {};
  gClippingsDB.clippings.where("shortcutKey").notEqual("").each((aItem, aCursor) => {
    assignedKeysLookup[aItem.shortcutKey] = 1;
  }).then(() => {
    for (let option of shortcutKeyMenu.options) {
      if (assignedKeysLookup[option.text]) {
        option.setAttribute("disabled", "true");
        option.setAttribute("title", `'${option.text}' is already assigned`);
      }
    }
  });
}


function selectFolder(aData)
{
  gParentFolderID = Number(aData.node.key);
  $("#folder-tree-btn").text(aData.node.title);
}


function accept(aEvent)
{
  let shortcutKeyMenu = $("#clipping-key")[0];
  let shortcutKey = "";

  if (shortcutKeyMenu.selectedIndex != 0) {
    shortcutKey = shortcutKeyMenu.options[shortcutKeyMenu.selectedIndex].text;
  }

  let createClipping = gClippingsDB.clippings.add({
    name: $("#clipping-name").val(),
    content: $("#clipping-text").val(),
    shortcutKey: shortcutKey,
    parentFolderID: gParentFolderID,
    label: "",
    sourceURL: ""
  });

  createClipping.then(aID => {
    chrome.windows.remove(chrome.windows.WINDOW_ID_CURRENT);
  }, aErr => {
    window.alert("Error creating clipping: " + aErr);
  });
}


function cancel(aEvent)
{
  chrome.windows.remove(chrome.windows.WINDOW_ID_CURRENT);
}


function alertEx(aMessage)
{
  $.Zebra_Dialog(aMessage, {
    type: "warning",
    width: 360,
    show_close_button: false,
    center_buttons: true,
    overlay_close: false,
    animation_speed_show: 0,
    animation_speed_hide: 0
  });
}
