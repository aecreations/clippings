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


var gDlgArgs, gStrBundle;

    
//
// DOM utility function
//

function $(aID) {
  return document.getElementById(aID);
}



function initDlg()
{
  gDlgArgs = window.arguments[0].wrappedJSObject;
  gStrBundle = $("ae-clippings-strings");
  var promptText = $("prompt-text");
  var promptDeck = $("prompt-deck");
  var strKey;

  if (gDlgArgs.autoIncrementMode) {
    strKey = "autoIncrPromptText";
    promptDeck.selectedIndex = 0;
    $("placeholder-value").value = gDlgArgs.defaultValue;
  }
  else if (gDlgArgs.selectMode) {
    strKey = "selectPromptText";
    promptDeck.selectedIndex = 1;

    var menupopup = $("select-placeholder-value-menu").firstChild;
    var selectableValues = gDlgArgs.defaultValue.split("|");

    for (let value of selectableValues) {
      var menuitem = document.createElement("menuitem");
      menuitem.setAttribute("label", value);
      menuitem.setAttribute("value", value);
      menupopup.appendChild(menuitem);
    }
  }
  else {
    strKey = "substPromptText";
    promptDeck.selectedIndex = 0;
    $("placeholder-value").value = gDlgArgs.defaultValue;
  }
  promptText.value = gStrBundle.getFormattedString(strKey, [gDlgArgs.varName]);
}


function accept()
{
  if (gDlgArgs.selectMode) {
    let selectedItem = $("select-placeholder-value-menu").selectedItem;
    if (! selectedItem) {
      aeUtils.beep();
      return false;
    }
    gDlgArgs.userInput = selectedItem.value;
  }
  else {
    gDlgArgs.userInput = $("placeholder-value").value;
  }

  return true;
}


function cancel() 
{
  gDlgArgs.userCancel = true;
  return true;
}
