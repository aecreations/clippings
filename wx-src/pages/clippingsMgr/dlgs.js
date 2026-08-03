/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function clippingsMgrDlgs()
{
  let shctKeyConflict = new aeDialog("#shortcut-key-conflict-msgbox");
  shctKeyConflict.onAccept = function (aEvent)
  {
    this.close();

    // NOTE: As of Firefox 57b8, this doesn't do anything.
    $("#clipping-key")[0].selectedIndex = gShortcutKey.getPrevSelectedIndex();
  };

  let clippingMissingSrcURL = new aeDialog("#clipping-missing-src-url-msgbar");
  let noUndoNotify = new aeDialog("#no-undo-msgbar");
  let noRedoNotify = new aeDialog("#no-redo-msgbar");
  let clipboardEmpty = new aeDialog("#clipboard-empty-msgbar");
  let actionUnavailable = new aeDialog("#action-not-available");

  let requestExtPerm = new aeDialog("#request-ext-perm-dlg");
  requestExtPerm.setProps({
    extPerm: null,
    extPermStrKeys: {
      clipboardRead: "extPrmClipbdR",
      clipboardWrite: "extPrmClipbdW",
    },
  });

  requestExtPerm.setPermission = function (aPermission)
  {
    this.extPerm = aPermission;
  };

  requestExtPerm.onFirstInit = function ()
  {
    let extName = browser.i18n.getMessage("extName");
    this.find("#grant-ext-perm").text(browser.i18n.getMessage("extPermInstr", extName));
  };
  requestExtPerm.onInit = function ()
  {
    if (! this.extPerm) {
      throw new ReferenceError("Extension permission keyword not set");
    }

    let strKey = this.extPermStrKeys[this.extPerm];
    this.find(".dlg-content ul > li").text(browser.i18n.getMessage(strKey));
  };

  requestExtPerm.onUnload = function ()
  {
    this.extPerm = null;
    this.find(".dlg-content ul > li").text('');
  };

  let shortcutList = new aeDialog("#shortcut-list-dlg");
  shortcutList.onFirstInit = async function ()
  {
    let keybPasteKeys = await browser.runtime.sendMessage({msgID: "get-shct-key-prefix-ui-str"});
    $("#shortcut-instrxns").text(browser.i18n.getMessage("clipMgrShortcutHelpInstrxn", keybPasteKeys));
    let extVer = browser.runtime.getManifest().version;

    aeImportExport.setL10nStrings({
      shctTitle: browser.i18n.getMessage("expHTMLTitle"),
      hostAppInfo: browser.i18n.getMessage("expHTMLHostAppInfo", [extVer, gEnvInfo.hostAppName]),
      shctKeyInstrxns: browser.i18n.getMessage("expHTMLShctKeyInstrxn"),
      shctKeyCustNote: browser.i18n.getMessage("expHTMLShctKeyCustNote"),
      shctKeyColHdr: browser.i18n.getMessage("expHTMLShctKeyCol"),
      clippingNameColHdr: browser.i18n.getMessage("expHTMLClipNameCol"),
    });

    $("#export-shct-list").on("click", aEvent => {
      aeImportExport.getShortcutKeyListHTML(true).then(aHTMLData => {
        let blobData = new Blob([aHTMLData], { type: "text/html;charset=utf-8"});
        let downldOpts = {
          url: URL.createObjectURL(blobData),
          filename: aeConst.HTML_EXPORT_SHORTCUTS_FILENAME,
          saveAs: true,
        };
        return browser.downloads.download(downldOpts);

      }).catch(aErr => {
        if (aErr.fileName == "undefined") {
          // User cancel
        }
        else {
          console.error(aErr);
          window.alert("Sorry, an error occurred while creating the export file.\n\nDetails:\n" + getErrStr(aErr));
        }
      });
    });
  };

  shortcutList.onInit = async function ()
  {
    let shctListHTML;
    try {
      shctListHTML = await aeImportExport.getShortcutKeyListHTML(false);
    }
    catch (e) {
      console.error("Clippings: clippingsMgr/pg.js:  shortcutList.onInit(): " + e);
      return;
    }

    $("#shortcut-list-content").append(sanitizeHTML(shctListHTML));

    let tbodyElt = $("#shortcut-list-dlg > #shortcut-list-content > table > tbody");
    tbodyElt.attr("tabindex", "0");

    let dlgElts = [
      tbodyElt[0],
      $("#shortcut-list-dlg > .dlg-btns > #export-shct-list")[0],
      $("#shortcut-list-dlg > .dlg-btns > .dlg-accept")[0],
    ];
    this.initKeyboardNavigation(dlgElts);
  };

  shortcutList.onUnload = function ()
  {
    $("#shortcut-list-content").empty();
  };

  let insCustomPlchldr = new aeDialog("#custom-placeholder-dlg");
  insCustomPlchldr.validatePlaceholderName = function (aName) {
    if (aName.match(/[^a-zA-Z0-9_\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]/)) {
      return false;
    }
    return true;
  };

  insCustomPlchldr.onFirstInit = function ()
  {
    $("#custom-plchldr-name").prop("placeholder", browser.i18n.getMessage("placeholderNameHint"));
    $("#custom-plchldr-name").on("keydown", aEvent => {
      if ($(aEvent.target).hasClass("input-error")) {
        $(aEvent.target).removeClass("input-error");
      }
    });
  };

  insCustomPlchldr.onInit = function ()
  {
    $("#custom-plchldr-default-val").val("");
    $("#custom-plchldr-name").removeClass("input-error").val("");
  };

  insCustomPlchldr.onShow = function ()
  {
    $("#custom-plchldr-name").trigger("focus");
  };

  insCustomPlchldr.onAccept = function ()
  {
    let placeholderName = $("#custom-plchldr-name").val();
    if (! placeholderName) {
      $("#custom-plchldr-name").trigger("focus");
      return;
    }

    if (! this.validatePlaceholderName(placeholderName)) {
      $("#custom-plchldr-name").addClass("input-error").trigger("focus");
      return;
    }

    let placeholderValue = $("#custom-plchldr-default-val").val();
    let placeholder = "$[" + placeholderName;

    if (placeholderValue) {
      placeholder = placeholder + "{" + placeholderValue + "}]";
    }
    else {
      placeholder = placeholder + "]";
    }

    let contentTextArea = $("#clipping-text");
    contentTextArea.trigger("focus");
    insertTextIntoTextbox(contentTextArea, placeholder);
    this.close();
  };

  let insAutoIncrPlchldr = new aeDialog("#numeric-placeholder-dlg");
  insAutoIncrPlchldr.onFirstInit = function ()
  {
    $("#numeric-plchldr-name").prop("placeholder", browser.i18n.getMessage("placeholderNameHint"));
    $("#numeric-plchldr-name").on("keydown", aEvent => {
      if ($(aEvent.target).hasClass("input-error")) {
        $(aEvent.target).removeClass("input-error");
      }
    });
  };

  insAutoIncrPlchldr.onInit = function ()
  {
    $("#numeric-plchldr-name").removeClass("input-error").val("");
  };

  insAutoIncrPlchldr.onShow = function ()
  {
    $("#numeric-plchldr-name").trigger("focus");
  };

  insAutoIncrPlchldr.onAccept = function ()
  {
    let placeholderName = $("#numeric-plchldr-name").val();
    if (! placeholderName) {
      $("#numeric-plchldr-name").trigger("focus");
      return;
    }

    if (! insCustomPlchldr.validatePlaceholderName(placeholderName)) {
      $("#numeric-plchldr-name").addClass("input-error").trigger("focus");
      return;
    }

    let placeholder = "#[" + placeholderName + "]";

    let contentTextArea = $("#clipping-text");
    contentTextArea.trigger("focus");
    insertTextIntoTextbox(contentTextArea, placeholder);
    this.close();
  };

  let insDateTimePlchldr = new aeDialog("#insert-date-time-placeholder-dlg");
  insDateTimePlchldr.setProps({
    dateFormats: [
      "dddd, MMMM Do, YYYY",
      "MMMM D, YYYY",
      "MM/DD/YYYY",
      "YYYY-MM-DD",
      "D MMMM YYYY",
      "D.M.YYYY",
      "DD-MMM-YYYY",
      "MM/DD/YYYY h:mm A",
      "ddd, MMM DD, YYYY hh:mm:ss A ZZ",
    ],
    timeFormats: [
      "h:mm A",
      "HH:mm",
      "HH:mm:ss",
    ],
  });

  insDateTimePlchldr.onInit = function ()
  {
    let dtFmtList = $("#date-time-format-list")[0];

    if (gEnvInfo.os != "mac") {
      dtFmtList.setAttribute("size", "11");
    }

    let lang = browser.i18n.getUILanguage();
    if (lang.search(/en/) == -1) {
      // Handle non-English locales.
      this.dateFormats = [
        "LL",
        "ll",
        "l",
        "YYYY-MM-DD",
        "lll",
        "LLLL",
        "llll",
      ];
      this.timeFormats = [
        "LT",
      ];
    }

    let date = new Date();
    let defaultDateFmtOpt = document.createElement("option");
    defaultDateFmtOpt.setAttribute("value", "DATE");
    defaultDateFmtOpt.appendChild(document.createTextNode(date.toLocaleDateString()));
    dtFmtList.appendChild(defaultDateFmtOpt);

    for (let dateFmt of this.dateFormats) {
      let dateFmtOpt = document.createElement("option");
      dateFmtOpt.setAttribute("value", dateFmt);
      let dateFmtOptTxt = document.createTextNode(moment().format(dateFmt));
      dateFmtOpt.appendChild(dateFmtOptTxt);
      dtFmtList.appendChild(dateFmtOpt);
    }

    let defaultTimeFmtOpt = document.createElement("option");
    defaultTimeFmtOpt.setAttribute("value", "TIME");
    defaultTimeFmtOpt.appendChild(document.createTextNode(date.toLocaleTimeString()));
    dtFmtList.appendChild(defaultTimeFmtOpt);

    for (let timeFmt of this.timeFormats) {
      let timeFmtOpt = document.createElement("option");
      timeFmtOpt.setAttribute("value", timeFmt);
      let timeFmtOptTxt = document.createTextNode(moment().format(timeFmt));
      timeFmtOpt.appendChild(timeFmtOptTxt);
      dtFmtList.appendChild(timeFmtOpt);
    }
  };

  insDateTimePlchldr.onShow = function ()
  {
    let fmtList = $("#date-time-format-list")[0];
    fmtList.focus();
    fmtList.selectedIndex = 0;
  };

  insDateTimePlchldr.onAccept = function ()
  {
    let placeholder = "";
    let dtFmtList = $("#date-time-format-list")[0];
    let selectedFmt = dtFmtList.options[dtFmtList.selectedIndex].value;

    if (selectedFmt == "DATE" || selectedFmt == "TIME") {
      placeholder = "$[" + selectedFmt + "]";
    }
    else {
      if (dtFmtList.selectedIndex > this.dateFormats.length) {
        placeholder = "$[TIME(" + selectedFmt + ")]";
      }
      else {
        placeholder = "$[DATE(" + selectedFmt + ")]";
      }
    }

    this.close();

    let contentTextArea = $("#clipping-text");
    contentTextArea.trigger("focus");
    insertTextIntoTextbox(contentTextArea, placeholder);
  };

  insDateTimePlchldr.onUnload = function ()
  {
    $("#date-time-format-list").empty();
  };

  let importFromFile = new aeDialog("#import-dlg");
  importFromFile.setProps({
    IMP_APPEND: 0,
    IMP_REPLACE: 1,
    mode: 0,
  });

  importFromFile.onFirstInit = function ()
  {
    $("#import-clippings-browse").on("click", aEvent => {
      let inputFile = $("#import-clippings-file-upload")[0];
      inputFile.showPicker();
    });

    $("#import-clippings-file-upload").on("change", aEvent => {
      $("#import-error").text("").hide();

      let inputFileElt = aEvent.target;
      if (inputFileElt.files.length > 0) {
        let file = inputFileElt.files[0];

        if (aeImportExport.isValidFileType(file)) {
          $("#import-clippings-file-path").val(file.name);
          $("#import-dlg button.dlg-accept").removeAttr("disabled");
        }
        else {
          $("#import-clippings-file-path").val("");
          $("#import-dlg button.dlg-accept").attr("disabled", "true");
        }
      }
      if (this.mode == this.IMP_REPLACE && !gIsClippingsTreeEmpty) {
        $("#restore-backup-warning").show();
      }
    });

    $("#import-clippings-file-path").on("contextmenu", aEvent => {
      aEvent.preventDefault();
    }).on("focus", aEvent => { aEvent.target.select() });
  };

  importFromFile.onInit = function ()
  {
    if (this.mode == this.IMP_REPLACE) {
      $("#import-clippings-label").text(browser.i18n.getMessage("labelSelBkupFile"));
      $("#import-clippings-replc-shct-keys-checkbox").hide();
      $("#import-formats").hide();

      if (! gIsClippingsTreeEmpty) {
        $("#restore-backup-warning").show();
      }

      $("#import-dlg-action-btn").text(browser.i18n.getMessage("btnRestoreBkup"));
    }
    else {
      $("#import-clippings-label").text(browser.i18n.getMessage("labelSelImportFile"));
      $("#import-clippings-replc-shct-keys-checkbox").show();
      $("#import-formats").show();
      $("#restore-backup-warning").hide();
      $("#import-dlg-action-btn").text(browser.i18n.getMessage("btnImport"));
    }

    $("#import-clippings-file-path").val("");
    $("#import-dlg button.dlg-accept").attr("disabled", "true");
    gSuppressAutoMinzWnd = true;

    // Delay to allow time to switch to import or restore backup UI.
    setTimeout(() => {
      this.find("#import-clippings-browse")[0].focus();
    }, 200);
  };

  importFromFile.onUnload = function ()
  {
    $("#import-error").text("").hide();
    $("#import-dlg #import-clippings-file-upload").val("");
    $("#import-clippings-replc-shct-keys")[0].checked = true;
    gSuppressAutoMinzWnd = false;
  };

  importFromFile.onAccept = function (aEvent)
  {
    let currClippingsData;

    function importFile(aAppendItems)
    {
      let inputFileElt = $("#import-clippings-file-upload")[0];
      let fileList = inputFileElt.files;

      if (fileList.length == 0) {
        return;
      }

      $("#import-progress-bar").show();

      let importFile = fileList[0];
      log(`Clippings Manager: Selected import file: '${importFile.name}'; file size: ${importFile.size} bytes`);

      let fileReader = new FileReader();
      fileReader.addEventListener("load", aEvent => {
        let rawData = aEvent.target.result;
        let replaceShortcutKeys = ($("#import-clippings-replc-shct-keys:checked").length > 0);

        try {
          if (importFile.name.endsWith(".json")) {
            if (!aeImportExport.isValidClippingsJSON(rawData)
                && !aeImportExport.isValidTextSnippetsJSON(rawData)) {
              throw new Error(`Import file "${importFile.name}" is invalid.`);
            }
            aeImportExport.importFromJSON(rawData, replaceShortcutKeys, aAppendItems);
          }
          else if (importFile.name.endsWith(".rdf")) {
            aeImportExport.importFromRDF(rawData, replaceShortcutKeys, aAppendItems);
          }
        }
        catch (e) {
          $("#import-progress-bar").hide();
          warn(e);
          $("#import-error").text(browser.i18n.getMessage("importError")).show();

          if (aAppendItems) {
            browser.runtime.sendMessage({
              msgID: "import-finished",
              isSuccess: false,
            });
          }
          else {
            log("Clippings: clippingsMgr/pg.js:  Restore from backup file has failed.  Rolling back.");
            aeImportExport.importFromJSON(currClippingsData, true, aAppendItems);
            setTimeout(() => {
              // Restoring the current clippings data will change the IDs of
              // clippings and folders, so force a rebuild of the Clippings
              // context menu.
              browser.runtime.sendMessage({
                msgID: "import-finished",
                isSuccess: true,
              });
            }, REBUILD_BRWS_CXT_MENU_DELAY);
          }

          return;
        }

        log("Clippings: clippingsMgr/pg.js:  gDialog.importFromFile.onAccept()::importFile(): Importing Clippings data asynchronously.");

        $("#import-error").text("").hide();
        $("#import-progress-bar").hide();
        importFromFile.close();
        gSuppressAutoMinzWnd = false;

        importConfirmMsgBox.setMessage(browser.i18n.getMessage("clipMgrImportConfirm", importFile.name));
        importConfirmMsgBox.showModal();
      });

      fileReader.readAsText(importFile);
    } // END nested function

    if (this.mode == this.IMP_REPLACE) {
      info("Clippings: clippingsMgr/pg.js:  Import dialog mode: Restore From Backup");

      $("#restore-backup-warning").hide();

      // Create an in-memory backup of the existing data.  If the restore fails
      // due to bad JSON import data, then roll back by restoring this backup.
      let excludeSyncFldrID = null;
      if (gPrefs.syncClippings) {
        excludeSyncFldrID = gPrefs.syncFolderID;
      }
      aeImportExport.exportToJSON(true, false, aeConst.ROOT_FOLDER_ID, excludeSyncFldrID, true).then(aJSONData => {
        currClippingsData = aJSONData;
        return browser.runtime.sendMessage({msgID: "import-started"});

      }).then(() => {
        gClippingsDB.transaction("rw", gClippingsDB.clippings, gClippingsDB.folders, () => {
          log("Clippings: clippingsMgr/pg.js:  gDialog.importFromFile.onAccept(): Starting restore from backup file.\nDeleting all clippings and folders (except the 'Synced Clippings' folder, if Sync Clippings turned on).");

          gCmd.recentAction = gCmd.ACTION_RESTORE_BACKUP;

          gClippingsDB.folders.each((aItem, aCursor) => {
            if ("isSync" in aItem) {
              // Don't delete the Synced Clippings folder.
              return;
            }

            let fldrID = aItem.id + "F";
            if (! gSyncedItemsIDs.has(fldrID)) {
              gClippingsSvc.deleteFolder(parseInt(fldrID));
            }
          }).then(() => {
            return gClippingsDB.clippings.each((aItem, aCursor) => {
              let clpgID = aItem.id + "C";
              if (! gSyncedItemsIDs.has(clpgID)) {
                gClippingsSvc.deleteClipping(parseInt(clpgID));
              }
            });
          }).then(() => {
            log("Clippings: clippingsMgr/pg.js:  Finished deleting clippings and folders. Clearing undo stack and starting import of backup file.");

            gCmd.undoStack.clear();
            gCmd.redoStack.clear();
            importFile(false);
          });
        }).catch(aErr => {
          console.error("Clippings: clippingsMgr/pg.js:  gDialog.importFromFile.onAccept(): " + aErr);
        });
      });
    }
    else {
      info("Clippings: clippingsMgr/pg.js:  Import dialog mode: Import File");
      gCmd.recentAction = gCmd.ACTION_IMPORT;

      browser.runtime.sendMessage({msgID: "import-started"}).then(() => {
        importFile(true);
      });
    }
  };

  let exportToFile = new aeDialog("#export-dlg");
  exportToFile.setProps({
    FMT_CLIPPINGS_WX: 0,
    FMT_HTML: 1,
    FMT_CSV: 2,
    inclSrcURLs: false,
    inclSep: false,
    fmtDesc: [
      browser.i18n.getMessage("expFmtClippings6Desc"), // Clippings
      browser.i18n.getMessage("expFmtHTMLDocDesc"),    // HTML Document
      browser.i18n.getMessage("expFmtCSVDesc"),        // CSV File
    ],
  });

  exportToFile.onFirstInit = function ()
  {
    $("#export-format-list").change(aEvent => {
      let selectedFmtIdx = aEvent.target.selectedIndex;
      $("#format-description").text(this.fmtDesc[selectedFmtIdx]);

      if (selectedFmtIdx == this.FMT_CLIPPINGS_WX) {
        $("#include-src-urls").prop("disabled", false).prop("checked", this.inclSrcURLs);
        $("#export-incl-separators").prop("disabled", false).prop("checked", this.inclSep);
      }
      else if (selectedFmtIdx == this.FMT_HTML || selectedFmtIdx == this.FMT_CSV) {
        $("#include-src-urls").prop("disabled", true).prop("checked", false);
        $("#export-incl-separators").prop("disabled", true).prop("checked", false);
      }
    });

    $("#include-src-urls").on("click", aEvent => {
      this.inclSrcURLs = aEvent.target.checked;
    });
    $("#export-incl-separators").on("click", aEvent => {
      this.inclSep = aEvent.target.checked;
    });
  };

  exportToFile.onInit = function ()
  {
    this.inclSrcURLs = true;
    this.inclSep = true;
    gSuppressAutoMinzWnd = true;

    this.find("#export-format-list")[0].selectedIndex = this.FMT_CLIPPINGS_WX;
    this.find("#format-description").text(this.fmtDesc[this.FMT_CLIPPINGS_WX]);
    this.find("#include-src-urls").prop("checked", this.inclSrcURLs).prop("disabled", false);
    this.find("#export-incl-separators").prop("checked", this.inclSep).prop("disabled", false);
  };

  exportToFile.onShow = function ()
  {
    $("#export-format-list")[0].focus();
  };

  exportToFile.onAfterAccept = function ()
  {
    function saveToFile(aBlobData, aFilename)
    {
      browser.downloads.download({
        url: URL.createObjectURL(aBlobData),
        filename: aFilename,
        saveAs: true
      }).then(aDownldItemID => {
        gSuppressAutoMinzWnd = false;
        setStatusBarMsg(browser.i18n.getMessage("statusExportDone"));

        return browser.downloads.search({ id: aDownldItemID });

      }).then(aDownldItems => {
        if (aDownldItems && aDownldItems.length > 0) {
          let exportFilePath = aDownldItems[0].filename;
          exportConfirmMsgBox.setMessage(browser.i18n.getMessage("clipMgrExportConfirm", exportFilePath));
          exportConfirmMsgBox.showModal();
        }
      }).catch(aErr => {
        gSuppressAutoMinzWnd = false;
        if (aErr.fileName == "undefined") {
          setStatusBarMsg();
        }
        else {
          console.error(aErr);
          setStatusBarMsg(browser.i18n.getMessage("statusExportFailed"));
          window.alert(browser.i18n.getMessage("exportError", aErr));
        }
      });
    }

    let excludeSyncFldrID = null;
    if (gPrefs.syncClippings) {
      excludeSyncFldrID = gPrefs.syncFolderID;
    }

    let selectedFmtIdx = $("#export-format-list")[0].selectedIndex;
    setStatusBarMsg(browser.i18n.getMessage("statusExportStart"));

    if (selectedFmtIdx == this.FMT_CLIPPINGS_WX) {
      let inclSrcURLs = $("#include-src-urls").prop("checked");
      let inclSeparators = $("#export-incl-separators").prop("checked");

      aeImportExport.exportToJSON(inclSrcURLs, false, aeConst.ROOT_FOLDER_ID, excludeSyncFldrID, true, inclSeparators).then(aJSONData => {
        let blobData = new Blob([aJSONData], {type: "application/json;charset=utf-8"});

        saveToFile(blobData, aeConst.CLIPPINGS_EXPORT_FILENAME);
        gCmd.recentAction = gCmd.ACTION_EXPORT;

      }).catch(aErr => {
        window.alert("Sorry, an error occurred while exporting to Clippings 6 format.\n\nDetails:\n" + getErrStr(aErr));
        setStatusBarMsg(browser.i18n.getMessage("statusExportFailed"));
        gSuppressAutoMinzWnd = false;
      });
    }
    else if (selectedFmtIdx == this.FMT_HTML) {
      aeImportExport.exportToHTML().then(aHTMLData => {
        let blobData = new Blob([aHTMLData], { type: "text/html;charset=utf-8"});
        saveToFile(blobData, aeConst.HTML_EXPORT_FILENAME);
        gCmd.recentAction = gCmd.ACTION_EXPORT;

      }).catch(aErr => {
        window.alert("Sorry, an error occurred while exporting to HTML Document format.\n\nDetails:\n" + getErrStr(aErr));
        setStatusBarMsg(browser.i18n.getMessage("statusExportFailed"));
        gSuppressAutoMinzWnd = false;
      });
    }
    else if (selectedFmtIdx == this.FMT_CSV) {
      aeImportExport.exportToCSV(excludeSyncFldrID).then(aCSVData => {
        let blobData = new Blob([aCSVData], { type: "text/csv;charset=utf-8" });
        saveToFile(blobData, aeConst.CSV_EXPORT_FILENAME);
        gCmd.recentAction = gCmd.ACTION_EXPORT;

      }).catch(aErr => {
        window.alert("Sorry, an error occurred while exporting to CSV format.\n\nDetails:\n" + getErrStr(aErr));
        setStatusBarMsg(browser.i18n.getMessage("statusExportFailed"));
        gSuppressAutoMinzWnd = false;
      });
    }
  };

  let importConfirmMsgBox = new aeDialog("#import-confirm-msgbox");
  importConfirmMsgBox.setMessage = function (aMessage)
  {
    $("#import-confirm-msgbox > .msgbox-content").text(aMessage);
  };

  importConfirmMsgBox.onShow = async function ()
  {
    if (gPrefs.clippingsUnchanged) {
      await aePrefs.setPrefs({ clippingsUnchanged: false });
    }
  };

  importConfirmMsgBox.onAfterAccept = async function ()
  {
    await browser.runtime.sendMessage({
      msgID: "import-finished",
      isSuccess: true,
    });
    await rebuildClippingsTree();
  };

  let exportConfirmMsgBox = new aeDialog("#export-confirm-msgbox");
  exportConfirmMsgBox.setMessage = function (aMessage)
  {
    $("#export-confirm-msgbox > .msgbox-content").text(aMessage);
  };

  let backupConfirmMsgBox = new aeDialog("#backup-confirm-msgbox");
  backupConfirmMsgBox.setMessage = function (aMessage)
  {
    $("#backup-confirm-msgbox > .msgbox-content").text(aMessage);
  };

  backupConfirmMsgBox.onShow = async function ()
  {
    await aePrefs.setPrefs({ clippingsUnchanged: true });
  };

  backupConfirmMsgBox.onAfterAccept = async function ()
  {
    if (gIsBackupMode) {
      closeWnd();
    }
  };

  let removeAllSrcURLs = new aeDialog("#remove-all-source-urls-dlg");
  removeAllSrcURLs.onFirstInit = function ()
  {
    this.focusedSelector = ".dlg-btns > .dlg-accept";
    this.find(".dlg-btns > .dlg-btn-yes").on("click", aEvent => {
      removeAllSrcURLs.close();
      gCmd.removeAllSrcURLsIntrl();
    });
  };

  let removeAllSrcURLsConfirm = new aeDialog("#all-src-urls-removed-confirm-msgbar");
  removeAllSrcURLsConfirm.onInit = function ()
  {
    // Reselect the selected tree node to force a call to updateDisplay().
    aeClippingsTree.getTree().reactivate(true);
  };

  let restoreSrcURLs = new aeDialog("#restored-src-urls-msgbar");
  restoreSrcURLs.onInit = function ()
  {
    aeClippingsTree.getTree().reactivate(true);
  };

  let moveTo = new aeDialog("#move-dlg");
  moveTo.setProps({
    fldrTree: null,
    selectedFldrNode: null,
  });
  moveTo.resetTree = function ()
  {
    if (! this.fldrTree) {
      return;
    }
    let fldrTree = this.fldrTree.getTree();
    fldrTree.clear();
    this.fldrTree = null;
    this.selectedFldrNode = null;

    // Destroy and then recreate the element used to instantiate Fancytree,
    // so that we start fresh when the dialog is invoked again.
    $("#move-to-fldr-tree").children().remove();
    let parentElt = $("#move-to-fldr-tree").parent();
    parentElt.children("#move-to-fldr-tree").remove();
    $('<div id="move-to-fldr-tree"></div>').insertAfter("#activate-move-to-fldr-tree");
  };

  moveTo.onFirstInit = function ()
  {
    $("#copy-instead-of-move").on("click", aEvent => {
      if (aEvent.target.checked) {
        if (aeClippingsTree.getTree().activeNode.folder) {
          $("#move-to-label").text(browser.i18n.getMessage("labelCopyFolder"));
        }
        else {
          $("#move-to-label").text(browser.i18n.getMessage("labelCopyClipping"));
        }
        $("#move-dlg-action-btn").text(browser.i18n.getMessage("btnCopy"));

        // Clear any error messages since copying to same folder is allowed.
        $("#move-error").text('');
      }
      else {
        if (aeClippingsTree.getTree().activeNode.folder) {
          $("#move-to-label").text(browser.i18n.getMessage("labelMoveFolder"));
        }
        else {
          $("#move-to-label").text(browser.i18n.getMessage("labelMoveClipping"));
        }
        $("#move-dlg-action-btn").text(browser.i18n.getMessage("btnMove"));
      }
    });
  };

  moveTo.onInit = function ()
  {
    if (this.fldrTree) {
      this.fldrTree.getTree().getNodeByKey(Number(aeConst.ROOT_FOLDER_ID).toString()).setActive();
    }
    else {
      let hideSyncFldr = gPrefs.isSyncReadOnly && !gPrefs.cxtMenuSyncItemsOnly;
      this.fldrTree = new aeFolderPicker(
          "#move-to-fldr-tree",
          gClippingsDB,
          aeConst.ROOT_FOLDER_ID,
          browser.i18n.getMessage("rootFldrName"),
          aeFolderPicker.ROOT_FOLDER_CLS,
          null,
          hideSyncFldr
      );

      // Attach event handler every time the folder tree is regenerated.
      this.find("#move-to-fldr-tree").on("click", aEvent => {
        log("Clippings::pg.js: gDialog.moveTo: Detected 'click' event in the folder tree");
        $("#move-error").text('');
      });
    }

    // Workaround to allow keyboard navigation into the folder tree list.
    $("#activate-move-to-fldr-tree").on("focus", aEvent => {
      try {
        this.fldrTree.getContainer().focus();
      }
      catch (e) {
        // Ignore thrown exception; it still works.
      }
    });

    let activeNode = aeClippingsTree.getTree().activeNode;
    let nodeID = parseInt(activeNode.key);
    let isSyncedItem;

    if (activeNode.folder) {
      $("#move-to-label").text(browser.i18n.getMessage("labelMoveFolder"));
      isSyncedItem = gSyncedItemsIDs.has(nodeID + "F");
    }
    else {
      $("#move-to-label").text(browser.i18n.getMessage("labelMoveClipping"));
      isSyncedItem = gSyncedItemsIDs.has(nodeID + "C");
    }

    // Only allow copying a clipping or folder out of Synced Clippings folder
    // if sync file is read-only.
    if (gPrefs.syncClippings && gPrefs.isSyncReadOnly && isSyncedItem) {
      $("#copy-instead-of-move").trigger("click").prop("disabled", true);
    }
  };

  moveTo.onCancel = function (aEvent)
  {
    this.resetTree();
    this.close();
  };

  moveTo.onAccept = function (aEvent)
  {
    let clippingsMgrTree = aeClippingsTree.getTree();
    let selectedNode = clippingsMgrTree.activeNode;
    let id = parseInt(selectedNode.key);
    let parentNode = selectedNode.getParent();

    this.selectedFldrNode = this.fldrTree.getTree().activeNode;

    let parentFolderID = (parentNode.isRootNode() ? aeConst.ROOT_FOLDER_ID : parseInt(parentNode.key));
    let destFolderID = parseInt(this.selectedFldrNode.key);

    log(`clippingsMgr.js: Move To dialog: ID of selected item: ${id}; it is ${selectedNode.isFolder()} that the selected item in the clippings tree is a folder; current parent of selected item: ${parentFolderID}; move or copy to folder ID: ${destFolderID}`);

    // Don't allow moving/copying to Synced Clippings folder if the sync file
    // is read-only.
    if (gSyncedItemsIDs.has(destFolderID + "F") && gPrefs.isSyncReadOnly) {
      $("#move-error").text(browser.i18n.getMessage("syncFldrRdOnly"));
      return;
    }

    let makeCopy = $("#copy-instead-of-move").prop("checked");

    if (parentFolderID == destFolderID && !makeCopy) {
      $("#move-error").text(browser.i18n.getMessage("errMoveToSameParent"));
      return;
    }

    // Handle case where selected folder and destination folder are the same.
    if (selectedNode.isFolder() && id == destFolderID) {
      $("#move-error").text(browser.i18n.getMessage("errMoveToSubfldr"));
      return;
    }

    // Prevent infinite recursion when moving or copying a folder into one of
    // its subfolders.
    if (this.selectedFldrNode.isFolder()) {
      let parentNode, parentID;
      parentNode = this.selectedFldrNode.getParent();
      parentID = parentNode.isRootNode() ? aeConst.ROOT_FOLDER_ID : parseInt(parentNode.key);

      while (parentID != aeConst.ROOT_FOLDER_ID) {
        if (parentID == id) {
          $("#move-error").text(browser.i18n.getMessage("errMoveToSubfldr"));
          return;
        }
        parentNode = parentNode.getParent();
        parentID = parentNode.isRootNode() ? aeConst.ROOT_FOLDER_ID : parseInt(parentNode.key);
      }
    }

    if (selectedNode.isFolder()) {
      if (makeCopy) {
        gCmd.copyFolderIntrl(id, destFolderID, gCmd.UNDO_STACK);
      }
      else {
        gCmd.moveFolderIntrl(id, destFolderID, gCmd.UNDO_STACK);
      }
    }
    else {
      if (makeCopy) {
        gCmd.copyClippingIntrl(id, destFolderID, gCmd.UNDO_STACK);
      }
      else {
        gCmd.moveClippingIntrl(id, destFolderID, gCmd.UNDO_STACK);
      }
    }

    this.resetTree();
    this.close();
  };

  moveTo.onUnload = function ()
  {
    $("#copy-instead-of-move").prop("checked", false).prop("disabled", false);
    $("#move-dlg-action-btn").text(browser.i18n.getMessage("btnMove"));
    $("#move-error").text('');
  };

  let showOnlySyncedItemsReminder = new aeDialog("#show-only-synced-items-reminder");
  showOnlySyncedItemsReminder.isDelayedOpen = false;

  showOnlySyncedItemsReminder.onShow = function ()
  {
    aePrefs.setPrefs({clippingsMgrShowSyncItemsOnlyRem: false});
    setTimeout(() => {
      let acceptBtn = $("#show-only-synced-items-reminder > .dlg-btns > .dlg-accept")[0];
      acceptBtn.focus();
    }, 100);
  };

  let syncProgress = new aeDialog("#sync-progress");
  let syncFldrFull = new aeDialog("#sync-fldr-full-error-msgbox");
  let syncFldrReadOnly = new aeDialog("#sync-file-readonly-msgbar");
  let miniHelp = new aeDialog("#mini-help-dlg");
  let genericMsgBox = new aeDialog("#generic-msg-box");

  return {
    shctKeyConflict,
    clippingMissingSrcURL,
    noUndoNotify,
    noRedoNotify,
    clipboardEmpty,
    actionUnavailable,
    requestExtPerm,
    shortcutList,
    insCustomPlchldr,
    insAutoIncrPlchldr,
    insDateTimePlchldr,
    importFromFile,
    exportToFile,
    importConfirmMsgBox,
    exportConfirmMsgBox,
    removeAllSrcURLs,
    removeAllSrcURLsConfirm,
    restoreSrcURLs,
    moveTo,
    showOnlySyncedItemsReminder,
    syncProgress,
    syncFldrFull,
    syncFldrReadOnly,
    miniHelp,
    genericMsgBox,
  };
}
