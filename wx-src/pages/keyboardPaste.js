/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const WNDH_SHORTCUT_KEY = 164;
const WNDH_SEARCH_CLIPPING = 250;
const WNDH_SHORTCUT_LIST = 278;
const WNDW_SHORTCUT_LIST = 436;
const DLG_HEIGHT_ADJ_WINDOWS = 8;
const TOOLBAR_HEIGHT = 52;
const SHORTCUT_LIST_HEIGHT_ADJ_MAC = 2;

let gClippingsDB, gPasteMode, gOS;
let gBrowserTabID = null;

let gAutocompleteMenu = {
  _SCRL_LENGTH: 34,
  _MAX_VISIBLE_POPUP_ITEMS: 4,
  _POPUP_MAX_HEIGHT: 142,
  
  _textboxElt: null,
  _popupElt: null,
  _listboxElt: null,
  _srchData: null,
  _selectedIdx: -1,

  init(aClippingData)
  {
    this._srchData = aClippingData;
    this._textboxElt = $("#clipping-search");
    this._popupElt = $("#search-results-popup");
    this._listboxElt = $("#search-results-listbox");

    this._listboxElt.fancytree({
      extensions: ["wide"],
      debugLevel: 0,
      autoScroll: true,
      selectMode: 1,
      icon: false,
      escapeTitles: false,
      source: [],

      // Event handling
      click(aEvent, aData)
      {
        let clippingID = Number(aData.node.key);
        gAutocompleteMenu._selectClipping(clippingID);
      },
    });

    this._textboxElt.on("keydown", aEvent => {
      let searchText = aEvent.target.value;
      let listbox = this._getListbox();
      let listboxItems = listbox.toDict();
      let selectedItem = listbox.activeNode;

      if (aEvent.key == "ArrowDown") {
        if (searchText == '') {
          log("No search text was entered.");
          return;
        }

        aEvent.preventDefault();

        if (!this.isPopupShowing()) {
          this._popupElt.show();
          if (selectedItem) {
            selectedItem.setActive();
          }
          else {
            listbox.getFirstChild().setActive();
            this._selectedIdx = 0;
          }

          let popupHt = parseInt(this._popupElt.css("height"));
          if (popupHt == this._POPUP_MAX_HEIGHT) {
            $("#search-by-name .key-legend").hide();
          }

          return;
        }

        if (this._selectedIdx == -1) {
          listbox.getFirstChild().setActive();
          this._selectedIdx = 0;
        }
        else if (this._selectedIdx == (listbox.count() - 1)) {
          log("At the last item of the search results popup.");
          return;
        }
        else {
          this._selectedIdx++;
          listbox.activateKey(listboxItems[this._selectedIdx].key);
        }
      }
      else if (aEvent.key == "ArrowUp") {
        if (searchText == '') {
          log("No search text was entered.");
          return;
        }

        if (!this.isPopupShowing()) {
          return;
        }
        
        aEvent.preventDefault();

        if (this._selectedIdx == -1) {
          log("Nothing selected (???)");
          return;
        }
        else if (this._selectedIdx == 0) {
          log("At the first item of the search results popup.");
          return;
        }
        else {
          this._selectedIdx--;
          listbox.activateKey(listboxItems[this._selectedIdx].key);
        }
      }
      else if (aEvent.key == "Enter") {
        if (this._selectedIdx == -1) {
          log("Nothing selected");
          return;
        }
        
        let clippingID = Number(selectedItem.key);
        this._selectClipping(clippingID);
      }
    });

    this._textboxElt.on("input", aEvent => {
      let listbox = this._getListbox();

      if (this.isPopupShowing()) {
        this._popupElt[0].scrollTop = 0;
        listbox.clear();
        this._popupElt.hide();
        this._selectedIdx = -1;
        $("#search-by-name .key-legend").show();
      }

      let searchText = this._sanitizeRegExp(aEvent.target.value);
      let menuItemsData = [];
      let menuItemsDataIdx = 0;

      if (searchText == '') {
        $("#num-matches").text('');
        return;
      }

      for (let i = 0; i < this._srchData.length; i++) {
        let clipping = this._srchData[i];
        let re = new RegExp(searchText, "i");
        
        if (clipping.name.search(re) != -1) {
          menuItemsData.push({
            index: menuItemsDataIdx++,
            id: clipping.id,
            name: clipping.name,
            preview: clipping.preview,
          });
        }
      }

      let numMatches = menuItemsData.length;
      $("#num-matches").text(browser.i18n.getMessage("numMatches", numMatches));

      if (numMatches > 0) {
        let data = [];
        
        for (let item of menuItemsData) {
          let nameDiv = document.createElement("div");
          let previewDiv = document.createElement("div");
          nameDiv.appendChild(document.createTextNode(item.name));         
          previewDiv.appendChild(document.createTextNode(item.preview));

          let row = {
            key: item.id,
            title: `<div class="name">${nameDiv.innerHTML}</div><div class="preview">${previewDiv.innerHTML}</div>`,
          };
          data.push(row);
        }

        listbox.reload(data);

        // Set height of popup when there are 1, 2, or 3+ search results.
        if (numMatches < this._MAX_VISIBLE_POPUP_ITEMS) {
          let heightVal = (numMatches * this._SCRL_LENGTH) + 6;
          this._popupElt.css({height: `${heightVal}px`});
          $("#search-by-name .key-legend").show();
        }
        else {
          this._popupElt.css({ height:`${this._POPUP_MAX_HEIGHT}px`});
          $("#search-by-name .key-legend").hide();
        }
        
        this._popupElt.show();
      }
    });
  },

  isPopupShowing()
  {
    return this._popupElt.css("display") != "none";
  },

  hidePopup()
  {
    this._popupElt[0].scrollTop = 0;
    this._popupElt.hide();
    this._getListbox().activeNode = null;
    this._selectedIdx = -1;
    $("#search-by-name .key-legend").show();
  },
  

  // Helper methods
  _getListbox()
  {
    return $.ui.fancytree.getTree("#search-results-listbox");
  },

  _selectClipping(aClippingID)
  {
    this._popupElt.hide();

    browser.runtime.sendMessage({
      msgID: "paste-clipping-by-name",
      clippingID: aClippingID,
      browserTabID: gBrowserTabID,
      fromClippingsMgr: false,
    });

    closeDlg();
  },

  _sanitizeRegExp(aRegExpStr)
  {
    let rv = aRegExpStr.replace(/\\/g, "\\\\");
    rv = rv.replace(/\(/g, "\\(");
    rv = rv.replace(/\)/g, "\\)");
    rv = rv.replace(/\[/g, "\\[");
    rv = rv.replace(/\]/g, "\\]");
    rv = rv.replace(/\{/g, "\\{");
    rv = rv.replace(/\}/g, "\\}");
    rv = rv.replace(/\-/g, "\\-");
    rv = rv.replace(/\^/g, "\\^");
    rv = rv.replace(/\$/g, "\\$");
    rv = rv.replace(/\|/g, "\\|");
    rv = rv.replace(/\+/g, "\\+");
    rv = rv.replace(/\*/g, "\\*");
    rv = rv.replace(/\?/g, "\\?");
    
    return rv;
  }
};


