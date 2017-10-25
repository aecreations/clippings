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
 * Portions created by the Initial Developer are Copyright (C) 2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

const PASTE_ACTION_SHORTCUT_KEY = 1;
const PASTE_ACTION_SEARCH_CLIPPING = 2;

const DELETED_ITEMS_FLDR_ID = -1;

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
  
    if (gPasteMode == PASTE_ACTION_SHORTCUT_KEY) {
      $(".deck > #search-by-name").hide();
      $(".deck > #paste-by-shortcut-key").show();
    }
    else {
      $(".deck > #paste-by-shortcut-key").hide();
      $(".deck > #search-by-name").show();
      $("#clipping-search").focus();
    }
  });
});


$(window).keypress(aEvent => {
  if (aEvent.key == "Escape") {
    cancel(aEvent);
  }
  else if (aEvent.key == "Enter" && gPasteMode == PASTE_ACTION_SHORTCUT_KEY) {
    cancel(aEvent);
  }
  else if (aEvent.key == "F1") {
    // TO DO: Show shortcut key legend.
  }
  else if (aEvent.key == "Tab") {
    if (gPasteMode == PASTE_ACTION_SHORTCUT_KEY) {
      $(".deck > #paste-by-shortcut-key").hide();
      $(".deck > #search-by-name").show();
      $("#clipping-search").focus();
      gPasteMode = PASTE_ACTION_SEARCH_CLIPPING;
    }
    else if (gPasteMode == PASTE_ACTION_SEARCH_CLIPPING) {
      $(".deck > #search-by-name").hide();
      $(".deck > #paste-by-shortcut-key").show();
      gPasteMode = PASTE_ACTION_SHORTCUT_KEY;
    }

    aEvent.preventDefault();
  }
  else {
    if (gPasteMode == PASTE_ACTION_SHORTCUT_KEY) {
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

  gClippingsDB.clippings.where("parentFolderID").notEqual(DELETED_ITEMS_FLDR_ID).each((aItem, aCursor) => {
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
        match: {
          enabled: true
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
