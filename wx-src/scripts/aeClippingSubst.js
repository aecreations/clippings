/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/*
 * Module aeClippingSubst
 * Performs substitution of variables embedded inside a clipping with either
 * predefined values or user-input text.
 */
let aeClippingSubst = {
  // Match placeholder names containing alphanumeric char's, underscores, and
  // the following Unicode blocks: Latin-1 Supplement, Latin Extended-A, Latin
  // Extended-B, Cyrillic, Hebrew.
  // For normal placeholders, allow {|} chars for optional default values, and
  // within the { and }, allow the same characters as placeholder names, but
  // including the space, hyphen, period, parentheses, common currency symbols,
  // and the following special characters: ?_/!@#%&;,:'"
  // Optional default values also supports all Unicode characters.
  REGEXP_CUSTOM_PLACEHOLDER: /\$\[([\w\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]+)(\{([\w \-\.\?_\/\(\)!@#%&;:,'"$£¥€*¡¢\u{0080}-\u{10FFFF}\|])+\})?\]/gmu,

  REGEXP_AUTO_INCR_PLACEHOLDER: /\#\[([a-zA-Z0-9_\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]+)\]/gm,
  
  _userAgentStr: null,
  _hostAppName: null,
  _autoIncrementVars: {},
  _autoIncrementStartVal: 0
};


aeClippingSubst.init = function (aUserAgentStr, aAutoIncrementStartVal)
{
  this._userAgentStr = aUserAgentStr;
  this._autoIncrementStartVal = aAutoIncrementStartVal;

  if (! ("browser" in window)) {
    this._hostAppName = "Google Chrome";
  }
  else {
    let getBrowserInfo = browser.runtime.getBrowserInfo();
    getBrowserInfo.then(aBrwsInfo => {
      this._hostAppName = `${aBrwsInfo.name} ${aBrwsInfo.version}`;
    });
  }

  // Initialize locale used for formatting dates.
  moment.locale(browser.i18n.getUILanguage());
};


aeClippingSubst.setAutoIncrementStartValue = function (aValue)
{
  this._autoIncrementStartVal = aValue;
};


aeClippingSubst.hasNoSubstFlag = function (aClippingName) {
  return (/^\[NOSUBST\]/.test(aClippingName));
};


aeClippingSubst.getCustomPlaceholders = function (aClippingText)
{
  let rv = [];
  let plchldrs = [];

  let re = this.REGEXP_CUSTOM_PLACEHOLDER;

  let result;
  
  while ((result = re.exec(aClippingText)) != null) {
    plchldrs.push(result[1]);
  }

  rv = plchldrs;
  return rv;
};


aeClippingSubst.getCustomPlaceholderDefaultVals = function (aClippingText, aClippingInfo)
{
  let rv = {};
  let re = this.REGEXP_CUSTOM_PLACEHOLDER;

  let result;
  
  while ((result = re.exec(aClippingText)) != null) {
    let plchldrName = result[1];
    
    if (result[2]) {
      let defVal = result[2];
      let defaultVal = defVal.substring(defVal.indexOf("{") + 1, defVal.indexOf("}"));
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

      rv[plchldrName] = defaultVal;
    }
  }
  
  return rv;
};


aeClippingSubst.getAutoIncrPlaceholders = function (aClippingText)
{
  let rv = [];
  let re = this.REGEXP_AUTO_INCR_PLACEHOLDER;

  let result;

  while ((result = re.exec(aClippingText)) != null) {
    rv.push(result[1]);
  }

  return rv;
};


aeClippingSubst.processStdPlaceholders = async function (aClippingInfo)
{
  // Formatted date/time placeholders using formats from Moment library.
  const RE_DATE = /\$\[DATE\(([AaDdHhKkMmosYLlTZ ,.:\-\/]+)\)\]/;
  const RE_TIME = /\$\[TIME\(([AaHhKkmsLTZ .:]+)\)\]/;

  // Name of clipping can be alphanumeric char's, underscores, and
  // the following Unicode blocks: Latin-1 Supplement, Latin Extended-A, Latin
  // Extended-B, Cyrillic, Hebrew, as well as the space, hyphen, period,
  // parentheses, common currency symbols, all Unicode characters, and the
  // following special characters: ?_/!@#%&;,:'"
  const RE_CLIPPING = /\$\[CLIPPING\((([\w\d\s\.\-_!@#%&;:,'"$£¥€*¡¢\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF\u0080-\u10FFFF])+)\)\]/;
  
  let rv = "";
  let processedTxt = "";  // Contains expanded clipping in clipping placeholders.
  let clipInClipMatches = [];
  let clipInClipRe = new RegExp(RE_CLIPPING, "g");
  clipInClipMatches = [...aClippingInfo.text.matchAll(clipInClipRe)];

  if (clipInClipMatches.length > 0) {
    let startIdx = 0;
    for (let i = 0; i < clipInClipMatches.length; i++) {
      let match = clipInClipMatches[i];
      let preTxt = match.input.substring(startIdx, match.index);
      let clippings = await aeClippings.getClippingsByName(match[1]);
      let clippingTxt = "";
      if (clippings.length > 0) {
        clippingTxt = clippings[0].content;
      }
      else {
        // If clipping doesn't exist, then placeholder should be inserted as is
        clippingTxt = match[0];
      }
      
      processedTxt += preTxt + clippingTxt;
      startIdx = match.index + match[0].length;
    }

    // Get the rest of the clipping.
    processedTxt += aClippingInfo.text.substring(startIdx);
  }
  else {
    processedTxt = aClippingInfo.text;
  }

  let date = new Date();
  rv = processedTxt.replace(/\$\[DATE\]/gm, date.toLocaleDateString());
  rv = rv.replace(/\$\[TIME\]/gm, date.toLocaleTimeString());
  rv = rv.replace(/\$\[NAME\]/gm, aClippingInfo.name);
  rv = rv.replace(/\$\[FOLDER\]/gm, aClippingInfo.parentFolderName);
  rv = rv.replace(/\$\[HOSTAPP\]/gm, this._hostAppName);
  rv = rv.replace(/\$\[UA\]/gm, this._userAgentStr);

  let hasFmtDateTime = false;
  hasFmtDateTime = (RE_DATE.exec(processedTxt) != null || RE_TIME.exec(processedTxt) != null);

  if (hasFmtDateTime) {
    let dtPlaceholders = [];
    let dtReplaced = [];
    let plchldrType = [];

    let fmtDateRe = new RegExp(RE_DATE, "g");
    let fmtDateResult;
    while ((fmtDateResult = fmtDateRe.exec(rv)) != null) {
      dtPlaceholders.push(fmtDateResult[1]);
      plchldrType.push("D");
    }

    let fmtTimeRe = new RegExp(RE_TIME, "g");
    let fmtTimeResult;
    while ((fmtTimeResult = fmtTimeRe.exec(rv)) != null) {
      dtPlaceholders.push(fmtTimeResult[1]);
      plchldrType.push("T");
    }

    this._processDateTimePlaceholders(dtPlaceholders, dtReplaced);

    for (let i = 0; i < dtPlaceholders.length; i++) {
      let suffix = "";
      if (plchldrType[i] == "D") {
	suffix = "$[DATE(";
      }
      else if (plchldrType[i] == "T"){
	suffix = "$[TIME(";
      }
      let dtPlchldr = suffix + dtPlaceholders[i] + ")]";
      rv = rv.replace(dtPlchldr, dtReplaced[i]);
    }
  }

  return rv;
};


aeClippingSubst._processDateTimePlaceholders = function (aPlaceholders, aReplaced)
{
  for (let fmt of aPlaceholders) {
    let dtValue = moment().format(fmt);
    aReplaced.push(dtValue);
  }
};


aeClippingSubst.processAutoIncrPlaceholders = async function (aClippingText)
{
  let rv = "";
  this._autoIncrementVars = await aePrefs.getPref("_autoIncrPlchldrVals");
  
  let fnAutoIncrement = (aMatch, aP1) => {
    let varName = aP1;

    if (varName in this._autoIncrementVars) {
      return ++this._autoIncrementVars[varName];
    }

    let rv = "";
    
    this._autoIncrementVars[varName] = this._autoIncrementStartVal;
    rv = this._autoIncrementVars[varName];
    
    return rv;
  }

  rv = aClippingText.replace(this.REGEXP_AUTO_INCR_PLACEHOLDER, fnAutoIncrement);

  return rv;
};


aeClippingSubst.saveAutoIncrementVars = async function ()
{
  await aePrefs.setPrefs({_autoIncrPlchldrVals: this._autoIncrementVars});
};


aeClippingSubst.resetAutoIncrementVar = async function (aVarName)
{
  this._autoIncrementVars = await aePrefs.getPref("_autoIncrPlchldrVals");
  delete this._autoIncrementVars[aVarName];
  await aePrefs.setPrefs({_autoIncrPlchldrVals: this._autoIncrementVars});
};