// Initialize dialog
$(async () => {
  let params = new URLSearchParams(window.location.search);
  gBrowserTabID = Number(params.get("tabID"));
  
  let [brws, platform] = await Promise.all([
    browser.runtime.getBrowserInfo(),
    browser.runtime.getPlatformInfo(),
  ]);
  envInfo = {
    os: platform.os,
    hostAppName: brws.name,
    hostAppVer:  brws.version,
  };
  document.body.dataset.os = gOS = envInfo.os;
  aeInterxn.init(gOS);

  aeClippings.init();
  gClippingsDB = aeClippings.getDB();

  let extVer = browser.runtime.getManifest().version;

  aeImportExport.setDatabase(gClippingsDB);
  aeImportExport.setL10nStrings({
    shctTitle: browser.i18n.getMessage("expHTMLTitle"),
    hostAppInfo: browser.i18n.getMessage("expHTMLHostAppInfo", [extVer, envInfo.hostAppName]),
    shctKeyInstrxns: browser.i18n.getMessage("expHTMLShctKeyInstrxn"),
    shctKeyCustNote: browser.i18n.getMessage("expHTMLShctKeyCustNote"),
    shctKeyColHdr: browser.i18n.getMessage("expHTMLShctKeyCol"),
    clippingNameColHdr: browser.i18n.getMessage("expHTMLClipNameCol"),
  });

  initAutocomplete();
  $("#btn-cancel").on("click", aEvent => { cancel(aEvent) });

  gPasteMode = await aePrefs.getPref("pastePromptAction");
  
  if (gPasteMode == aeConst.PASTEACTION_SHORTCUT_KEY) {
    $(".deck > #search-by-name").hide();
    $(".deck > #paste-by-shortcut-key").show();
  }
  else {
    $(".deck > #paste-by-shortcut-key").hide();

    let updWndInfo = {
      height: WNDH_SEARCH_CLIPPING
    };
    await browser.windows.update(browser.windows.WINDOW_ID_CURRENT, updWndInfo);

    $(".deck > #search-by-name").show();
    let srchBox = $("#clipping-search")[0];
    srchBox.focus();
  }

  aeVisual.cacheIcons(
    "insClipping-hover.svg",
    "insClipping-active-dk.svg",
    "export_hover.svg",
    "export-active-dk.svg"
  );

  
  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  let wnd = await browser.windows.getCurrent();
  browser.windows.update(wnd.id, {
    width: wnd.width + 1,
    focused: true,
  });
});


