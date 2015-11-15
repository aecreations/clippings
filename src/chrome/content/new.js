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
 * Portions created by the Initial Developer are Copyright (C) 2005-2015
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

//
// This source file is shared by both new.xul and newFolder.xul
//

Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeString.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");
Components.utils.import("resource://clippings/modules/aeClippingLabelPicker.js");


var gDlgArgs = window.arguments[0].wrappedJSObject;
var gFolderMenu, gStrBundle;
var gClippingsSvc;
var gSelectedFolderURI;
var gIsFolderMenuSeparatorInitialized = false;

// Used in new.xul only
var gClippingName, gClippingText, gCreateAsUnquoted, gRemoveExtraLineBreaks;
var gClippingKey;
var gIsFolderCreated;
var gClippingLabelPicker;

// Used in newFolder.xul only
var gFolderName;

// Listener object passed to the aeClippingLabelPicker object
var gClippingLabelPickerListener = {
  selectionChanged: function (aNewLabel)
  {
    $("clipping-label").image = aeString.format("chrome://clippings/skin/images/%s", gClippingLabelPicker.getIconFileStr(aNewLabel));
  }
};


//
// DOM utility function
//

function $(aID)
{
  return document.getElementById(aID);
}


//
// Dialog box functions for both new.xul and newFolder.xul
//
    
function initDlg() 
{
  try {
    gClippingsSvc = Components.classes["clippings@mozdev.org/clippings;1"].getService(Components.interfaces.aeIClippingsService);
  }
  catch (e) {
    alert(e);
    window.close();
  }

  gStrBundle = $("ae-clippings-strings");

  // The datasource has already been initialized in the host app, so just get
  // the datasource object from the Clippings service.
  var ds = gClippingsSvc.getDataSource("");

  gFolderMenu = $("folder-menu-button");
  gFolderMenu.database.AddDataSource(ds);
  gFolderMenu.builder.rebuild();

  // newFolder.xul
  if (window.location.href == "chrome://clippings/content/newFolder.xul") {
    gFolderName = $("folder-name");
    gFolderName.value = gStrBundle.getString("newFolderName");
    gFolderName.clickSelectsAll = true;
    chooseFolder(gDlgArgs.parentFolderURI);
  }
  // new.xul
  else {
    gClippingName = $("clipping-name");
    gClippingText = $("clipping-text");
    gClippingKey  = $("clipping-key");
    gCreateAsUnquoted = $("create-as-unquoted");
    gRemoveExtraLineBreaks = $("remove-extra-linebreaks");
    var app = gStrBundle.getString("pasteIntoBothHostApps");
    var hint = gStrBundle.getFormattedString("shortcutKeyHint", [app]);

    if (aeUtils.getOS() == "Darwin") {
      // On Mac OS X, OS_TARGET is "Darwin"
      // Shortcut key hint text is different due to Mac OS X-specific issue
      // with shortcut key prefix; see bug 18879
      hint = gStrBundle.getFormattedString("shortcutKeyHintMac", [app]);

      // Remove 0-9 as shortcut key choices; digits do not work on Mac OS X
      var clippingKeyPopup = $("clipping-key-popup");
      var digitMenuitems = [];
      for (let i = 0; i < clippingKeyPopup.childNodes.length; i++) {
	var child = clippingKeyPopup.childNodes[i];
	if (! isNaN(parseInt(child.label))) {
	  digitMenuitems.push(child);
	}
      }

      while (digitMenuitems.length > 0) {
	clippingKeyPopup.removeChild(digitMenuitems.pop());
      }
    }

    $("shortcut-key-hint").setAttribute("tooltiptext", hint);

    let saveSrcURLElt = $("save-source-url");
    saveSrcURLElt.checked = gDlgArgs.saveSrcURL;

    if (! gDlgArgs.srcURL) {
      saveSrcURLElt.disabled = true;
      saveSrcURLElt.checked = false;
    }

    // Thunderbird-specific options
    if (aeUtils.getHostAppID() == aeConstants.HOSTAPP_TB_GUID) {
      $("tb-create-options-grid").style.display = "-moz-grid";
      // If there are no message quotation symbols in gDlgArgs.text, then
      // disable the "Create as unquoted text" checkbox.
      if (gDlgArgs.text.search(/^>/gm) == -1) {
	gCreateAsUnquoted.disabled = true;
      }

      // This checkbox option isn't applicable to Thunderbird, so hide it.
      $("save-source-url").hidden = true;
    }
    
    gClippingName.value = gDlgArgs.name;
    gClippingText.value = gDlgArgs.text;
    gClippingName.clickSelectsAll = true;
    gClippingText.clickSelectsAll = true;

    // Automatic spell checking
    var isSpellCheckingEnabled = aeUtils.getPref("clippings.check_spelling", true);

    if (isSpellCheckingEnabled) {
      gClippingName.setAttribute("spellcheck", "true");
      gClippingText.setAttribute("spellcheck", "true");
    }

    gIsFolderCreated = false;
    gSelectedFolderURI = gClippingsSvc.kRootFolderURI;

    gClippingLabelPicker = aeClippingLabelPicker.createInstance($("clipping-label-menupopup"));
    gClippingLabelPicker.addListener(gClippingLabelPickerListener);
  }
}


