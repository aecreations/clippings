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
 * Portions created by the Initial Developer are Copyright (C) 2005-2014
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */


var gStrBundle;
var gExportFormatList;
var gClippingsSvc;


function initDlg() 
{
  try {
    gClippingsSvc = Components.classes["clippings@mozdev.org/clippings;1"].getService(Components.interfaces.nsIClippingsService);
  }
  catch (e) {
    doAlert(e);
  }

  gStrBundle = document.getElementById("clippings-strings");
  gExportFormatList = document.getElementById("export-format-list");
  gExportFormatList.selectedIndex = 0;
  gExportFormatList.focus();
  gExportFormatList.click();

  // Hidden HTML editor - HTML export hack!
  var editor = document.getElementById("html-export");
  editor.src = "export.html";
  editor.makeEditable("html", false);
}


function exportFormatList_click(event)
{
  var formatDesc = document.getElementById("format-description");
  if (formatDesc.firstChild) {
    formatDesc.removeChild(formatDesc.firstChild);
  }

  var desc;

  switch (gExportFormatList.selectedIndex) {
  case 0:
    desc = gStrBundle.getString("clippingsFmtDesc");
    break;

  case 1:
    desc = gStrBundle.getString("htmlFmtDesc");
    break;

  default:
    break;
  }

  var textNode = document.createTextNode(desc);
  formatDesc.appendChild(textNode);
}


function doExport()
{
  var fileType;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(Components.interfaces.nsIFilePicker);
  fp.init(window, gStrBundle.getString("dlgTitleExportClippings"), fp.modeSave);

  switch (gExportFormatList.selectedIndex) {
  case 0:      
    fp.defaultString = gStrBundle.getString("clipdat2.rdf");
    fp.defaultExtension = "rdf";
    fp.appendFilter(gStrBundle.getString("rdfExportFilterDesc"), "*.rdf");
    fileType = gClippingsSvc.FILETYPE_RDF_XML;
    break;

  case 1:
    fp.defaultString = gStrBundle.getString("clippings.html");
    fp.defaultExtension = "html";
    fp.appendFilter(gStrBundle.getString("htmlFilterDesc"), "*.html");
    break;

  default:
    break;
  }

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
	  || fileType == gClippingsSvc.FILETYPE_CLIPPINGS_1X) {

	fnExport = function () { 
	  gClippingsSvc.exportToFile(url, fileType);
	};
      }
      // HTML export.
      else {
	var bodyElt = gClippingsSvc.getClippingsAsHTMLNodes();
	var editor = document.getElementById("html-export");
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
	doAlert(gStrBundle.getString("alertExportFailedNoDS"));
      }
      catch (e if e.result == Components.results.NS_ERROR_OUT_OF_MEMORY) {
	doAlert(gStrBundle.getString("errorOutOfMemory"));
      }
      catch (e if e.result == Components.results.NS_ERROR_FILE_ACCESS_DENIED) {
	doAlert(gStrBundle.getString("errorAccessDenied"));
      }
      catch (e if e.result == Components.results.NS_ERROR_FILE_READ_ONLY) {
	doAlert(gStrBundle.getString("errorFileReadOnly"));
      }
      catch (e if e.result == Components.results.NS_ERROR_FILE_DISK_FULL) {
	doAlert(gStrBundle.getString("errorDiskFull"));
      }
      catch (e) {
	doAlert(gStrBundle.getString("alertExportFailed"));
      }

      doAlert(gStrBundle.getFormattedString("exportSuccess", [path]));
      window.close();
    }
  };

  fp.open(fpShownCallback);
}


function doAlert(aMessage) 
{
  var title = gStrBundle.getString("appName");
  var prmpt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
  prmpt.alert(null, title, aMessage);
}


function doCancel() {
  return true;
}
