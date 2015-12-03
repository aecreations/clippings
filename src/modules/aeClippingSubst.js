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
 * Portions created by the Initial Developer are Copyright (C) 2007-2015
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");


const EXPORTED_SYMBOLS = ["aeClippingSubst"];

const Cc = Components.classes;
const Ci = Components.interfaces;



/*
 * Module aeClippingSubst
 * Performs substitution of variables embedded inside a clipping with either
 * predefined values or user-input text.
 */
var aeClippingSubst = {
  _strBundle: null,
  _userAgentStr: null,
  _autoIncrementVars: {}
};


aeClippingSubst.init = function (aStringBundle, aUserAgentStr)
{
  this._strBundle = aStringBundle;
  this._userAgentStr = aUserAgentStr;
};


/*
 * Factory method
 * Returns an object that holds various properties of a clipping to be passed
 * as an argument to aeClippingSubst.processClippingText()
 */
aeClippingSubst.getClippingInfo = function (aURI, aName, aText, aParentFolderName)
{
  var rv = {
    uri  : aURI,
    name : aName,
    text : aText,
    parentFolderName: aParentFolderName
  };

  return rv;
};


aeClippingSubst.processClippingText = function (aClippingInfo, aWnd)
{
  if ((/^\[NOSUBST\]/.test(aClippingInfo.name))) {
    return aClippingInfo.text;
  }

  var rv = "";
  var strBundle = this._strBundle;
  var userAgentStr = this._userAgentStr;

  // Remember the value of the same placeholder that was filled in previously
  var knownTags = {};
  let that = aeClippingSubst;
  let tabModalPrompt = aeUtils.getPref("clippings.tab_modal_placeholder_prompt", true);

  // For use if tab-modal prompts are enabled.  The normal placeholder dialog
  // will always be used if the placeholder has selectable values.
  let prmptSvc = Cc["@mozilla.org/prompter;1"].getService(Ci.nsIPromptFactory).getPrompt(aWnd, Ci.nsIPrompt);

  var fnReplace = function (aMatch, aP1, aP2, aOffset, aString) {
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
        defaultVal = aeUtils.getHostAppName();
        break;

      case "_UA_":
        defaultVal = userAgentStr;
        break;
        
      default:
        break;
      }
    }

    var rv = "";
    
    if (tabModalPrompt && aeUtils.getHostAppID() == aeConstants.HOSTAPP_FX_GUID
        && !hasMultipleVals) {
      that._initTabModalPromptDlg(prmptSvc);
      let prmptText = that._strBundle.getFormattedString("substPromptText", [varName]);
      let input = { value: defaultVal };
      let returnedOK = prmptSvc.prompt(that._strBundle.getString("substPromptTitle"), prmptText, input, null, {});

      let userInput = input.value;
      if (!returnedOK || userInput == "") { 
        return "";
      }
      knownTags[varName] = userInput;
      rv = userInput;
    }
    else {
      var dlgArgs = {
        varName:       varName,
        userInput:     "",
        defaultValue:  defaultVal,
        autoIncrementMode: false,
        selectMode:    hasMultipleVals,
        userCancel:    null
      };
      dlgArgs.wrappedJSObject = dlgArgs;

      that._openDialog(aWnd, "chrome://clippings/content/placeholderPrompt.xul", "ae_placeholder_prmpt", "modal,centerscreen", dlgArgs);
      if (dlgArgs.userCancel || dlgArgs.userInput == "") {
        return "";
      }

      knownTags[varName] = dlgArgs.userInput;
      rv = dlgArgs.userInput;
    }

    return rv;
  };

  var fnAutoIncrement = function (aMatch, aP1) {
    let varName = aP1;

    if (varName in that._autoIncrementVars) {
      return ++that._autoIncrementVars[varName];
    }

    var defaultValue = 0;
    var rv = "";
    
    if (tabModalPrompt && aeUtils.getHostAppID() == aeConstants.HOSTAPP_FX_GUID) {
      that._initTabModalPromptDlg(prmptSvc);
      let prmptText = that._strBundle.getFormattedString("autoIncrPromptText", [varName]);
      let input = {};
      let userInput = "";

      do {
        input.value = defaultValue;
        var returnedOK = prmptSvc.prompt(that._strBundle.getString("substPromptTitle"), prmptText, input, null, {});
        userInput = input.value;
        if (!returnedOK || userInput == "") {
          return "";
        }
      } while (isNaN(userInput));

      that._autoIncrementVars[varName] = userInput;
      rv = userInput;
    }
    else {
      var dlgArgs = {
        varName:       varName,
        userInput:     "",
        defaultValue:  defaultValue,
        autoIncrementMode: true,
        selectMode:    false,
        userCancel:    null
      };
      dlgArgs.wrappedJSObject = dlgArgs;

      do {
        that._openDialog(aWnd, "chrome://clippings/content/placeholderPrompt.xul", "ae_placeholder_prmpt", "modal,centerscreen", dlgArgs);
        if (dlgArgs.userCancel || dlgArgs.userInput == "") {
          return "";
        }
      } while (isNaN(dlgArgs.userInput));

      that._autoIncrementVars[varName] = dlgArgs.userInput;
      rv = dlgArgs.userInput;
    }

    return rv;
  };

  let date = new Date();

  rv = aClippingInfo.text.replace(/\$\[DATE\]/gm, date.toLocaleDateString());
  rv = rv.replace(/\$\[TIME\]/gm, date.toLocaleTimeString());
  rv = rv.replace(/\$\[NAME\]/gm, aClippingInfo.name);
  rv = rv.replace(/\$\[_RDF_CLIPPING_URI\]/gm, aClippingInfo.uri);
  rv = rv.replace(/\$\[FOLDER\]/gm, aClippingInfo.parentFolderName);
  rv = rv.replace(/\$\[HOSTAPP\]/gm, aeUtils.getHostAppName() + " " + aeUtils.getHostAppVersion());
  rv = rv.replace(/\$\[UA\]/gm, userAgentStr);

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


aeClippingSubst._initTabModalPromptDlg = function (aPromptService)
{
  let pptyBag = aPromptService.QueryInterface(Components.interfaces.nsIWritablePropertyBag2);
  pptyBag.setPropertyAsBool("allowTabModal", true);
};


aeClippingSubst._openDialog = function (aParentWnd, aDialogURL, aName, aFeatures, aParams)
{
  if (aeUtils.getOS() == "Darwin") {
    var dlgFeatures = aFeatures + ",dialog=yes,resizable=no";
    var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
    ww.openWindow(null, aDialogURL, aName, dlgFeatures, aParams);
  }
  else {
    aParentWnd.openDialog(aDialogURL, aName, aFeatures, aParams);
  }
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
