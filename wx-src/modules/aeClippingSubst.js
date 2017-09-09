/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 2007-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Module aeClippingSubst
 * Performs substitution of variables embedded inside a clipping with either
 * predefined values or user-input text.
 */
let aeClippingSubst = {
  _userAgentStr: null,
  _hostAppName: null,
  _autoIncrementVars: {}
};


aeClippingSubst.init = function (aUserAgentStr, aHostAppName)
{
  this._userAgentStr = aUserAgentStr;

  if (! ("browser" in window)) {
    this._hostAppName = "Google Chrome";
  }
  else {
    let getBrowserInfo = browser.runtime.getBrowserInfo();
    getBrowserInfo.then(aBrwsInfo => {
      this._hostAppName = `${aBrwsInfo.name} ${aBrwsInfo.version}`;
    });
  }
};


aeClippingSubst.processClippingText = function (aClippingInfo)
{
  if ((/^\[NOSUBST\]/.test(aClippingInfo.name))) {
    return aClippingInfo.text;
  }

  var rv = "";

  // Remember the value of the same placeholder that was filled in previously
  var knownTags = {};
  
  var fnReplace = (aMatch, aP1, aP2, aOffset, aString) => {
    let varName = aP1;

    if (varName in knownTags) {
      return knownTags[varName];
    }

    let hasDefaultVal = false;
    let hasMultipleVals = false;

    if (aP2) {
      hasDefaultVal = true;

      if (aP2.indexOf("|") != -1) {
        hasMultipleVals = true;
      }
    }

    // Pre-populate input with default value, if any.
    let defaultVal = "";
    if (hasDefaultVal) {
	defaultVal = aP2.substring(aP2.indexOf("{") + 1, aP2.indexOf("}"));

      let date = new Date();

      switch (defaultVal) {
      case "_DATE_":
        defaultVal = date.toLocaleDateString();
        break;

      case "_TIME_":
        defaultVal = date.toLocaleTimeString();
        break;

      case "_NAME_":
        defaultVal = aClippingInfo.name;
        break;

      case "_FOLDER_":
        defaultVal = aClippingInfo.parentFolderName;
        break;

      case "_HOSTAPP_":
        defaultVal = this._hostAppName;
        break;
        
      case "_UA_":
        defaultVal = this._userAgentStr;
        break;
        
      default:
        break;
      }
    }

    var rv = "";

    // TO DO: Prompt for replacement text
    rv = "$[" + varName + "]";
    
    return rv;
  };

  var fnAutoIncrement = (aMatch, aP1) => {
    let varName = aP1;

    if (varName in this._autoIncrementVars) {
      return ++this._autoIncrementVars[varName];
    }

    var defaultValue = 0;
    var rv = "";
    
    // TO DO: Prompt for initial numeric value
    this._autoIncrementVars[varName] = defaultValue;

    rv = this._autoIncrementVars[varName];
    
    return rv;
  };

  let date = new Date();

  rv = aClippingInfo.text.replace(/\$\[DATE\]/gm, date.toLocaleDateString());
  rv = rv.replace(/\$\[TIME\]/gm, date.toLocaleTimeString());
  rv = rv.replace(/\$\[NAME\]/gm, aClippingInfo.name);
  rv = rv.replace(/\$\[FOLDER\]/gm, aClippingInfo.parentFolderName);
  rv = rv.replace(/\$\[HOSTAPP\]/gm, this._hostAppName);
  rv = rv.replace(/\$\[UA\]/gm, this._userAgentStr);

  // Match placeholder names containing alphanumeric char's, underscores, and
  // the following Unicode blocks: Latin-1 Supplement, Latin Extended-A, Latin
  // Extended-B, Cyrillic, Hebrew.
  // For normal placeholders, allow {|} chars for optional default values, and
  // within the { and }, allow the same characters as placeholder names, but
  // including the space, hyphen and period.
  rv = rv.replace(/\$\[([\w\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]+)(\{([\w \-\.\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF\|])+\})?\]/gm, fnReplace);
  rv = rv.replace(/\#\[([a-zA-Z0-9_\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]+)\]/gm, fnAutoIncrement);

  return rv;
};


aeClippingSubst.getAutoIncrementVarNames = function ()
{
  var rv = [];
  for (var name in this._autoIncrementVars) {
    rv.push(name);
  }
  return rv;
};


aeClippingSubst.resetAutoIncrementVar = function (aVarName)
{
  delete this._autoIncrementVars[aVarName];
};