function checkForChangedFolders()
{
  if (isFolderMissing(gSelectedFolderURI)) {
    aeUtils.log("Folder does not exist.  Defaulting to root folder.");
    gSelectedFolderURI = gClippingsSvc.kRootFolderURI;
    gFolderMenu.label = gStrBundle.getString("clippingsRoot");
    gFolderMenu.style.listStyleImage  = "url('chrome://clippings/skin/images/clippings-root.svg')";
  }  
}


function isFolderMissing(aFolderURI)
{
  var rv = false;
  var exists;

  try {
    exists =  gClippingsSvc.exists(aFolderURI);
  }
  catch (e) {}

  if (! exists) {
    rv = true;
  }
  else {
    // Folders that exist, but have a detached parent folder, also qualify
    // as "missing."
    var parentURI;
    try {
      parentURI = gClippingsSvc.getParent(aFolderURI);
    }
    catch (e) {
      rv = true;
    }

    while (!rv && parentURI && parentURI != gClippingsSvc.kRootFolderURI) {
      if (gClippingsSvc.isDetached(parentURI)) {
	rv = true;
      }

      try {
	parentURI = gClippingsSvc.getParent(parentURI);
      }
      catch (e) {
	rv = true;
      }
    }
  }

  return rv;
}


function chooseFolder(aFolderURI)
{
  gSelectedFolderURI = aFolderURI;

  if (aFolderURI == gClippingsSvc.kRootFolderURI) {
    gFolderMenu.setAttribute("label", gStrBundle.getString("clippingsRoot"));
    gFolderMenu.style.listStyleImage = "url('chrome://clippings/skin/images/clippings-root.svg')";
  }
  else {
    gFolderMenu.setAttribute("label", gClippingsSvc.getName(aFolderURI));
    gFolderMenu.style.listStyleImage = "url('chrome://clippings/skin/images/folder.svg')";
  }
}


function initMenuSeparator(aMenuPopup)
{
  // Always rebuild folder menu separator
  var popup = $("folder-menu-popup");
  var oldSep = $("clippings-root-separator");
  if (oldSep) {
    popup.removeChild(oldSep);
  }

  if (gClippingsSvc.getCountSubfolders(gClippingsSvc.kRootFolderURI) > 0) {
    var clippingsRootMnuItem = $("clippings-root");
    var newSep = document.createElement("menuseparator");
    newSep.id = "clippings-root-separator";
    aMenuPopup.insertBefore(newSep, clippingsRootMnuItem.nextSibling);

    gIsFolderMenuSeparatorInitialized = true;
  }
}


// new.xul only
function createFolder()
{
  var dlgArgs = { 
    parentFolderURI: gSelectedFolderURI || gClippingsSvc.kRootFolderURI
  };

  // Temporarily disable widgets in New Clipping dialog while New Folder
  //  dialog is open.
  var okBtn = document.documentElement.getButton("accept");
  var cancelBtn = document.documentElement.getButton("cancel");
  var dlgElts = document.getElementsByTagName("*");
  var dlgEltsLen = dlgElts.length;

  for (let i = 0; i < dlgEltsLen; i++) {
    dlgElts[i].disabled = true;
  }
  okBtn.disabled = true;
  cancelBtn.disabled = true;

  dlgArgs.wrappedJSObject = dlgArgs;
  window.openDialog("chrome://clippings/content/newFolder.xul", "newfldr_dlg", "dialog,modal,centerscreen", dlgArgs);

  // After New Folder dialog is dismissed, re-enable New Clipping dlg widgets.
  for (let i = 0; i < dlgEltsLen; i++) {
    // Sometimes dlgElts[i] is undefined; not sure why, but check for it anyway
    if (dlgElts[i]) {
      dlgElts[i].disabled = false;
    }
  }
  okBtn.disabled = false;
  cancelBtn.disabled = false;

  if (dlgArgs.userCancel) {
    return;
  }

  // Remove the separator following the Clippings root folder item in
  // preparation for the folder menu rebuild.
  var popup = $("folder-menu-popup");
  var sep = $("clippings-root-separator");
  if (sep) {
    popup.removeChild(sep);
    gIsFolderMenuSeparatorInitialized = false;
  }

  gFolderMenu.builder.rebuild();
  chooseFolder(dlgArgs.newFolderURI);
  gIsFolderCreated = true;
}


