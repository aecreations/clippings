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
 * Portions created by the Initial Developer are Copyright (C) 2016
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

const EXPORTED_SYMBOLS = ["aeClippingsService"];


Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://clippings/modules/aeUtils.js");
Components.utils.import("resource://clippings/modules/aeConstants.js");

const DEBUG = false;

const Cc = Components.classes;
const Ci = Components.interfaces;


let _clippingsSvc = null;


let aeClippingsService = {
  getService: function ()
  {
    if (! _clippingsSvc) {
      _clippingsSvc = new aeClippingsService();
    }
    return _clippingsSvc;
  }
};


function aeClippingsService()
{

}


aeClippingsService.prototype = {

};



//
// Private helper functions
//

function _log(aMessage)
{
  if (DEBUG) {
    var consoleSvc = Services.prefs.console;
    consoleSvc.logStringMessage("aeClippingsService.js:" + aMessage);
  }
}
