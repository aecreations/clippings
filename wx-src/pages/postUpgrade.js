/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let gClippingsDB = null;
let gClippings = null;


// Page initialization
$(() => {
  gClippings = chrome.extension.getBackgroundPage();

  if (! gClippings) {
    throw new Error("Clippings/wx: postUpgrade.js: Failed to retrieve parent browser window!");
  }

  gClippingsDB = gClippings.getClippingsDB();
  aeImportExport.setDatabase(gClippingsDB);

  let os = gClippings.getOS();
  let pgURL = new URL(window.location.href);
  
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
  let keybdPasteKey = "ALT + SHIFT + Y";
  
  if (os == "win") {
    osFileBrwsApp = "Windows Explorer";
  }
  else if (os == "mac") {
    osFileBrwsApp = "Finder";
    keybdPasteKey = "\u8984\u8679Y";
  }
  $("#os-file-browser").text(osFileBrwsApp);
  $("#keybd-paste-key").text(keybdPasteKey);

  let previousVer = pgURL.searchParams.get("oldVer");
  let bkupFldrName = "";
  if (parseFloat(previousVer) == 5.5) {
    bkupFldrName = "clippings-backup";
  }
  else {
    bkupFldrName = ".clipbak";
    if (os != "win") {
      $("#hidden-bkup-fldr-note").text(" (You may need to use the command line to see this folder.)");
    }
  }
  $("#bkup-fldr-name").text(bkupFldrName);
  
  $("#import-clippings-file-upload").on("change", aEvent => {
    $("#import-failed").hide();
    $("#ready-import").fadeIn("slow", "linear");
  });
  
  $("#skip-import").click(aEvent => {
    showModal("skip-import-dlg");
  });
  
  $("#import-btn").click(aEvent => {
    function uploadImportFile(aFileList) {
      $("#import-progress-bar").attr("value", "1");
      if (aFileList.length == 0) {
        return;
      }
      
      $("#import-progress-bar").attr("value", "2");
      
      let importFile = aFileList[0];
      console.log("Clippings/wx: postUpgrade.js: Selected import file: '%s'\nFile size: %d bytes", importFile.name, importFile.size);

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

    // TO DO: Introduce a 1-second delay before starting import.
    uploadImportFile(inputFileElt.files);
  });

  $("#retry-import").click(aEvent => {
    $("#import-clippings-file-upload").val("");
    $("#import-backup-pg").hide();
    $("#import-progress-bar").attr("value", "0");
    $("#ready-import").hide();
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


function initDialogs()
{
  $("#skip-import-dlg .dlg-accept").click(aEvent => {
    closePage();
  });

  $("#skip-import-dlg .dlg-cancel").click(aEvent => {
    $(`#skip-import-dlg`).removeClass("lightbox-show");    
    $("#lightbox-bkgrd-ovl").hide();
  })
}


function showModal(aDlgID)
{
  $("#lightbox-bkgrd-ovl").show();
  $(`#${aDlgID}`).addClass("lightbox-show");
}


function closePage()
{
  browser.tabs.getCurrent().then(aTab => {
    return browser.tabs.remove(aTab.id);
  }).catch(aErr => {
    console.error("Clippings/wx: postUpgrade.js: " + aErr);
  });
}
