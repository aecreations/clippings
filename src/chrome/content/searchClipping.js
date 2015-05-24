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
 * Portions created by the Initial Developer are Copyright (C) 2013-2015
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://clippings/modules/aeUtils.js");

const Cc = Components.classes;
const Ci = Components.interfaces;


var gDlgArgs, gStrBundle;
var gClippingsSvc;

    
//
// DOM utility function
//

function $(aID) {
  return document.getElementById(aID);
}



function initDlg()
{
  gDlgArgs = window.arguments[0];
  gStrBundle = $("ae-clippings-strings");

  try {
    gClippingsSvc = Cc["clippings@mozdev.org/clippings;1"].getService(Ci.aeIClippingsService);
  }
  catch (e) {
    alert(e);
  }
}


function updateSearchResults(aSearchText)
{
  var srchResultsPopup = $("search-results-popup");
  var srchResultsListbox = $("search-results-listbox");
  while (srchResultsListbox.childNodes.length > 0) {
    srchResultsListbox.removeChild(srchResultsListbox.firstChild);
  }

  srchResultsPopup.hidePopup();

  if (aSearchText == "") {
    $("search-status").value = "";
    return;
  }

  var numMatches = {};
  var srchResults = gClippingsSvc.findByName(aSearchText, false, false, numMatches);

  if (numMatches.value == 0) {
    $("search-status").value = gStrBundle.getString("findBarNotFound");
  }
  else {
    // DEBUGGING
    $("search-status").value = gStrBundle.getFormattedString("findBarMatches", [numMatches.value]);;
    // END DEBUGGING

    // Populate the popup.
    var max = numMatches.value;
    for (let i = 0; i < max; i++) {
      var clippingURI = srchResults[i];
      var name = gClippingsSvc.getName(clippingURI);
      var text = gClippingsSvc.getText(clippingURI);
      
      // Truncate name and text
      var originalLen = name.length;
      name = name.substr(0, 48);
      name += (originalLen > name.length ? " ..." : "");

      var listitem = document.createElement("richlistitem");
      listitem.setAttribute("orient", "vertical");
      listitem.setAttribute("value", clippingURI);

      var nameElt = document.createElement("label");
      var textElt = document.createElement("label");
      nameElt.setAttribute("class", "clipping-name");
      nameElt.setAttribute("value", name);
      textElt.setAttribute("class", "clipping-text");
      textElt.setAttribute("value", text);

      listitem.appendChild(nameElt);
      listitem.appendChild(textElt);
      srchResultsListbox.appendChild(listitem);
    }

    srchResultsPopup.openPopup($("clipping-search"), "after_start", 0, 0, false, false);
  }
}


function handleSearchKeys(aEvent, aSearchText)
{
  if (aEvent.key == "ArrowDown" || aEvent.key == "Down") {
    // Just beep at the user if there's no search results to display.
    if (aSearchText == "") {
      aeUtils.beep();
      return;
    }

    var numMatches = {};
    var srchResults = gClippingsSvc.findByName(aSearchText, false, false, numMatches);

    if (numMatches.value == 0) {
      aeUtils.beep();
      return;
    }
    
    $("search-results-listbox").focus();
    $("search-results-listbox").selectedIndex = 0;
  }
  else if (aEvent.key == "F3") {   // DOESN'T WORK!
    gDlgArgs.switchModes = true;
    gDlgArgs.action = gDlgArgs.ACTION_SHORTCUT_KEY;
  }
}


function selectClipping()
{
  var clippingURI = $("search-results-listbox").value;

  gDlgArgs.clippingURI = clippingURI;
  gDlgArgs.userCancel = false;

  window.close();
}


function selectClippingByKeyboard(aEvent)
{
  if (aEvent.key == "Enter") {
    aeUtils.log("Search clipping (keyboard selection)");
    selectClipping();
  }
}


function selectClippingByMouse(aEvent)
{
  if (aEvent.target.nodeName == "richlistitem") {
    aeUtils.log("Search clipping (mouse selection)");
    selectClipping();
  }
}


function cancel()
{
  gDlgArgs.userCancel = true;
  return true;
}
