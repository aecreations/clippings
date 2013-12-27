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
 * Portions created by the Initial Developer are Copyright (C) 2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

const EXPORTED_SYMBOLS = ["aeGetMozApplicationObj"];

const Cc = Components.classes;
const Ci = Components.interfaces;


/**
 * Returns a FUEL (Firefox) or STEEL (Thunderbird) API object.
 * This function is necessary because the Application object doesn't exist in
 * the scope of a JS module.
 */
function aeGetMozApplicationObj()
{
  var rv;
  if ("@mozilla.org/fuel/application;1" in Cc) {
    rv = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
  }
  else if ("@mozilla.org/steel/application;1" in Cc) {
    rv = Components.classes["@mozilla.org/steel/application;1"].getService(Ci.steelIApplication); 
  }

  return rv;
}