// new.xul only
function updateShortcutKeyAvailability()
{
  var msgTxtNode = $("key-conflict-notification").firstChild;

  if (gClippingKey.selectedIndex == 0) {
    msgTxtNode.data = gStrBundle.getString("shortcutKeyNoneAssigned");
    return;
  }

  var selectedKey = gClippingKey.selectedItem.label;
  var keyDict = gClippingsSvc.getShortcutKeyDict();

  if (keyDict.hasKey(selectedKey)) {
    msgTxtNode.data = gStrBundle.getString("shortcutKeyUsed");
  }
  else {
    msgTxtNode.data = gStrBundle.getString("shortcutKeyNoneAssigned");
  }
}


// new.xul only
function toggleOptions()
{
  let clippingOptions = $("clipping-options");

  if (clippingOptions.hidden) {
    clippingOptions.hidden = false;
    window.sizeToContent();
    $("toggle-options").disabled = true;
  }
}


function validateClippingName(aEvent)
{
  let clippingName = aEvent.target;
  if (clippingName.value == "") {
    clippingName.value = gStrBundle.getString("untitledClipping");
  }
}


function validateFolderName(aEvent)
{
  let folderName = aEvent.target;
  if (folderName.value == "") {
    folderName.value = gStrBundle.getString("untitledFolder");
  }
}


function doOK() 
{
  if (! gSelectedFolderURI) {
    gSelectedFolderURI = gClippingsSvc.kRootFolderURI;
  }
  else {
    checkForChangedFolders();
  }

  // newFolder.xul
  if (window.location.href == "chrome://clippings/content/newFolder.xul") {
    var name = gFolderName.value;
    var uri = gClippingsSvc.createNewFolderEx(gSelectedFolderURI, null, name, null, false, gClippingsSvc.ORIGIN_NEW_CLIPPING_DLG);
    gDlgArgs.newFolderURI = uri;
  }
  // new.xul
  else {
    var clipText = gClippingText.value;

    // Thunderbird only
    if (gCreateAsUnquoted.checked) {
      clipText = clipText.replace(/^>>* ?(>>* ?)*/gm, "");
    }
    if (gRemoveExtraLineBreaks.checked) {
      clipText = clipText.replace(/([^\n])( )?\n([^\n])/gm, "$1 $3");
    }

    gDlgArgs.name = gClippingName.value;
    gDlgArgs.text = clipText;
    gDlgArgs.saveSrcURL = $("save-source-url").checked;
    gDlgArgs.destFolder = gSelectedFolderURI;

    // Label
    gDlgArgs.label = gClippingLabelPicker.selectedLabel;

    // Shortcut key
    if (gClippingKey.selectedIndex > 0) {
      var selectedKey = gClippingKey.selectedItem.label;

      // Check if the key is already assigned to another clipping
      var keyDict = gClippingsSvc.getShortcutKeyDict();

      if (keyDict.hasKey(selectedKey)) {
	aeUtils.alertEx(gStrBundle.getString("appName"),
	   	       gStrBundle.getString("errorShortcutKeyDetail"));
	gClippingKey.focus();
	return false;
      }

      gDlgArgs.key = selectedKey;
    }

    gClippingLabelPicker.removeListener(gClippingLabelPickerListener);
  }

  gDlgArgs.userCancel = false;
  return true;
}


function doCancel() 
{
  if (window.location.href == "chrome://clippings/content/new.xul") {
    if (gIsFolderCreated) {
      gDlgArgs.destFolder = gSelectedFolderURI;
    }
    gClippingLabelPicker.removeListener(gClippingLabelPickerListener);
  }

  gDlgArgs.userCancel = true;
  return true;
}
