/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let gClippingsDB = null;
let gClippings = null;
let gParentFolderID = 0;
let gSrcURL = "";


$(document).ready(() => {
  chrome.history.deleteUrl({ url: window.location.href });

  gClippings = chrome.extension.getBackgroundPage();

  if (gClippings) {
    gClippingsDB = gClippings.getClippingsDB();
  }
  else {
    console.error("Clippings/wx::new.js: Error initializing dialog - unable to locate parent browser window.");
    return;
  }

  if (gClippings.isGoogleChrome()) {
    chrome.runtime.sendMessage({ msgID: "init-new-clipping-dlg" }, aResp => {
      // TO DO: Same logic as for Firefox.
    });
  }
  else {
    // Firefox
    let sendMsg = browser.runtime.sendMessage({
      msgID: "init-new-clipping-dlg"
    });

    sendMsg.then(aResp => {
      if (! aResp) {
        console.warn("Clippings/wx::new.js: No response was received from the background script!");
        return;
      }

      $("#clipping-name").val(aResp.name).select().focus();
      $("#clipping-text").val(aResp.content);
      $("#save-source-url").prop("checked", aResp.saveSrcURL);
      gSrcURL = aResp.url || "";
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


// TO DO: Consider moving the folder picker code to its own object.
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

  initFolderTree("#folder-tree");
}


function initFolderTree(aTreeEltSelector)  
{
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
    $(aTreeEltSelector).fancytree({
      source: treeData,
      selectMode: 1,
      icon: true,

      init: function (aEvent, aData) {
        aData.tree.getRootNode().children[0].setActive();
      },

      click: function (aEvent, aData) {
        if (aData.targetType == "icon" || aData.targetType == "title") {
          selectFolder(aData);
          let popup = $(aTreeEltSelector).parent();
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
    sourceURL: ($("#save-source-url")[0].checked ? gSrcURL : "")
  });

  createClipping.then(aID => {
    closeDlg();
  }, aErr => {
    window.alert("Error creating clipping: " + aErr);
  });
}


function cancel(aEvent)
{
  closeDlg();
}


function closeDlg()
{
  browser.runtime.sendMessage({ msgID: "close-new-clipping-dlg" });
  chrome.windows.remove(chrome.windows.WINDOW_ID_CURRENT);
}
