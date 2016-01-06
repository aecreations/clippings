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

Components.utils.import("resource://gre/modules/Services.jsm");


const EXPORTED_SYMBOLS = ["aeUtils"];

// Debugging flags - set to false to suppress extraneous JS console messages
// and diagnostic audio beeps.
const DEBUG = true;
const NOISY_DEBUG = false;

// Host app GUIDs
const HOSTAPP_FX_GUID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
const HOSTAPP_TB_GUID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";

const WNDTYPE_FX_BROWSER    = "navigator:browser";
const WNDTYPE_TB_MSGCOMPOSE = "msgcompose";

const PREFNAME_PREFIX = "extensions.aecreations.";

const Cc = Components.classes;
const Ci = Components.interfaces;


var aeUtils = {
  // TO DO: Consider moving this to aeConstants module.  Note that the
  // PE shell script will need to be modified to read the JS module file.
  // Set this constant to true if building this extension for Portable Firefox
  // or Portable Thunderbird
  PORTABLE_APP_BUILD: false
};


aeUtils.alertEx = function (aTitle, aMessage)
{
  var prmpt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
  prmpt.alert(null, aTitle, aMessage);
};


aeUtils.confirmEx = function (aTitle, aMessage)
{
  var rv;
  var prmpt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
  rv = prmpt.confirm(null, aTitle, aMessage);
  return rv;
};


aeUtils.confirmYesNo = function (aTitle, aMessage, aIsDefaultButtonNo)
{
  var rv;
  var prmpt = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
  var btnFlags = prmpt.STD_YES_NO_BUTTONS;
  btnFlags += (aIsDefaultButtonNo ? prmpt.BUTTON_POS_1_DEFAULT : prmpt.BUTTON_POS_0_DEFAULT);

  // Return values of nsIPromptService.confirmEx(): 0 = Yes; 1 = No
  var btnIdx = prmpt.confirmEx(null, aTitle, aMessage, btnFlags, "", "", "", "", {});

  // Invert the return value (which is the index of the pressed button) so that
  // the return value of this method is like aeUtils.confirmEx()
  rv = Math.abs(btnIdx - 1);

  return rv;
};


aeUtils.getTextFromClipboard = function () 
{
  var rv;
  var clipbd = Components.classes["@mozilla.org/widget/clipboard;1"].createInstance(Components.interfaces.nsIClipboard);
  var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
  trans.addDataFlavor("text/unicode");
  clipbd.getData(trans, clipbd.kGlobalClipboard);

  var str = {};
  var strLen = {};
  try {
    trans.getTransferData("text/unicode", str, strLen);
  } 
  catch (e) {
    // Failed because there's nothing on the clipboard or the clipboard
    // contents isn't textual data
    return rv;
  }

  if (str) {
    str = str.value.QueryInterface(Components.interfaces.nsISupportsString);
  }
  if (str) {
    rv = str.data.substring(0, strLen.value / 2);
  }

  return rv;
};


aeUtils.copyTextToClipboard = function (aText) 
{
  var clipbd = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
  clipbd.copyString(aText);
};


aeUtils.getDataSourcePathURL = function ()
{
  var rv;
  var dataSrcPath = this.getPref("clippings.datasource.location", "");

  if (dataSrcPath) {
    try {
      var dataSrcURL = this.getURLFromFilePath(dataSrcPath);
    }
    catch (e) {
      this.log(e);
      return rv;
    }
    rv = dataSrcURL;
  }
  else {
    // Fallback on host app profile folder.
    var profileDir = this.getUserProfileDir();
    let fph = Components.classes["@mozilla.org/network/protocol;1?name=file"]
                        .createInstance(Components.interfaces
  	  	   	  	                  .nsIFileProtocolHandler);
    rv = fph.getURLSpecFromFile(profileDir);
  }

  return rv;
};


// Given a native file path, e.g. C:\path\to\file, return its corresponding
// "file://" URL
aeUtils.getURLFromFilePath = function (aPath)
{
  var file = Components.classes["@mozilla.org/file/local;1"]
                       .createInstance(Components.interfaces.nsIFile);
  var rv;

  try {
    file.initWithPath(aPath);
  }
  catch (e) {
    this.log("aeUtils.getURLFromFilePath: Error initializing nsIFile instance with path '" + aPath + "': " + e);
    return rv;
  }

  var fph = Components.classes["@mozilla.org/network/protocol;1?name=file"]
                      .createInstance(Components.interfaces
                                                .nsIFileProtocolHandler);
  rv = fph.getURLSpecFromFile(file);

  return rv;
};


