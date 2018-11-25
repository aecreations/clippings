/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const WNDH_OPTIONS_EXPANDED = 450;
const DLG_HEIGHT_ADJ_WINDOWS = 32;

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
    // gClippingsDB is null if Private Browsing mode is turned on.
    console.error("Clippings/wx::new.js: Error initializing New Clipping dialog - unable to locate parent browser window.");
    showInitError();
    return;
  }

  gClippings.verifyDB().then(aNumClippings => {
    initHelper();
  }).catch(aErr => {
    showInitError();
  });
});


function initHelper()
{
  $("#btn-expand-options").click(aEvent => {
    chrome.windows.getCurrent(aWnd => {
      let height = WNDH_OPTIONS_EXPANDED;
      if (gClippings.getOS() == "win") {
        height += DLG_HEIGHT_ADJ_WINDOWS;
      }
      
      chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { height }, aWnd => {
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
      $("#clipping-text").val(aResp.content).attr("spellcheck", aResp.checkSpelling);
      $("#save-source-url").prop("checked", aResp.saveSrcURL);
      gSrcURL = aResp.url || "";
    });
  }

  $("#clipping-name").blur(aEvent => {
    let name = aEvent.target.value;
    if (! name) {
      $("#clipping-name").val(chrome.i18n.getMessage("newFolder"));
    }
  });

  initDialogs();
  initFolderPicker();
  initLabelPicker();
  initShortcutKeyMenu();

  $("#new-folder-btn").click(aEvent => { gNewFolderDlg.showModal() });
  $("#btn-accept").click(aEvent => { accept(aEvent) });
  $("#btn-cancel").click(aEvent => { cancel(aEvent) });

  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  browser.windows.getCurrent(aWnd => {
    browser.windows.update(aWnd.id, {
      width: aWnd.width + 1,
      focused: true,
    });
  });
}


$(window).keypress(aEvent => {
  const isMacOS = gClippings.getOS() == "mac";

  function isAccelKeyPressed()
  {
    if (isMacOS) {
      return aEvent.metaKey;
    }
    return aEvent.ctrlKey;
  }

  function isTextboxFocused(aEvent)
  {
    return (aEvent.target.tagName == "INPUT" || aEvent.target.tagName == "TEXTAREA");
  }

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
  else if (aEvent.key == "/") {
    if (! isTextboxFocused(aEvent)) {
      aEvent.preventDefault();
    }
  }
  else if (aEvent.key == "F5") {
    // Suppress browser reload.
    aEvent.preventDefault();
  }
  else {
    // Ignore standard browser shortcut keys.
    let key = aEvent.key.toUpperCase();
    if (isAccelKeyPressed() && (key == "D" || key == "F" || key == "N" || key == "P"
                                || key == "R" || key == "S" || key == "U")) {
      aEvent.preventDefault();
    }
  }
});


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


// Google Chrome only.
$(window).on("unhandledrejection", aEvent => {
  aEvent.preventDefault();
  showInitError();
});


function showInitError()
{
  let errorMsgBox = new aeDialog("#create-clipping-error-msgbox");
  errorMsgBox.onInit = () => {
    let errMsgElt = $("#create-clipping-error-msgbox > .dlg-content > .msgbox-error-msg");
    errMsgElt.text(chrome.i18n.getMessage("initError"));
  };
  errorMsgBox.onAccept = () => {
    errorMsgBox.close();
    closeDlg();
  };
  errorMsgBox.showModal();
}


function initDialogs()
{
  gNewFolderDlg = new aeDialog("#new-folder-dlg");
  gNewFolderDlg.firstInit = true;
  gNewFolderDlg.fldrTree = null;
  gNewFolderDlg.selectedFldrNode = null;

  gNewFolderDlg.resetTree = function () {
    let that = gNewFolderDlg;
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
  
  gNewFolderDlg.onInit = () => {
    let that = gNewFolderDlg;
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

    that.fldrTree.onSelectFolder = aFolderData => {
      that.selectedFldrNode = aFolderData.node;

      let fldrID = aFolderData.node.key;
      fldrPickerMnuBtn.val(fldrID).text(aFolderData.node.title);

      if (fldrID == gClippings.getSyncFolderID()) {
        fldrPickerMnuBtn.attr("syncfldr", "true");
      }
      else {
        fldrPickerMnuBtn.removeAttr("syncfldr");
      }
      
      fldrPickerPopup.css({ visibility: "hidden" });
      $("#new-folder-dlg-fldr-tree-popup-bkgrd-ovl").hide();
    };

    fldrPickerMnuBtn.val(selectedFldrID).text(selectedFldrName);
    if (selectedFldrID == gClippings.getSyncFolderID()) {
      fldrPickerMnuBtn.attr("syncfldr", "true");
    }
    else {
      fldrPickerMnuBtn.removeAttr("syncfldr");
    }

    if (that.firstInit) {
      fldrPickerMnuBtn.click(aEvent => {
        if (fldrPickerPopup.css("visibility") == "visible") {
          fldrPickerPopup.css({ visibility: "hidden" });
          $("#new-folder-dlg-fldr-tree-popup-bkgrd-ovl").hide();
        }
        else {
          fldrPickerPopup.css({ visibility: "visible" });
          $("#new-folder-dlg-fldr-tree-popup-bkgrd-ovl").show();
        }
      })
      
      $("#new-fldr-name").on("blur", aEvent => {
        if (! aEvent.target.value) {
          aEvent.target.value = chrome.i18n.getMessage("newFolder");
        }
      });
      
      that.firstInit = false;
    }

    $("#new-fldr-name").val(chrome.i18n.getMessage("newFolder"));
  };

  gNewFolderDlg.onShow = () => {
    $("#new-fldr-name").select().focus();
  };
  
  gNewFolderDlg.onAccept = aEvent => {
    let that = gNewFolderDlg;
    let newFldrDlgTree = that.fldrTree.getTree();
    let parentFldrID = aeConst.ROOT_FOLDER_ID;

    if (that.selectedFldrNode) {
      parentFldrID = Number(that.selectedFldrNode.key);
    }
    else {
      // User didn't choose a different parent folder.
      parentFldrID = Number($("#new-folder-dlg-fldr-picker-mnubtn").val());
    }

    console.log("Clippings/wx::new.js: gNewFolderDlg.onAccept(): parentFldrID = " + parentFldrID);

    let numItemsInParent = 0;  // For calculating display order of new folder.

    gClippingsDB.transaction("rw", gClippingsDB.clippings, gClippingsDB.folders, () => {
      gClippingsDB.folders.where("parentFolderID").equals(parentFldrID).count().then(aNumFldrs => {
        numItemsInParent += aNumFldrs;
        return gClippingsDB.clippings.where("parentFolderID").equals(parentFldrID).count();
        
      }).then(aNumClippings => {
        numItemsInParent += aNumClippings;

        return gClippingsDB.folders.add({
          name: $("#new-fldr-name").val(),
          parentFolderID: parentFldrID,
          displayOrder: numItemsInParent,
        });
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
          parentNode = mainFldrTree.rootNode.getFirstChild();
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
    }).catch(aErr => {
      window.alert(aErr);
    });
  };
}


function initFolderPicker()
{
  // Initialize the hidden background that user can click on to dismiss an open
  // folder picker popup.
  $(".popup-bkgrd").click(aEvent => {
    // TO DO: Why are we using `visibility' and not `display'??
    $(".folder-tree-popup").css({ visibility: "hidden" });
    $(".popup-bkgrd").hide();
  });

  // Initialize the folder picker in the main New Clipping dialog.
  $("#new-clipping-fldr-picker-menubtn").click(aEvent => {
    let popup = $("#new-clipping-fldr-tree-popup");

    if (popup.css("visibility") == "hidden") {
      popup.css({ visibility: "visible" });
      $(".popup-bkgrd").show();
    }
    else {
      popup.css({ visibility: "hidden" });
      $(".popup-bkgrd").hide();
    }
  });

  // Set the width of the folder picker drop-down to match the width of the menu
  // button that opens it.
  let menuBtnStyle = window.getComputedStyle($("#new-clipping-fldr-picker-menubtn")[0]);
  let menuBtnWidth = parseInt(menuBtnStyle.width);
  
  // Need to add 1px to the popup width to compensate for having to add 1 pixel
  // to the width of the New Clipping popup window.
  $("#new-clipping-fldr-tree-popup").css({ width: `${menuBtnWidth + 1}px` });
  
  $("#new-folder-btn").attr("title", chrome.i18n.getMessage("btnNewFolder"));

  gFolderPickerPopup = new aeFolderPicker("#new-clipping-fldr-tree", gClippingsDB);
  gFolderPickerPopup.onSelectFolder = selectFolder;
}


function selectFolder(aFolderData)
{
  gParentFolderID = Number(aFolderData.node.key);
  
  let fldrPickerMenuBtn = $("#new-clipping-fldr-picker-menubtn");
  fldrPickerMenuBtn.text(aFolderData.node.title).val(gParentFolderID);

  if (gParentFolderID == gClippings.getSyncFolderID()) {
    fldrPickerMenuBtn.attr("syncfldr", "true");
  }
  else {
    fldrPickerMenuBtn.removeAttr("syncfldr");
  }
  
  $("#new-clipping-fldr-tree-popup").css({ visibility: "hidden" });
  $(".popup-bkgrd").hide();
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
        option.setAttribute("title", chrome.i18n.getMessage("shortcutKeyAssigned", option.text));
      }
    }
  });

  let keybPasteKeys = gClippings.getShortcutKeyPrefixStr();
  let tooltip = chrome.i18n.getMessage("shortcutKeyHint", keybPasteKeys);
  $("#shct-key-tooltip").attr("title", tooltip);
}


function initLabelPicker()
{
  $("#clipping-label-picker").on("change", aEvent => {
    let label = aEvent.target.value;
    let bgColor = label;
    let fgColor = "white";

    if (! label) {
      bgColor = "white";
      fgColor = "initial";
    }
    else if (label == "yellow") {
      fgColor = "initial";
    }
    $(aEvent.target).css({
      backgroundColor: bgColor,
      color: fgColor,
    });
  });
}


function accept(aEvent)
{
  let shortcutKeyMenu = $("#clipping-key")[0];
  let shortcutKey = "";

  if (shortcutKeyMenu.selectedIndex != 0) {
    shortcutKey = shortcutKeyMenu.options[shortcutKeyMenu.selectedIndex].text;
  }

  let labelPicker = $("#clipping-label-picker");
  let label = labelPicker.val() ? labelPicker.val() : "";

  let errorMsgBox = new aeDialog("#create-clipping-error-msgbox");
  let numItemsInParent = 0;  // For calculating display order of new clipping.

  gClippingsDB.transaction("rw", gClippingsDB.clippings, gClippingsDB.folders, () => {
    gClippingsDB.folders.where("parentFolderID").equals(gParentFolderID).count().then(aNumFldrs => {
      numItemsInParent += aNumFldrs;
      return gClippingsDB.clippings.where("parentFolderID").equals(gParentFolderID).count();

    }).then(aNumClippings => {
      numItemsInParent += aNumClippings;
    
      return gClippingsDB.clippings.add({
        name: $("#clipping-name").val(),
        content: $("#clipping-text").val(),
        shortcutKey: shortcutKey,
        parentFolderID: gParentFolderID,
        label,
        displayOrder: numItemsInParent,
        sourceURL: ($("#save-source-url")[0].checked ? gSrcURL : "")
      });

    }).then(aNewClippingID => {
      let prefs = gClippings.getPrefs();
      if (prefs.syncClippings) {
        let syncFldrID = gClippings.getSyncFolderID();
        aeImportExport.setDatabase(gClippingsDB);
        
        return aeImportExport.exportToJSON(true, true, syncFldrID, false, true);
      }
      return null;

    }).then(aSyncData => {
      if (aSyncData) {
        let msg = {
          msgID: "set-synced-clippings",
          syncData: aSyncData.userClippingsRoot,
        };

        log("Clippings/wx::new.js: accept(): Sending message 'set-synced-clippings' to the Sync Clippings helper app.  Message data:");
        log(msg);

        return browser.runtime.sendNativeMessage(aeConst.SYNC_CLIPPINGS_APP_NAME, msg);
      }
      return null;

    }).then(aMsgResult => {
      if (aMsgResult) {
        log("Clippings/wx::new.js: accept(): Response from the Sync Clippings helper app:");
        log(aMsgResult);
      }
      
      closeDlg();

    }).catch("OpenFailedError", aErr => {
      // OpenFailedError exception thrown if Firefox is set to "Never remember
      // history."
      errorMsgBox.onInit = () => {
        console.error(`Error creating clipping: ${aErr}`);
        let errMsgElt = $("#create-clipping-error-msgbox > .dlg-content > .msgbox-error-msg");
        errMsgElt.text(chrome.i18n.getMessage("saveClippingError"));
      };
      errorMsgBox.showModal();

    }).catch(aErr => {
      console.error("Clippings/wx::new.js: accept(): " + aErr);     
      errorMsgBox.onInit = () => {
        let errMsgElt = $("#create-clipping-error-msgbox > .dlg-content > .msgbox-error-msg");
        let errText = `Error creating clipping: ${aErr}`;

        if (aErr == aeConst.SYNC_ERROR_CONXN_FAILED) {
          errText = chrome.i18n.getMessage("syncPushFailed");
          errorMsgBox.onAfterAccept = () => {
            // Despite the native app connection error, the new clipping was
            // successfully created, so just close the main dialog.
            closeDlg();
          };
        }
        errMsgElt.text(errText);
      };
      errorMsgBox.showModal();
    });
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


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
