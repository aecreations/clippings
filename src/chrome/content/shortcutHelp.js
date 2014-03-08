/* -*- mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 2012-2014
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");
Components.utils.import("resource://clippings/modules/aeString.js");


const Cc = Components.classes;
const Ci = Components.interfaces;

const OUTPUT_PRINTER = 0;
const OUTPUT_FILE = 1;

var gDlgArgs, gStrBundle, gEditor;


function $(aID)
{
  return document.getElementById(aID);
}


function initDlg() 
{
  gDlgArgs = window.arguments[0];
  var keyMap = gDlgArgs.keyMap;
  var keyCount = gDlgArgs.keyCount;

  gStrBundle = $("ae-clippings-strings");

  var treeChildren = $("grid-content");

  for (let key in keyMap) {
    var treeItem = document.createElement("treeitem");
    var treeRow = document.createElement("treerow");
    var treeCellShortcutKey = document.createElement("treecell");
    var treeCellClippingName = document.createElement("treecell");
     
    treeCellShortcutKey.setAttribute("label", key);
    treeCellClippingName.setAttribute("label", keyMap[key].name);
    treeCellClippingName.setAttribute("value", keyMap[key].uri);

    treeRow.appendChild(treeCellShortcutKey);
    treeRow.appendChild(treeCellClippingName);
    treeItem.appendChild(treeRow);
    treeChildren.appendChild(treeItem);
  }

  // Hidden HTML editor - HTML export hack!
  gEditor = $("html-export");
  gEditor.src = "export.html";
  gEditor.makeEditable("html", false);
}


function doPrint() 
{
  outputShortcutList(OUTPUT_PRINTER);
}


function doSave() 
{
  outputShortcutList(OUTPUT_FILE);
}


function outputShortcutList(aOutputMode)
{
  gEditor.focus();
  var doc = gEditor.contentDocument;
  var body = doc.getElementsByTagName("body")[0];
  var hdg = doc.createElement("h1");
  var txtHdg = doc.createTextNode(gStrBundle.getString("shortcutHelpTitle"));
  hdg.appendChild(txtHdg);
  body.appendChild(hdg);

  var pAppInfo = doc.createElement("p");
  pAppInfo.className = "app-info";
  pAppInfo.style.fontSize = "small";

  var txtAppInfo = doc.createTextNode(gStrBundle.getFormattedString("clippingsOnHostAppNameAndVer", [Application.name, Application.version]));
  pAppInfo.appendChild(txtAppInfo);
  body.appendChild(pAppInfo);

  var pHelp = doc.createElement("p");
  var helpStr;
  if (Application.id == aeConstants.HOSTAPP_FX_GUID) {
    helpStr = gStrBundle.getFormattedString("shortcutInstr", [gStrBundle.getString("pasteIntoFx")]);
  }
  else if (Application.id == aeConstants.HOSTAPP_TB_GUID) {
    helpStr = gStrBundle.getFormattedString("shortcutInstr", [gStrBundle.getString("pasteIntoTb")]);
  }

  var txtHelp = doc.createTextNode(helpStr);
  pHelp.appendChild(txtHelp);
  body.appendChild(pHelp);

  var table = doc.createElement("table");
  table.setAttribute("border", "2");
  var thead = doc.createElement("thead");
  var trHdr = doc.createElement("tr");
  var thShortcutKey = doc.createElement("th");
  var txtShortcutKey = doc.createTextNode(gStrBundle.getString("shortcutKeyTitle"));
  thShortcutKey.appendChild(txtShortcutKey);
  var thClipping = doc.createElement("th");
  var txtClipping = doc.createTextNode(gStrBundle.getString("clippingNameTitle"));
  thClipping.appendChild(txtClipping);
  trHdr.appendChild(thShortcutKey);
  trHdr.appendChild(thClipping);
  thead.appendChild(trHdr);
  table.appendChild(thead);
  
  var tbody = doc.createElement("tbody");
  var keyMap = gDlgArgs.keyMap;

  for (let key in keyMap) {
    var tr = doc.createElement("tr");
    var tdKey = doc.createElement("td");
    var txtKey = doc.createTextNode(key);
    tdKey.appendChild(txtKey);
    var tdClipping = doc.createElement("td");
    var txtClipping = doc.createTextNode(keyMap[key].name);
    tdClipping.appendChild(txtClipping);
    tr.appendChild(tdKey);
    tr.appendChild(tdClipping);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  body.appendChild(table);

  var css = "";
  var data = "";
  if (aOutputMode == OUTPUT_PRINTER) {
    // Show printing instructions in the HTML output generated from Thunderbird
    // since most browsers warn or block JavaScript code that automatically
    // closes the browser window.
    if (gDlgArgs.printToExtBrowser) {
      css = '<style type="text/css" media="screen">'
          + ' .print-instructions {'
	  + '   background-color: #FFFFC0;'
	  + '   border: 1px solid #F8BF24;'
          + '   padding: 8px; '
          + '   font-family: sans-serif; font-weight: bold; '
	  + "} </style>"
          + '<style type="text/css" media="print">'
          + ' .print-instructions { '
	  + '   display: none; '
	  + "} </style>";
      data = '<body><p><span class="print-instructions">' + gStrBundle.getString("printShortcutHelpHTML") + "</span></p>";
    }
    else {
      data = '<body onload="window.print();window.close()">';
    }
  }
  else {
    data = "<body>";
  }
  data += body.innerHTML + "</body>";

  var doctype = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">';
  var meta = '<META http-equiv="Content-Type" content="text/html; charset=UTF-8">';
  var header = "<html><head>" + meta + "<title>" + gStrBundle.getString("shortcutHelpTitle") + "</title>" + css + "</head>";
  var footer = "</html>";
  data = doctype + "\n" + header + "\n" + data + "\n" + footer;

  // Leverage method nsIClippingsService.writeFile()
  var clippingsSvc = Cc["clippings@mozdev.org/clippings;1"].getService(Ci.nsIClippingsService);

  if (aOutputMode == OUTPUT_PRINTER) {
    // Write the HTML data to a temp file.
    var tempFile = FileUtils.getFile("TmpD", [aeConstants.SHORTCUT_HELP_PRINT_FILENAME]);
    tempFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);

    aeUtils.log("Temp file path: " + tempFile.path);

    var tempFileURL = aeUtils.getURLFromFilePath(tempFile.path);

    try {
      clippingsSvc.writeFile(tempFileURL, data);
    }
    catch (e if e.result == Components.results.NS_ERROR_OUT_OF_MEMORY) {
      aeUtils.alertEx(title, gStrBundle.getString("errorOutOfMemory"));
      return;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_ACCESS_DENIED) {
      let msg = aeString.format("%s: %s",
			        gStrBundle.getString("errorAccessDenied"),
			        aeConstants.SHORTCUT_HELP_PRINT_FILENAME);
      aeUtils.alertEx(title, msg);
      return;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_IS_LOCKED) {
      let msg = aeString.format("%s: %s",
			        gStrBundle.getString("errorFileLocked"),
			        aeConstants.SHORTCUT_HELP_PRINT_FILENAME);
      aeUtils.alertEx(title, msg);
      return;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_TOO_BIG) {
      let msg = aeString.format("%s: %s",
			        gStrBundle.getString("errorFileTooBig"),
			        aeConstants.SHORTCUT_HELP_PRINT_FILENAME);
      aeUtils.alertEx(title, msg);
      return;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_READ_ONLY) {
      let msg = aeString.format("%s: %s",
			        gStrBundle.getString("errorFileReadOnly"),
			        aeConstants.SHORTCUT_HELP_PRINT_FILENAME);
      aeUtils.alertEx(title, msg);
      return;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_DISK_FULL) {
      let msg = aeString.format("%s: %s",
			        gStrBundle.getString("errorDiskFull"),
			        aeConstants.SHORTCUT_HELP_PRINT_FILENAME);
      aeUtils.alertEx(title, msg);
      return;
    }
    catch (e) {
      aeUtils.alertEx(title, gStrBundle.getString("errorSaveFailed"));
      return;
    }

    // Open the temp file and automatically print it.
    if (gDlgArgs.printToExtBrowser) {
      // If on Thunderbird, open the generated HTML document in the default
      // web browser.
      tempFile.launch();
    }
    else {
      window.open(tempFileURL);
    }
  }
  else if (aOutputMode == OUTPUT_FILE) {
    // Save shortcut key list to an HTML document.
    let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window, gStrBundle.getString("saveToHTML"), fp.modeSave);

    fp.defaultString = aeConstants.SHORTCUT_HELP_FILENAME;
    fp.defaultExtension = "html";
    fp.appendFilter(gStrBundle.getString("htmlFilterDesc"), "*.html");

    let fpShownCallback = {
      done: function (aResult) {

        if (aResult == fp.returnCancel) {
          return;
        }

        if (aResult == fp.returnReplace) {
          var oldFile = fp.file.QueryInterface(Ci.nsIFile);
          oldFile.remove(false);
        }

	var url = fp.fileURL.QueryInterface(Ci.nsIURI).spec;

	try {
	  clippingsSvc.writeFile(url, data);
	}
        catch (e if e.result == Components.results.NS_ERROR_OUT_OF_MEMORY) {
          aeUtils.alertEx(title, gStrBundle.getString("errorOutOfMemory"));
        }
        catch (e if e.result == Components.results.NS_ERROR_FILE_ACCESS_DENIED) {
          let msg = aeString.format("%s: %s",
                                    gStrBundle.getString("errorAccessDenied"),
                                    aeConstants.SHORTCUT_HELP_PRINT_FILENAME);
          aeUtils.alertEx(title, msg);
        }
        catch (e if e.result == Components.results.NS_ERROR_FILE_IS_LOCKED) {
          let msg = aeString.format("%s: %s",
                                    gStrBundle.getString("errorFileLocked"),
                                    aeConstants.SHORTCUT_HELP_PRINT_FILENAME);
          aeUtils.alertEx(title, msg);
        }
        catch (e if e.result == Components.results.NS_ERROR_FILE_TOO_BIG) {
          let msg = aeString.format("%s: %s",
                                    gStrBundle.getString("errorFileTooBig"),
                                    aeConstants.SHORTCUT_HELP_PRINT_FILENAME);
          aeUtils.alertEx(title, msg);
        }
        catch (e if e.result == Components.results.NS_ERROR_FILE_READ_ONLY) {
          let msg = aeString.format("%s: %s",
                                    gStrBundle.getString("errorFileReadOnly"),
                                    aeConstants.SHORTCUT_HELP_PRINT_FILENAME);
          aeUtils.alertEx(title, msg);
        }
        catch (e if e.result == Components.results.NS_ERROR_FILE_DISK_FULL) {
          let msg = aeString.format("%s: %s",
                                    gStrBundle.getString("errorDiskFull"),
                                    aeConstants.SHORTCUT_HELP_PRINT_FILENAME);
          aeUtils.alertEx(title, msg);
        }
        catch (e) {
          aeUtils.alertEx(title, gStrBundle.getString("errorSaveFailed"));
        }

        // Clear contents of the hidden HTML document so that it doesn't get 
        // appended repeatedly when invoking either print or save again.
        body.innerHTML = "";
      }
    };

    fp.open(fpShownCallback);
  }
}