$(window).on("keydown", async (aEvent) => {
  if (aEvent.key == "Escape") {
    if (gPasteMode == aeConst.PASTEACTION_SEARCH_CLIPPING) {
      if (gAutocompleteMenu.isPopupShowing()) {
        gAutocompleteMenu.hidePopup();
        return;
      }
      else {
        if ($("#clipping-search").val() != '') {
          $("#clipping-search").val('');
          return;
        }
      }
    }
    cancel(aEvent);
  }
  else if (aEvent.key == "Clear" && gPasteMode == aeConst.PASTEACTION_SEARCH_CLIPPING
           && gAutocompleteMenu.isPopupShowing()) {
    if ($("#clipping-search").val() != '') {
      $("#clipping-search").val('');
      gAutocompleteMenu.hidePopup();
    }
  }
  else if (aEvent.key == "Enter" && gPasteMode == aeConst.PASTEACTION_SHORTCUT_KEY) {
    cancel(aEvent);
  }
  else if (aEvent.key == "F1") {
    if (isShortcutListDisplayed()) {
      return;
    }

    if (gPasteMode == aeConst.PASTEACTION_SHORTCUT_KEY) {
      $(".deck > #paste-by-shortcut-key").hide();
      await initShortcutList();
      return;
    }
  }
  else if (aEvent.key == "Tab") {
    if (isShortcutListDisplayed()) {
      return;
    }

    aEvent.preventDefault();
    
    if (gPasteMode == aeConst.PASTEACTION_SHORTCUT_KEY) {
      gPasteMode = aeConst.PASTEACTION_SEARCH_CLIPPING;
      $(".deck > #paste-by-shortcut-key").hide();

      let updWndInfo = {
        height: WNDH_SEARCH_CLIPPING
      };
      await browser.windows.update(browser.windows.WINDOW_ID_CURRENT, updWndInfo);
      
      $(".deck > #search-by-name").fadeIn("fast");
      let srchBox = $("#clipping-search")[0];
      srchBox.focus();
    }
    else if (gPasteMode == aeConst.PASTEACTION_SEARCH_CLIPPING) {
      gPasteMode = aeConst.PASTEACTION_SHORTCUT_KEY;
      $(".deck > #search-by-name").hide();

      let updWndInfo = {
        height: WNDH_SHORTCUT_KEY
      };
      await browser.windows.update(browser.windows.WINDOW_ID_CURRENT, updWndInfo);

      $(".deck > #paste-by-shortcut-key").fadeIn("fast");
    }
  }
  else {
    if (isShortcutListDisplayed()) {
      return;
    }
    
    if (gPasteMode == aeConst.PASTEACTION_SHORTCUT_KEY) {
      execShortcut(aEvent.key);
    }
    else {
      aeInterxn.suppressBrowserShortcuts(aEvent, aeConst.DEBUG);
    }
  }
});


$(window).on("resize", aEvent => {
  if (! isShortcutListDisplayed()) {
    return;
  }

  let tblWidth = window.innerWidth;
  let tblHeight = window.innerHeight - TOOLBAR_HEIGHT;
  if (gOS == "mac") {
    tblHeight += SHORTCUT_LIST_HEIGHT_ADJ_MAC;
  }

  $("#shortcut-list-content > table > thead").css({width: `${tblWidth}px`});
  $("#shortcut-list-content > table > tbody").css({
    width: `${tblWidth}px`,
    height: `${tblHeight}px`,
  });
});


