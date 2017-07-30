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
 * Portions created by the Initial Developer are Copyright (C) 2005-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */


var gOS;
var gClippingsDB;
var gBkgrdPg;


function $(aID)
{
  return document.getElementById(aID);
}


function init()
{
  gBkgrdPg = chrome.extension.getBackgroundPage();

  if (gBkgrdPg) {
    gClippingsDB = gBkgrdPg.getClippingsDB();
    console.log("Clippings/wx: clippingsMgr: Successfully opened Clippings DB");
  }
  else {
    showBanner("Error initializing Clippings Manager: Unable to locate parent browser window.");
  }
  
  document.addEventListener("unload", aEvent => { onUnload(aEvent) });
  document.addEventListener("keypress", aEvent => { onKeyPress(aEvent) });
  
  chrome.runtime.getPlatformInfo(aInfo => { gOS = aInfo.os; });

  let clippingsListElt = $("clippings-list");
  clippingsListElt.addEventListener("change", aEvent => { updateDisplay(aEvent, gClippingsDB) });
  buildClippingsList(clippingsListElt);

  $("reload").addEventListener("click", aEvent => { reload(true) });
  $("save-edits").addEventListener("click", aEvent => { saveEdits() });
  $("delete-clipping").addEventListener("click", aEvent => { deleteClipping() });
}


function buildClippingsList(aSelectElt)
{
  gClippingsDB.clippings.count().then(aResult => {
    let numClippingsInRoot = aResult;
    if (numClippingsInRoot > 0) {
      gClippingsDB.clippings.where("parentFolderID").equals(0).each((aItem, aCursor) => {
	let optionElt = document.createElement("option");
	optionElt.setAttribute("value", aItem.id);
	let optionTextElt = document.createTextNode(aItem.name);
	optionElt.appendChild(optionTextElt);
	aSelectElt.appendChild(optionElt);
      });
    }
  });
}


function onKeyPress(aEvent)
{
  if (isCtrlKeyPressed(aEvent) && aEvent.key.toLowerCase() == "w") {
    chrome.windows.remove(chrome.windows.WINDOW_ID_CURRENT);
  }
}


function isCtrlKeyPressed(aKeyboardEvent)
{
  if (gOS == "mac") {
    return (aKeyboardEvent.metaKey);
  }
  return aKeyboardEvent.ctrlKey;
}


function showBanner(aMessage)
{
  let bannerElt = $("dlg-banner");
  let bannerMsgElt = $("dlg-banner-msg");

  if (bannerMsgElt.hasChildNodes()) {
    while (bannerMsgElt.firstChild) {
      bannerMsgElt.removeChild(bannerMsgElt.firstChild);
    }
  }
  
  let textNode = document.createTextNode(aMessage);
  bannerMsgElt.appendChild(textNode);
  bannerElt.style.display = "block";
}


function updateDisplay(aEvent, aClippingsDB)
{
  let clippingsListElt = $("clippings-list");
  let clippingNameElt = $("clipping-name");
  let clippingTextElt = $("clipping-text");

  aClippingsDB.clippings.count().then(aResult => {
    let numClippingsInRoot = aResult;
    if (numClippingsInRoot > 0) {
      let selectedOptionElt = clippingsListElt.options[clippingsListElt.selectedIndex];
      let selectedClippingID = Number(selectedOptionElt.value);

      let getClipping = aClippingsDB.clippings.get(selectedClippingID);
      getClipping.then(aResult => {
	clippingNameElt.value = aResult.name;
	clippingTextElt.value = aResult.content;
      }).catch(e => { console.error(e) });
    }
  });
}


function reload(aClearTextboxes)
{
  let selectElt = $("clippings-list");

  while (selectElt.hasChildNodes()) {
    selectElt.removeChild(selectElt.firstChild);
  }
  buildClippingsList(selectElt);

  if (aClearTextboxes) {
    $("clipping-name").value = "";
    $("clipping-text").value = "";
  }
}


function saveEdits()
{
  let selectElt = $("clippings-list");

  if (selectElt.options.length == 0) {
    console.log("Clippings Manager: Nothing to save");
    return;
  }
  
  let selectedIdx = selectElt.selectedIndex;
  let selectedOptionElt = selectElt.options[selectedIdx];
  let clippingID = Number(selectedOptionElt.value);
  let clippingName = $("clipping-name").value;
  let clippingText = $("clipping-text").value;

  let updateClipping = gClippingsDB.clippings.update(clippingID, { name: clippingName, content: clippingText });

  updateClipping.then(aUpdated => {
    if (aUpdated) {
      console.log("Clippings Manager: Updated clipping \"%s\" (ID = %d)", clippingName, clippingID);
      reload();
      selectElt.selectedIndex = selectedIdx;

      gBkgrdPg.rebuildContextMenu();
    }
  });
}


function deleteClipping()
{
  let selectElt = $("clippings-list");

  if (selectElt.options.length == 0) {
    console.log("Clippings Manager: Nothing to delete");
    return;
  }
  
  let selectedOptionElt = selectElt.options[selectElt.selectedIndex];
  let clippingID = Number(selectedOptionElt.value);

  let deleteClipping = gClippingsDB.clippings.delete(clippingID);
  deleteClipping.then(() => {
    console.log("Clippings Manager: Successfully deleted clipping (ID = %d)", clippingID);
    reload(true);
    gBkgrdPg.rebuildContextMenu();
  }).catch(aError => { console.error(aError) });
}


function onUnload(aEvent)
{

}

init();
