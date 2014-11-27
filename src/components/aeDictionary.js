/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Mozilla XPCOM Dictionary.
 *
 * The Initial Developer of the Original Code is
 * Digital Creations 2, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Martijn Pieters <mj@digicool.com> (original author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 *  aeDictionary XPCOM component
 *  Version: $Revision: 1.3 $
 *
 *  $Id: aeDictionary.js,v 1.3 2012/11/02 05:27:23 ateng Exp $
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


/*
 * Constants
 */
const DICTIONARY_CONTRACTID = 'clippings@mozdev.org/dictionary;1';
const DICTIONARY_CID = Components.ID('{1dd0cb45-aea3-4a52-8b29-01429a542863}');
const DICTIONARY_IID = Components.interfaces.aeIDictionary;

/*
 * Class definitions
 */

/* The aeDictionary class constructor. */
function aeDictionary() {
    this.hash = {};
}

/* the aeDictionary class def */
aeDictionary.prototype= {
    hasKey: function(key) { return this.hash.hasOwnProperty(key) },

    getKeys: function(count) {
        var asKeys = new Array();
        for (var sKey in this.hash) asKeys.push(sKey);
        count.value = asKeys.length;
        return asKeys;
    },

    getValue: function(key) { 
        if (!this.hasKey(key))
            throw Components.Exception("Key doesn't exist");
        return this.hash[key]; 
    },

    setValue: function(key, value) { this.hash[key] = value; },
    
    deleteValue: function(key) {
        if (!this.hasKey(key))
            throw Components.Exception("Key doesn't exist");
        var oOld = this.getValue(key);
        delete this.hash[key];
        return oOld;
    },

    clear: function() { this.hash = {}; },

    // Component registration
    classDescription: "Dictionary data structure class",
    classID:          DICTIONARY_CID,
    contractID:       DICTIONARY_CONTRACTID,
    QueryInterface:   XPCOMUtils.generateQI([DICTIONARY_IID])
};


const NSGetFactory = XPCOMUtils.generateNSGetFactory([aeDictionary]);


