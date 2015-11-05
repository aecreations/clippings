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
 * Portions created by the Initial Developer are Copyright (C) 2015
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://clippings/modules/aeUtils.js");


var gDlgArgs = window.arguments[0];
var gStrBundle;


function $(aID)
{
  return document.getElementById(aID);
}


function init()
{
  gStrBundle = $("ae-clippings-strings");

  var placeholderDeck = $("placeholder-deck");
  placeholderDeck.selectedIndex = gDlgArgs.placeholderType;

  var labelKey = "placeholderName";

  switch (gDlgArgs.placeholderType) {
  case gDlgArgs.AUTO_INCREMENT:
    labelKey += "AutoIncr";
    break;

  case gDlgArgs.CUSTOM:
  default:
    labelKey += "Custom";
    break;
  }

  $("placeholder-name-label").value = gStrBundle.getString(labelKey);
}


function validatePlaceholderName(aName)
{
  if (aName.match(/[^a-zA-Z0-9_\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]/)) {
    return false;
  }
  return true;
}


function accept()
{
  var placeholderNameElt = $("placeholder-name");
  var placeholderName = placeholderNameElt.value;

  if (! placeholderName) {
    aeUtils.beep();
    placeholderNameElt.focus();
    return false;
  }

  if (! validatePlaceholderName(placeholderName)) {
    aeUtils.alertEx(gStrBundle.getString("appName"), gStrBundle.getString("illegalPlaceholderName"));
    placeholderNameElt.focus();
    placeholderNameElt.select();
    return false;
  }

  var placeholderValue = $("placeholder-default-value").value

    var placeholderDeck = $("placeholder-deck");
 
  if (placeholderDeck.selectedIndex == gDlgArgs.CUSTOM) {
    var placeholder = "$[" + placeholderName;

    if (placeholderValue) {
      placeholder = placeholder + "{" + placeholderValue + "}]";
    }
    else {
      placeholder = placeholder + "]";
    }
    gDlgArgs.placeholder = placeholder;
  }
  else if (placeholderDeck.selectedIndex == gDlgArgs.AUTO_INCREMENT) {
    gDlgArgs.placeholder = "#[" + placeholderName + "]";
  }

  gDlgArgs.userCancel = false;
  return true;
}


function cancel()
{
  gDlgArgs.userCancel = true;
  return true;
}
