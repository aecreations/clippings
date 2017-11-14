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

  $("#btn-expand-options").click(aEvent => {
    chrome.windows.getCurrent(aWnd => {
      chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { height: 480 }, aWnd => {
        $("#clipping-options").show();
        $("#new-clipping-fldr-tree-popup").addClass("new-clipping-fldr-tree-popup-fixpos");
      });
    });
  });
  
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

  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  browser.windows.getCurrent((win) => {
    browser.windows.update(win.id, {width:win.width+1})
  });
});


$(window).keypress(aEvent => {
  if (aEvent.key == "Enter") {
    if (aeDialog.isOpen()) {
      aeDialog.acceptDlgs();
      return;
    }
    accept(aEvent);
  }
  else if (aEvent.key == "Escape") {
    if (aeDialog.isOpen()) {
      aeDialog.cancelDlgs();
      return;
    }
    cancel(aEvent);
  }
});


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


function initDialogs()
{
  gNewFolderDlg = new aeDialog("new-folder-dlg");
  gNewFolderDlg.firstInit = true;
  gNewFolderDlg.fldrTree = null;
  gNewFolderDlg.selectedFldrNode = null;

  let that = gNewFolderDlg;
  gNewFolderDlg.resetTree = function () {
    let fldrTree = that.fldrTree.getTree();
    fldrTree.clear();
    that.fldrTree = null;
    that.selectedFldrNode = null;

    // Remove and recreate the Fancytree <div> element.
    $("#new-folder-dlg-fldr-tree").children().remove();
    let parentElt = $("#new-folder-dlg-fldr-tree").parent();
    parentElt.children("#new-folder-dlg-fldr-tree").remove();
    $('<div id="new-folder-dlg-fldr-tree" class="folder-tree"></div>').appendTo("#new-folder-dlg-fldr-tree-popup");
  };
  
  gNewFolderDlg.setInit(() => {
    let parentDlgFldrPickerMnuBtn = $("#new-clipping-fldr-picker-menubtn");
    let fldrPickerMnuBtn = $("#new-folder-dlg-fldr-picker-mnubtn");
    let fldrPickerPopup = $("#new-folder-dlg-fldr-tree-popup");
    let selectedFldrID = parentDlgFldrPickerMnuBtn.val();
    let selectedFldrName = parentDlgFldrPickerMnuBtn.text();

    that.fldrTree = new aeFolderPicker(
      "#new-folder-dlg-fldr-tree",
      gClippingsDB,
      selectedFldrID
    );

    that.fldrTree.setOnSelectFolder(aFolderData => {
      that.selectedFldrNode = aFolderData.node;
      fldrPickerMnuBtn.val(aFolderData.node.key).text(aFolderData.node.title);
      fldrPickerPopup.css({ visibility: "hidden" });
    });

    fldrPickerMnuBtn.val(selectedFldrID).text(selectedFldrName);

    if (that.firstInit) {
      fldrPickerMnuBtn.click(aEvent => {
        if (fldrPickerPopup.css("visibility") == "visible") {
          fldrPickerPopup.css({ visibility: "hidden" });
        }
        else {
          fldrPickerPopup.css({ visibility: "visible" });
        }
      })
      
      $("#new-fldr-name").on("blur", aEvent => {
        if (! aEvent.target.value) {
          aEvent.target.value = "New Folder";
        }
      });
      
      that.firstInit = false;
    }

    $("#new-fldr-name").val("New Folder").select().focus();
  });
  
  gNewFolderDlg.setCancel();
  gNewFolderDlg.setAccept(aEvent => {
    let newFldrDlgTree = that.fldrTree.getTree();
    let parentFldrID = aeConst.ROOT_FOLDER_ID;

    if (that.selectedFldrNode) {
      parentFldrID = Number(that.selectedFldrNode.key);
    }
    else {
      // User didn't choose a different parent folder.
      parentFldrID = $("#new-folder-dlg-fldr-picker-mnubtn").val();
    }

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

      that.resetTree();
      that.close();
    });
  });
}


function initFolderPicker()
{
  $("#new-clipping-fldr-picker-menubtn").click(aEvent => {
    let popup = $("#new-clipping-fldr-tree-popup");

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

  let keybPasteKey = "ALT+SHIFT+Y";
  if (gClippings.getOS() == "mac") {
    keybPasteKey = "\u2325\u21e7Y";
  }
  let tooltip = `To quickly paste this clipping into a web page textbox in Firefox, press ${keybPasteKey} followed by the shortcut key.`;
  $("#shct-key-tooltip").attr("title", tooltip);
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
