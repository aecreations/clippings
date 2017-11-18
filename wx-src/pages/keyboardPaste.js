/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const WNDH_SHORTCUT_KEY = 164;
const WNDH_SEARCH_CLIPPING = 222;

let gClippings, gClippingsDB, gPasteMode;


$(document).ready(() => {
  gClippings = chrome.extension.getBackgroundPage();

  if (! gClippings) {
    throw new Error("Clippings/wx: clippingKey.js: Failed to retrieve parent browser window!");
  }

  gClippingsDB = gClippings.getClippingsDB();
  
  initAutocomplete();
  $("#btn-cancel").click(aEvent => { cancel(aEvent) });

  chrome.history.deleteUrl({ url: window.location.href });

  browser.storage.local.get().then(aPrefs => {
    gPasteMode = aPrefs.pastePromptAction;
  
    if (gPasteMode == aeConst.PASTEACTION_SHORTCUT_KEY) {
      $(".deck > #search-by-name").hide();
      $(".deck > #paste-by-shortcut-key").fadeIn("fast");
    }
    else {
      $(".deck > #paste-by-shortcut-key").hide();
      chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { height: WNDH_SEARCH_CLIPPING }, aWnd => {
        $(".deck > #search-by-name").fadeIn("fast");
        $("#clipping-search").focus();
      });
    }
  });

  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  browser.windows.getCurrent((win) => {
    browser.windows.update(win.id, {width:win.width+1})
  });
});


$(window).keypress(aEvent => {
  if (aEvent.key == "Escape") {
    if (gPasteMode == aeConst.PASTEACTION_SEARCH_CLIPPING
        && $("#eac-container-clipping-search > ul").css("display") != "none") {
      $("#eac-container-clipping-search > ul").hide();
      return;
    }
    cancel(aEvent);
  }
  else if (aEvent.key == "Enter" && gPasteMode == aeConst.PASTEACTION_SHORTCUT_KEY) {
    cancel(aEvent);
  }
  else if (aEvent.key == "F1") {
    // TO DO: Show shortcut key legend.
  }
  else if (aEvent.key == "Tab") {
    aEvent.preventDefault();

    if (gPasteMode == aeConst.PASTEACTION_SHORTCUT_KEY) {
      gPasteMode = aeConst.PASTEACTION_SEARCH_CLIPPING;
      $(".deck > #paste-by-shortcut-key").hide();

      chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { height: WNDH_SEARCH_CLIPPING }, aWnd => {
        $(".deck > #search-by-name").fadeIn("fast");
        $("#clipping-search").focus();
      });
    }
    else if (gPasteMode == aeConst.PASTEACTION_SEARCH_CLIPPING) {
      gPasteMode = aeConst.PASTEACTION_SHORTCUT_KEY;
      $(".deck > #search-by-name").hide();

      chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { height: WNDH_SHORTCUT_KEY }, aWnd => {
        $(".deck > #paste-by-shortcut-key").fadeIn("fast");
      });
    }
  }
  else {
    if (gPasteMode == aeConst.PASTEACTION_SHORTCUT_KEY) {
      browser.runtime.sendMessage({
        msgID: "paste-shortcut-key",
        shortcutKey: aEvent.key
      });

      closeDlg();
    }
  }
});


function initAutocomplete()
{
  function sanitize(aStr)
  {
    const MAX_LEN = 64;
    let rv = "";
    let originalLen = aStr.length;

    rv = aStr.replace(/</g, "&lt;");
    rv = rv.replace(/>/g, "&gt;");
    rv = rv.substr(0, MAX_LEN);
    rv += (originalLen > rv.length ? " ..." : "");

    return rv;
  }
  
  let clippings = [];

  gClippingsDB.clippings.where("parentFolderID").notEqual(aeConst.DELETED_ITEMS_FLDR_ID).each((aItem, aCursor) => {
    clippings.push({
      id: aItem.id,
      name: sanitize(aItem.name),
      preview: sanitize(aItem.content)
    });
  }).then(() => {
    let eacOpts = {
      data: clippings,
      getValue: "name",
      list: {
        maxNumberOfElements: 10000,
        match: {
          enabled: true
        },

        onLoadEvent: function () {
          let numMatches = $(".easy-autocomplete-container > ul > li").length;
          $("#num-matches").text(`${numMatches} matches`);
        },
        
        onShowListEvent: function () {
          $(".easy-autocomplete-container").removeAttr("hidden");
        },
        
        onHideListEvent: function () {
          $(".easy-autocomplete-container").attr("hidden", "true");
        },

        onChooseEvent: function () {
          let selectedItem = $("#clipping-search").getSelectedItemData();
          
          browser.runtime.sendMessage({
            msgID: "paste-clipping-by-name",
            clippingID: selectedItem.id
          });
          
          closeDlg();
        }
      },
      template: {
        type: "custom",
        method: function (aValue, aItem) {
          return `<div class="clipping"><div class="name">${aValue}</div><div class="preview">${aItem.preview}</div></div>`;
        }
      }
    };
  
    $("#clipping-search").easyAutocomplete(eacOpts);

    // EasyAutocomplete adds a <div class="easy-autocomplete"> and places the
    // clipping search textbox inside it.
    $(".easy-autocomplete").addClass("browser-style").css({ width: "100%" });

    $("#clipping-search").on("keyup", aEvent => {
      if (aEvent.target.value == "") {
        $("#num-matches").text("\u00a0");  /* Non-breaking space. */
        $("#clear-search").hide();
      }
      else {
        $("#clear-search").show();
      }
    })
    
    $("#clear-search").click(aEvent => {
      $("#clipping-search").val("").focus();
      $("#num-matches").text("\u00a0");
      $("#clear-search").hide();
    });

    $("#clipping-search").focus();
    $(".easy-autocomplete-container").attr("hidden", "true");
    $("#clear-search").hide();
  });
}


function cancel(aEvent)
{
  closeDlg();
}


function closeDlg()
{
  // Always remember last paste mode, even if user cancelled.
  browser.storage.local.set({
    pastePromptAction: gPasteMode
  }).then(() => {
    browser.runtime.sendMessage({ msgID: "close-keybd-paste-dlg" });
    chrome.windows.remove(chrome.windows.WINDOW_ID_CURRENT);
  });
}