function initAutocomplete()
{
  let allClippings = [];

  gClippingsDB.clippings.where("parentFolderID").notEqual(aeConst.DELETED_ITEMS_FLDR_ID)
    .filter(aItem => !aItem.separator)
    .each((aItem, aCursor) => {
    allClippings.push({
      id: aItem.id,
      name: sanitizeHTML(aItem.name, 56),
      preview: sanitizeHTML(aItem.content),
    });
  }).then(() => {
    // Initialize the autocomplete UI widget.
    gAutocompleteMenu.init(allClippings);

    $("#clipping-search").on("keyup", aEvent => {
      if (aEvent.target.value == "") {
        $("#num-matches").text("\u00a0");  // Non-breaking space.
        $("#clear-search").hide();
      }
      else {
        $("#clear-search").show();
      }
    })
    
    $("#clear-search").on("click", aEvent => {
      $("#clipping-search").val("").focus();
      $("#num-matches").text("\u00a0");
      
      if (gAutocompleteMenu.isPopupShowing()) {
        gAutocompleteMenu.hidePopup();
      }
      
      $("#clear-search").hide();
    });

    $("#clipping-search").focus();
    $("#clear-search").hide();
  });
}


async function initShortcutList()
{
  $("#dlg-buttons").remove();

  $("#shortcut-list-toolbar > #paste-clipping").on("click", aEvent => {
    let clippingKey = $("#shortcut-list-content > table > tbody > tr.selected-row td:first-child").text();
    execShortcut(clippingKey);
  });

  $("#shortcut-list-toolbar > #export-shct-list").on("click", aEvent => {
    exportShortcutList();
  });

  $("#shortcut-list-toolbar > #close").on("click", aEvent => {
    closeDlg();
  });
  
  let updWndInfo = {
    width: WNDW_SHORTCUT_LIST,
    height: WNDH_SHORTCUT_LIST,
  };
  if (gOS == "win") {
    updWndInfo.height += DLG_HEIGHT_ADJ_WINDOWS;
  }
  
  await browser.windows.update(browser.windows.WINDOW_ID_CURRENT, updWndInfo);
  aeImportExport.getShortcutKeyListHTML(false).then(aShctListHTML => {
    $("#shortcut-list-content").append(sanitizeHTML(aShctListHTML));

    let tblWidth = window.innerWidth;
    $("#shortcut-list-content > table > thead").css({ width: `${tblWidth}px` });
    $("#shortcut-list-content > table > tbody").css({ width: `${tblWidth}px` });

    $("#shortcut-list-content > table > tbody > tr").on("mouseup", aEvent => {
      $("#shortcut-list-content > table > tbody > tr").removeClass("selected-row");
      $(aEvent.target).parent().addClass("selected-row");

      if ($("#paste-clipping").attr("disabled")) {
        $("#paste-clipping").removeAttr("disabled");
      }
    }).on("dblclick", aEvent => {
      let clippingKey = $("#shortcut-list-content > table > tbody > tr.selected-row td:first-child").text();
      execShortcut(clippingKey);
    });

    $(".deck > #shortcut-list").fadeIn("fast");
  }).catch(aErr => {
    console.error("Clippings/wx::keyboardPaste.js: initShortcutList(): " + aErr);
  });
}


function isShortcutListDisplayed()
{
  return ($("#shortcut-list").css("display") == "block");
}


function exportShortcutList()
{
  aeImportExport.getShortcutKeyListHTML(true).then(aHTMLData => {
    let blobData = new Blob([aHTMLData], { type: "text/html;charset=utf-8"});
    let downldOpts = {
      url: URL.createObjectURL(blobData),
      filename: aeConst.HTML_EXPORT_SHORTCUTS_FILENAME,
      saveAs: true,
    };
    return browser.downloads.download(downldOpts);

  }).then(aDownldItemID => {
    log("Successfully exported the shortcut list.");
  }).catch(aErr => {
    if (aErr.fileName == "undefined") {
      log("User cancel");
    }
    else {
      console.error(aErr);
      window.alert("Sorry, an error occurred while creating the export file.\n\nDetails:\n" + getErrStr(aErr));
    }
  });
}

function execShortcut(aShortcutKey)
{
  browser.runtime.sendMessage({
    msgID: "paste-shortcut-key",
    shortcutKey: aShortcutKey,
    browserTabID: gBrowserTabID,
  });

  closeDlg();
}


function cancel(aEvent)
{
  closeDlg();
}


async function closeDlg()
{
  // Always remember last paste mode, even if user cancelled.
  await aePrefs.setPrefs({pastePromptAction: gPasteMode});
  
  await browser.runtime.sendMessage({msgID: "close-keybd-paste-dlg"});
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}


function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, {SAFE_FOR_JQUERY: true});
}


function getErrStr(aErr)
{
  let rv = `${aErr.name}: ${aErr.message}`;

  if (aErr.fileName) {
    rv += "\nSource: " + aErr.fileName;
  }
  else {
    rv += "\nSource: unknown";
  }

  if (aErr.lineNumber) {
    rv += ":" + aErr.lineNumber;
  }

  return rv;
}


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
