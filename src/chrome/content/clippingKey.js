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

Components.utils.import("resource://clippings/modules/aeUtils.js");

const Cc = Components.classes;
const Ci = Components.interfaces;

var gDlgArgs;
var gClippingsSvc;


function initWnd()
{
  gDlgArgs = window.arguments[0];

  try {
    gClippingsSvc = Cc["clippings@mozdev.org/clippings;1"].getService(Ci.aeIClippingsService);
  }
  catch (e) {
    alert(e);
  }
}


function processKeyPress(aEvent)
{
  if (aEvent.key == "F1") {
    gDlgArgs.action = gDlgArgs.SHORTCUT_KEY_HELP;
    gDlgArgs.switchModes = true;
 }
  else if (aEvent.key == "Tab") {
    gDlgArgs.action = gDlgArgs.ACTION_SEARCH_CLIPPING;
    gDlgArgs.switchModes = true;
  }
  else if (aEvent.key == "Escape" || aEvent.key == "Esc") {
    gDlgArgs.switchModes = false;
    gDlgArgs.userCancel = true;
  }
  else {
    var key = aEvent.key.toUpperCase();

    aeUtils.log("Clippings: Key code: " + key);

    var keyDict = gClippingsSvc.getShortcutKeyDict();
    var keys;
    var keyCount = {};
    keys = keyDict.getKeys(keyCount);

    if (! keyDict.hasKey(key)) {
      aeUtils.beep();
      gDlgArgs.userCancel = true;
      window.close();
      return;
    }

    try {
      var valueStr = keyDict.getValue(key);
    }
    catch (e) {}
    
    valueStr = valueStr.QueryInterface(Components.interfaces.nsISupportsString);
    gDlgArgs.clippingURI = valueStr.data;
    gDlgArgs.switchModes = false;
    gDlgArgs.userCancel = false;
  }

  window.close();
}


function unload() {

}
