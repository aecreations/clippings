/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let gClippingsDB = null;
let gClippings = null;

let gClippingsListener = {
  origin: null,

  afterBatchChanges: function () {
    // Populate import statistics.
    $("#import-statistics").text(".");
    
    gClippingsDB.transaction("r", gClippingsDB.clippings, gClippingsDB.folders, () => {
      let numItems = 0;
    
      gClippingsDB.folders.count().then(aNumFldrs => {
        $("#import-statistics").text("..");
        numItems += aNumFldrs;
        return gClippingsDB.clippings.count();

      }).then(aNumClippings => {
        $("#import-statistics").text("...");
        numItems += aNumClippings;
        $("#import-statistics").text(`Imported ${numItems} items.`);
      });
    }).catch(aErr => {
      console.error("Clippings/wx: welcome.js: gClippingsListener.afterBatchChanges(): " + aErr);
    });
  },
  
  newClippingCreated: function (aID, aData) {},
  newFolderCreated: function (aID, aData) {},
  clippingChanged: function (aID, aData, aOldData) {},
  folderChanged: function (aID, aData, aOldData) {},
  clippingDeleted: function (aID, aOldData) {},
  folderDeleted: function (aID, aOldData) {}
};


// Page initialization
$(() => {
  gClippings = chrome.extension.getBackgroundPage();

  if (! gClippings) {
    showModal("#private-browsing-error-msgbox");
    
    throw new Error("Clippings/wx: welcome.js: Failed to retrieve parent browser window!");
  }

  gClippingsDB = gClippings.getClippingsDB();
  aeImportExport.setDatabase(gClippingsDB);

  let os = gClippings.getOS();
  let pgURL = new URL(window.location.href);

  browser.history.deleteUrl({ url: pgURL.href });

  let clippingsListeners = gClippings.getClippingsListeners();
  gClippingsListener.origin = clippingsListeners.ORIGIN_WELCOME_PG;
  clippingsListeners.add(gClippingsListener);
  
  $("#goto-import-bkup").click(aEvent => {
    function initImportPg() {
      gClippings.verifyDB().then(aNumClippings => {
        console.log(`Clippings/wx: welcome.js: Database verification successful (${aNumClippings} clippings in database).`);

      }).catch(aErr => {
        console.error("Clippings/wx: welcome.js: $(#goto-import-bkup).click()::initImportPg(): " + aErr);

        // OpenFailedError thrown if Dexie can't open the database.  This
        // happens if Private Browsing mode is turned on, or if Firefox is set
        // to "Never remember history."
        // TypeError thrown if gClippingsDB is null. This happens if browser
        // cookies are turned off.
        if (aErr.name && (aErr.name == "OpenFailedError" || aErr.name == "TypeError")) { 
          showModal("#private-browsing-error-msgbox");
          browser.storage.local.set({ showWelcome: true });
        }
      });
    }
    
    $("#welcome-pg").hide();
    $("#select-backup-file-pg").fadeIn("slow");

    window.setTimeout(() => { initImportPg() }, 800);
  });

  $("#goto-quick-start").click(aEvent => {
    window.location.href = "http://aecreations.sourceforge.net/clippings/quickstart.php";
  })

  $("#dismiss-welcome").click(aEvent => {
    showModal("#dismiss-welcome-dlg");
  });

  $("#toggle-no-backup-help").click(aEvent => {
    if ($("#no-backup-help:hidden").length > 0) {
      $("#toggle-no-backup-help > .expander-icon").text("\u25bc ");
      $("#no-backup-help").fadeIn("slow", "linear");
    }
    else {
      $("#toggle-no-backup-help > .expander-icon").text("\u25b6 ");
      $("#no-backup-help").hide(400);
    }
  })

  let osFileBrwsApp = "";
  let keybdPasteKey = "ALT\u00a0+\u00a0SHIFT\u00a0+\u00a0Y";
  
  if (os == "win") {
    osFileBrwsApp = "Windows Explorer";
  }
  else if (os == "mac") {
    osFileBrwsApp = "Finder";
    keybdPasteKey = "\u2318\u21e7Y";
  }
  $("#os-file-browser").text(osFileBrwsApp);
  $("#keybd-paste-key").text(keybdPasteKey);

  if (os != "win") {
    $("#hidden-bkup-fldr-note").text(" (You may need to use the command line to see this folder.)");
  }
  
  $("#import-clippings-file-upload").on("change", aEvent => {
    $("#import-failed").hide();
    $("#ready-import").fadeIn("slow", "linear");

    let filename = aEvent.target.files[0].name;
    $("#import-clippings-file-name").val(filename);
  });
  
  $("#skip-import").click(aEvent => {
    showModal("#skip-import-dlg");
  });

  $("#select-backup-pg-back-link").click(aEvent => {
    $("#select-backup-file-pg").hide();
    resetSelectBackupFilePageState();    
    $("#welcome-pg").fadeIn("fast");
  })
  
  $("#import-btn").click(aEvent => {
    function uploadImportFile(aFileList) {
      $("#import-progress-bar").attr("value", "1");
      if (aFileList.length == 0) {
        return;
      }
      
      $("#import-progress-bar").attr("value", "2");
      
      let importFile = aFileList[0];
      console.log("Clippings/wx: welcome.js: Selected import file: '%s'\nFile size: %d bytes", importFile.name, importFile.size);

      $("#import-progress-bar").attr("value", "5");
      
      let fileReader = new FileReader();
      fileReader.addEventListener("load", aEvent => {
        $("#import-progress-bar").attr("value", "10");
        let rawData = aEvent.target.result;
        let replaceShortcutKeys = true;
        
        try {
          if (importFile.name.endsWith(".json")) {
            aeImportExport.importFromJSON(rawData, replaceShortcutKeys);
          }
          else if (importFile.name.endsWith(".rdf")) {
            aeImportExport.importFromRDF(rawData, replaceShortcutKeys);
          }
        }
        catch (e) {
          console.error(e);
          $("#import-failed").fadeIn("fast");
          return;
        }

        // Reached here if import successful.
        $("#import-progress-bar").attr("value", "98");
        $("#import-status").text("Importing clippings... done!");
        $("#import-completed").show();
        $("#import-progress-bar").attr("value", "100");
      });

      fileReader.readAsText(importFile);
    } // END nested function uploadimportFile()

    let inputFileElt = $("#import-clippings-file-upload")[0];

    if (! inputFileElt.value) {
      // This should never happen.
      window.alert("Please select a file.");
      return;
    }
    
    $("#select-backup-file-pg").hide();
    $("#import-backup-pg").fadeIn("slow");

    window.setTimeout(() => { uploadImportFile(inputFileElt.files) }, 1500);
  });

  $("#retry-import").click(aEvent => {
    $("#import-backup-pg").hide();
    resetSelectBackupFilePageState();
    $("#select-backup-file-pg").fadeIn("fast");
  });

  $("#finish-btn").click(aEvent => {
    closePage();
  });

  $("#open-clippings-mgr").click(aEvent => {
    gClippings.openClippingsManager();
  });
  
  initDialogs();
});