// Given a "file://" URL, e.g. file://C|/path/to/file, return its corresponding
// native file path
aeUtils.getFilePathFromURL = function (aFileURL)
{
  var io = Components.classes["@mozilla.org/network/io-service;1"]
                     .getService(Components.interfaces.nsIIOService);
  var fh = io.getProtocolHandler("file")
             .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
  var file = fh.getFileFromURLSpec(aFileURL);
  var rv = file.path;

  return rv;
};


// Throws an exception if profile directory retrieval failed.
aeUtils.getUserProfileDir = function ()
{
  var dirProp = Components.classes["@mozilla.org/file/directory_service;1"]
                          .getService(Components.interfaces.nsIProperties);
  var profileDir = dirProp.get("ProfD", Components.interfaces.nsIFile);
  if (! profileDir) {
    throw "Failed to retrieve current profile directory";
  }

  return profileDir;
};


// Throws an exception if user home directory retrieval failed.
aeUtils.getHomeDir = function ()
{
  var dirProp = Components.classes["@mozilla.org/file/directory_service;1"]
                          .getService(Components.interfaces.nsIProperties);
  var homeDir = dirProp.get("Home", Components.interfaces.nsIFile);
  if (! homeDir) {
    throw "Failed to retrieve user's home directory";
  }

  return homeDir;
};


aeUtils.getHostAppID = function ()
{
  var xulAppInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);

  return xulAppInfo.ID;
};


aeUtils.getHostAppName = function ()
{
  var xulAppInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);

  return xulAppInfo.name;
};


aeUtils.getHostAppVersion = function ()
{
  var xulAppInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);

  return xulAppInfo.version;
};


aeUtils.getOS = function ()
{
  var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);

  return xulRuntime.OS;
};


aeUtils.getRecentHostAppWindow = function ()
{
  var rv;
  var wndType;
  var hostAppID = this.getHostAppID();
  
  if (hostAppID == HOSTAPP_FX_GUID) {
    wndType = WNDTYPE_FX_BROWSER;
  }
  else if (hostAppID == HOSTAPP_TB_GUID) {
    wndType = WNDTYPE_TB_MSGCOMPOSE;
  }

  var wm = Components.classes['@mozilla.org/appshell/window-mediator;1']
                     .getService(Components.interfaces.nsIWindowMediator);
  rv = wm.getMostRecentWindow(wndType);

  return rv;
};


aeUtils.getPref = function (aPrefKey, aDefaultValue)
{
  let prefName = PREFNAME_PREFIX + aPrefKey;
  let prefs = Services.prefs;
  let prefType = prefs.getPrefType(prefName);
  let rv = undefined;

  if (prefType == prefs.PREF_STRING) {
    rv = prefs.getCharPref(prefName);
  }
  else if (prefType == prefs.PREF_INT) {
    rv = prefs.getIntPref(prefName);
  }
  else if (prefType == prefs.PREF_BOOL) {
    rv = prefs.getBoolPref(prefName);
  }
  else {
    // Pref doesn't exist if prefType == prefs.PREF_INVALID.
    rv = aDefaultValue;
  }

  return rv;
};


aeUtils.setPref = function (aPrefKey, aPrefValue)
{
  let prefName = PREFNAME_PREFIX + aPrefKey;
  let prefs = Services.prefs;
  let prefType = prefs.getPrefType(prefName);

  if (prefType == prefs.PREF_INT) {
    prefs.setIntPref(prefName, aPrefValue);
  }
  else if (prefType == prefs.PREF_BOOL) {
    prefs.setBoolPref(prefName, aPrefValue);
  }
  else if (prefType == prefs.PREF_STRING) {
    prefs.setCharPref(prefName, aPrefValue);
  }
};


aeUtils.hasPref = function (aPrefKey)
{
  let prefName = PREFNAME_PREFIX + aPrefKey;
  let prefs = Services.prefs;

  return (prefs.getPrefType(prefName) != prefs.PREF_INVALID);
};


aeUtils.beep = function () 
{
  var beepEnabled = this.getPref("clippings.beep_on_error", true);
  if (beepEnabled) {
    this._beep();
  }
};


aeUtils.debugBeep = function ()
{
  if (DEBUG && NOISY_DEBUG) {
    this._beep();
  }
};


aeUtils._beep = function ()
{
  var sound = Components.classes["@mozilla.org/sound;1"]
                        .createInstance(Components.interfaces.nsISound);
  sound.beep();
};


aeUtils.log = function (aMessage) 
{
  if (DEBUG) {
    var consoleSvc = Components.classes["@mozilla.org/consoleservice;1"]
                               .getService(Components.interfaces
					             .nsIConsoleService);
    consoleSvc.logStringMessage(aMessage);
  }
};
