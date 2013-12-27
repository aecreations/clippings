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
 * Portions created by the Initial Developer are Copyright (C) 2005-2013
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");


const Cc = Components.classes;
const Ci = Components.interfaces;

var gStrBundle;
var gIsDlgInitialized;


function $(aID) 
{
  return document.getElementById(aID);
}


function initDlg()
{
  // Initialization of the entire pref dialog. Initialization of the individual
  // pref panes should go into their respective event handlers for the
  // `onpaneload' event.
  // NOTE: The pref dialog's `onload' event is called *after* the `onpaneload'
  // events in each pref pane!
  if (! gIsDlgInitialized) {
    gStrBundle = $("ae-clippings-strings");

    var titleKey;
    if (aeUtils.getOS() == "WINNT") {
      titleKey = "clippingsOptions";
    }
    else {
      titleKey = "clippingsPreferences";
    }
    $("ae-clippings-preferences").setAttribute("title", gStrBundle.getString(titleKey));

    gIsDlgInitialized = true;
  }
}


function applyPrefChanges()
{
  // Function applyDataSourcePrefChanges() is only defined when the Data Source
  // pane was loaded.
  if (typeof(applyDataSourcePrefChanges) == "function") {
    applyDataSourcePrefChanges();
  }
}


function unloadDlg()
{
  var instantApplyPrefs = $("ae-clippings-preferences").instantApply;

  if (instantApplyPrefs) {
    applyPrefChanges();
  }
}
