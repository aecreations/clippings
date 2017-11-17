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
 * Portions created by the Initial Developer are Copyright (C) 2005-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");

var gStrBundle;
var gExportFormatList;
var gClippingsSvc;


//
// DOM utility function
//

function $(aID) {
  return document.getElementById(aID);
}



function init() 
{
  try {
    gClippingsSvc = Components.classes["clippings@mozdev.org/clippings;1"].getService(Components.interfaces.aeIClippingsService);
  }
  catch (e) {
    alertEx(e);
  }

  gStrBundle = $("clippings-strings");
  gExportFormatList = $("export-format-list");
  gExportFormatList.selectedIndex = 0;
  gExportFormatList.focus();
  gExportFormatList.click();

  // Hidden HTML editor - HTML export hack!
  var editor = $("html-export");
  editor.src = "export.html";
  editor.makeEditable("html", false);

  // On Thunderbird, hide the checkbox for including source URLs in RDF export.
  if (aeUtils.getHostAppID() == aeConstants.HOSTAPP_TB_GUID) {
    $("include-src-urls").hidden = true;
  }
}


function exportFormatList_click(event)
{
  var formatDesc = $("format-description");
  if (formatDesc.firstChild) {
    formatDesc.removeChild(formatDesc.firstChild);
  }

  var includeSrcURLs = $("include-src-urls");
  var desc;

  switch (gExportFormatList.selectedIndex) {
  case 0:
    desc = gStrBundle.getString("clippingsFmtDesc");
    includeSrcURLs.disabled = false;
    if (exportFormatList_click.inclSrcURLsChecked) {
      includeSrcURLs.checked = true;
      exportFormatList_click.inclSrcURLsChecked = null;
    }
    break;

  case 1:
    desc = gStrBundle.getString("clippingsWxFmtDesc");
    includeSrcURLs.disabled = false;
    if (exportFormatList_click.inclSrcURLsChecked) {
      includeSrcURLs.checked = true;
      exportFormatList_click.inclSrcURLsChecked = null;
    }
    break;

  case 2:
    desc = gStrBundle.getString("csvFmtDesc");
    includeSrcURLs.disabled = true;
    if (includeSrcURLs.checked) {
      exportFormatList_click.inclSrcURLsChecked = true;
    }
    includeSrcURLs.checked = false;
    break;
    
  case 3:
    desc = gStrBundle.getString("htmlFmtDesc");
    includeSrcURLs.disabled = true;
    if (includeSrcURLs.checked) {
      exportFormatList_click.inclSrcURLsChecked = true;
    }
    includeSrcURLs.checked = false;
    break;

  default:
    break;
  }

  var textNode = document.createTextNode(desc);
  formatDesc.appendChild(textNode);
}

exportFormatList_click.inclSrcURLsChecked = null;


function exportClippings()
{
  var fileType;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(Components.interfaces.nsIFilePicker);
  fp.init(window, gStrBundle.getString("dlgTitleExportClippings"), fp.modeSave);

  switch (gExportFormatList.selectedIndex) {
  case 0:  // Clippings RDF/XML
    fp.defaultString = gStrBundle.getString("clipdat2.rdf");
    fp.defaultExtension = "rdf";
    fp.appendFilter(gStrBundle.getString("rdfExportFilterDesc"), "*.rdf");
    fileType = gClippingsSvc.FILETYPE_RDF_XML;
    break;

  case 1:  // Clippings/wx JSON
    fp.defaultString = gStrBundle.getString("clippings.json");
    fp.defaultExtension = "json";
    fp.appendFilter(gStrBundle.getString("wxJSONExportFilterDesc"), "*.json");
    fileType = gClippingsSvc.FILETYPE_WX_JSON;
    break;

  case 2:  // CSV
    fp.defaultString = gStrBundle.getString("clippings.csv");
    fp.defaultExtension = "csv";
    fp.appendFilter(gStrBundle.getString("csvExportFilterDesc"), "*.csv");
    fileType = gClippingsSvc.FILETYPE_CSV;
    break;
    
  case 3:  // HTML
    fp.defaultString = gStrBundle.getString("clippings.html");
    fp.defaultExtension = "html";
    fp.appendFilter(gStrBundle.getString("htmlFilterDesc"), "*.html");
    break;

  default:
    break;
  }

  let includeSrcURLs = $("include-src-urls");

  let fpShownCallback = {
    done: function (aResult) {
      if (aResult == fp.returnCancel) {
        return;
      }

      if (aResult == fp.returnReplace) {
	var oldFile = fp.file.QueryInterface(Components.interfaces.nsIFile);
	oldFile.remove(false);
      }

      var url = fp.fileURL.QueryInterface(Components.interfaces.nsIURI).spec;
      var path = fp.file.QueryInterface(Components.interfaces.nsIFile).path;
      var fnExport;

      if (fileType == gClippingsSvc.FILETYPE_RDF_XML
	  || fileType == gClippingsSvc.FILETYPE_CLIPPINGS_1X
          || fileType == gClippingsSvc.FILETYPE_WX_JSON
          || fileType == gClippingsSvc.FILETYPE_CSV) {

	fnExport = function () { 
	  gClippingsSvc.exportToFile(url, fileType, includeSrcURLs.checked);
	};
      }
      // HTML export.
      else {
	var bodyElt = gClippingsSvc.getClippingsAsHTMLNodes();
	var editor = $("html-export");
	editor.focus();
	var htmlEditor = editor.getHTMLEditor(editor.contentWindow);
	var bodyEltEx = editor.contentDocument.importNode(bodyElt, true);
	htmlEditor.insertElementAtSelection(bodyEltEx, true);
	var data = editor.contentDocument.getElementsByTagName("body").item(0).innerHTML;
	data = data.replace(/&lt;br&gt;/g, "<br>");

	var charset = "UTF-8";
	var doctype = "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01 Transitional//EN\" \"http://www.w3.org/TR/REC-html40/loose.dtd\">";
	var meta = "<META http-equiv=\"Content-Type\" content=\"text/html; charset=" + charset + "\">";
	var header = "<html><head>" + meta + "<title>" + gStrBundle.getString("appName") + "</title></head>";
	var footer = "</html>";
	data = doctype + "\n" + header + "\n" + data + "\n" + footer;

	fnExport = function () {
	  gClippingsSvc.writeFile(url, data);
	};
      }

      try {
	fnExport();
      }
      catch (e if e.result == Components.results.NS_ERROR_NOT_INITIALIZED) {
	alertEx(gStrBundle.getString("alertExportFailedNoDS"));
      }
      catch (e if e.result == Components.results.NS_ERROR_OUT_OF_MEMORY) {
	alertEx(gStrBundle.getString("errorOutOfMemory"));
      }
      catch (e if e.result == Components.results.NS_ERROR_FILE_ACCESS_DENIED) {
	alertEx(gStrBundle.getString("errorAccessDenied"));
      }
      catch (e if e.result == Components.results.NS_ERROR_FILE_READ_ONLY) {
	alertEx(gStrBundle.getString("errorFileReadOnly"));
      }
      catch (e if e.result == Components.results.NS_ERROR_FILE_DISK_FULL) {
	alertEx(gStrBundle.getString("errorDiskFull"));
      }
      catch (e) {
	alertEx(gStrBundle.getString("alertExportFailed"));
      }

      alertEx(gStrBundle.getFormattedString("exportSuccess", [path]));
      window.close();
    }
  };

  fp.open(fpShownCallback);
}


function alertEx(aMessage) 
{
  var title = gStrBundle.getString("appName");
  var prmpt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
  prmpt.alert(null, title, aMessage);
}


function cancel() {
  return true;
}
