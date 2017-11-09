/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let gClippingsDB = null;
let gClippings = null;
let gParentFolderID = 0;
let gSrcURL = "";
let gCreateInFldrMenu;
let gFolderPickerPopup;
let gNewFolderDlg;


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

  initDialogs();
  initFolderPicker();
  initShortcutKeyMenu();

  $("#new-folder-btn").click(aEvent => { gNewFolderDlg.showModal() });
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


function initDialogs()
{
  gNewFolderDlg = new aeDialog("new-folder-dlg");
  gNewFolderDlg.fldrTree = null;
  gNewFolderDlg.selectedFldrNode = null;
  
  let that = gNewFolderDlg;
  gNewFolderDlg.setInit(() => {
    if (that.fldrTree) {
      that.fldrTree.getTree().getNodeByKey(Number(aeConst.ROOT_FOLDER_ID).toString()).setActive();
    }
    else {
      that.fldrTree = new aeFolderPicker("#new-folder-dlg-fldr-tree", gClippingsDB);
      that.fldrTree.setOnSelectFolder(aFolderData => {
         that.selectedFldrNode = aFolderData.node;
      });
    }

    $("#new-fldr-name").on("blur", aEvent => {
      if (! aEvent.target.value) {
        aEvent.target.value = "New Folder";
      }
    });

    $("#new-fldr-name").val("New Folder").select().focus();
  });
  
  gNewFolderDlg.setCancel();
  gNewFolderDlg.setAccept(aEvent => {
    let newFldrDlgTree = that.fldrTree.getTree();
    let parentFldrID = aeConst.ROOT_FOLDER_ID;

    if (that.selectedFldrNode) {
      parentFldrID = Number(that.selectedFldrNode.key);
    }

    console.log("The folder '%s' will be created under the folder whose ID is %s", $("#new-fldr-name").val(), parentFldrID);
    
    gClippingsDB.folders.add({
      name: $("#new-fldr-name").val(),
      parentFolderID: parentFldrID
    }).then(aFldrID => {
      let newFldrName = $("#new-fldr-name").val();
      
      // Update the folder tree in the main dialog.
      let newFldrNodeData = {
        key: aFldrID,
        title: newFldrName,
        folder: true,
        children: []
      };

      let mainFldrTree = gFolderPickerPopup.getTree();
      let parentNode;

      if (parentFldrID == aeConst.ROOT_FOLDER_ID) {
        parentNode = mainFldrTree.getRootNode();
      }
      else {
        parentNode = mainFldrTree.getNodeByKey(Number(parentFldrID).toString());
      }

      let newFldrNode = parentNode.addNode(newFldrNodeData);
      newFldrNode.setActive();

      $("#new-clipping-fldr-picker-menubtn").text(newFldrName).val(aFldrID);

      gParentFolderID = aFldrID;
      that.close();
    });
  });

  gNewFolderDlg.setUnload(() => {
    $("#new-folder-dlg-fldr-tree > .fancytree-container")[0].scrollTop = 0;
  });
}


function initFolderPicker()
{
  $(".folder-picker-menubtn").click(aEvent => {
    let popup = $(".folder-tree-popup");

    if (popup.css("visibility") == "hidden") {
      popup.css({ visibility: "visible" });
    }
    else {
      popup.css({ visibility: "hidden" });
    }
  });

  gFolderPickerPopup = new aeFolderPicker("#new-clipping-fldr-tree", gClippingsDB);
  gFolderPickerPopup.setOnSelectFolder(selectFolder);
}


function selectFolder(aFolderData)
{
  gParentFolderID = Number(aFolderData.node.key);
  $("#new-clipping-fldr-picker-menubtn").text(aFolderData.node.title).val(gParentFolderID);
  $("#new-clipping-fldr-tree-popup").css({ visibility: "hidden" });
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