// Closing Welcome page
$(window).on("beforeunload", aEvent => {
  let clippingsListeners = gClippings.getClippingsListeners();
  clippingsListeners.remove(gClippingsListener);
});


// Suppress browser's context menu.
$(document).on("contextmenu", aEvent => { aEvent.preventDefault() });


function resetSelectBackupFilePageState()
{
  $("#import-clippings-file-upload").val("");
  $("#import-progress-bar").attr("value", "0");
  $("#ready-import").hide();
  $("#no-backup-help").hide();
  $("#toggle-no-backup-help > .expander-icon").text("\u25b6 ");
}


function initDialogs()
{
  $("#skip-import-dlg .dlg-accept, #dismiss-welcome-dlg .dlg-accept, #private-browsing-error-msgbox .dlg-accept").click(aEvent => {
    closePage();
  });

  $("#skip-import-dlg .dlg-cancel").click(aEvent => {
    $("#skip-import-dlg").removeClass("lightbox-show");    
    $("#lightbox-bkgrd-ovl").hide();
  });

  $("#dismiss-welcome-dlg .dlg-cancel").click(aEvent => {
    $("#dismiss-welcome-dlg").removeClass("lightbox-show");    
    $("#lightbox-bkgrd-ovl").hide();
  });
}


function showModal(aDlgEltSelector)
{
  $("#lightbox-bkgrd-ovl").show();
  $(aDlgEltSelector).addClass("lightbox-show");
}


function closePage()
{
  browser.tabs.getCurrent().then(aTab => {
    return browser.tabs.remove(aTab.id);
  }).catch(aErr => {
    console.error("Clippings/wx: welcome.js: " + aErr);
  });
}
