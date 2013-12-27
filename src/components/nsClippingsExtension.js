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
 * Portions created by the Initial Developer are Copyright (C) 2007-2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

// Supported in Firefox 3 and higher, and Thunderbird 3 and higher
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


function nsClippingsExtension() {}

nsClippingsExtension.prototype = {
  _ID: "{91aa5abe-9de4-4347-b7b5-322c38dd9271}",

  get id()         { return this._ID; },
  get installDir() { return __LOCATION__.parent.parent; },

  // Component registration
  classDescription: "Clippings Extension API",
  classID:          Components.ID("{f74c71c7-7da2-4029-9786-1fa1dd99f842}"),
  contractID:       "clippings@mozdev.org/clippings-extension;1",
  QueryInterface:   XPCOMUtils.generateQI([Components.interfaces.nsIClippingsExtension])
};



//
// Component registration
//

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6/Thunderbird 3.1).
*/
if (XPCOMUtils.generateNSGetFactory) {
  const NSGetFactory = XPCOMUtils.generateNSGetFactory([nsClippingsExtension]);
}
else {
  const NSGetModule = XPCOMUtils.generateNSGetModule([nsClippingsExtension]);
}

