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
 * Portions created by the Initial Developer are Copyright (C) 2011-2015
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");


var gStrBundle;
var gDataSrcLocationOpt, gCustomDataSrcPath, gCustomDataSrcBrws;
var gPrevSelectedDataSrcOpt, gPrevDataSrcPath;
var gClippingsSvc;


//
// Utility functions
//

function getHostAppName()
{
  var rv;
  var thisHostAppID = Application.id;

  if (thisHostAppID == aeConstants.HOSTAPP_FX_GUID) {
    rv = gStrBundle.getString("fx");
  }
  else if (thisHostAppID == aeConstants.HOSTAPP_TB_GUID) {
    rv = gStrBundle.getString("tb");
  }

  return rv;
}



//
// Dialog box functions
//

function initPrefPaneDataSource()
{
  initDlg();

  try {
    gClippingsSvc = Cc["clippings@mozdev.org/clippings;1"].getService(Ci.aeIClippingsService);
  }
  catch (e) {
    aeUtils.alertEx(document.title, e);
  }

  gDataSrcLocationOpt = $("datasrc-location-opt");
  gCustomDataSrcPath = $("custom-datasrc-path");
  gCustomDataSrcBrws = $("custom-datasrc-brws");

  // Set the proper host app name of the first radio button option.
  var hostAppProfDirRadioBtn = $("hostapp-profile-folder");
  var hostAppName = getHostAppName();
  hostAppProfDirRadioBtn.label = gStrBundle.getFormattedString("hostAppProfDir", [hostAppName]);
  hostAppProfDirRadioBtn.accessKey = gStrBundle.getString("hostAppProfDirAccessKey");

  let homePath = aeUtils.getHomeDir().path;
  let profilePath = aeUtils.getUserProfileDir().path;
  let dataSrcPath = aeUtils.getPref("clippings.datasource.location", "");
  if (! dataSrcPath) {
    // The pref should have been set on first run.
    dataSrcPath = profilePath;
    aeUtils.setPref("clippings.datasource.location", dataSrcPath);
  }

  if (dataSrcPath == profilePath) {
    gDataSrcLocationOpt.selectedIndex = 0;
    gCustomDataSrcBrws.disabled = true;
    gCustomDataSrcPath.disabled = true;
    gCustomDataSrcPath.value = homePath;
  }
  else {
    gDataSrcLocationOpt.selectedIndex = 1;
    gCustomDataSrcPath.value = dataSrcPath;
  }
  
  gPrevSelectedDataSrcOpt = gDataSrcLocationOpt.selectedIndex;
  gPrevDataSrcPath = dataSrcPath;
}


function changeDataSrcLocationOptions()
{
  if (gDataSrcLocationOpt.selectedIndex == 0) {
    gCustomDataSrcBrws.disabled = true;
    gCustomDataSrcPath.disabled = true;
  }
  else if (gDataSrcLocationOpt.selectedIndex == 1) {
    gCustomDataSrcBrws.disabled = false;
    gCustomDataSrcPath.disabled = false;
  }
  
  // The action to remove all source URLs from clippings would only apply
  // to the old datasource, not the new one (until after applying the
  // change to the datasource location)
  var newDataSrcPath;
  if (gDataSrcLocationOpt.selectedIndex == 0) {
    newDataSrcPath = aeUtils.getUserProfileDir().path;
  }
  else {
    newDataSrcPath = gCustomDataSrcPath.value;
  }
  $("remove-all-src-urls").disabled = (newDataSrcPath != gPrevDataSrcPath);
}


function browseDataSrcPath()
{
  var filePicker = Components.classes["@mozilla.org/filepicker;1"]
                             .createInstance(Components.interfaces
					               .nsIFilePicker);
  var dataSrcDir = Components.classes["@mozilla.org/file/local;1"]
                             .createInstance(Components.interfaces
                                                       .nsILocalFile);
  dataSrcDir.initWithPath(gCustomDataSrcPath.value);
  filePicker.displayDirectory = dataSrcDir;

  filePicker.init(window, "", filePicker.modeGetFolder);

  var fpShownCallback = {
    done: function (aResult) {
      if (aResult == filePicker.returnOK) {
        gCustomDataSrcPath.value = filePicker.file.path;
        $("remove-all-src-urls").disabled = true;
      }
    }
  };

  filePicker.open(fpShownCallback);
}


function removeAllSourceURLs()
{
  var confirmRemove = aeUtils.confirmYesNo(document.title, gStrBundle.getString("removeAllSrcURLsWarning"), true);

  if (confirmRemove) {
    // Do a backup of the datasource first
    gClippingsSvc.flushDataSrc(true);

    gClippingsSvc.removeAllSourceURLs();
    gClippingsSvc.flushDataSrc(false);

    aeUtils.alertEx(document.title, gStrBundle.getString("removeAllSrcURLsFinish"));

    $("remove-all-src-urls").disabled = true;
  }
}


function applyDataSourcePrefChanges() 
{

  var numBackupFiles = aeUtils.getPref("clippings.backup.maxfiles", 10);
  gClippingsSvc.setMaxBackupFiles(numBackupFiles);

  var newDataSrcPath;

  if (gDataSrcLocationOpt.selectedIndex == 0) {
    newDataSrcPath = aeUtils.getUserProfileDir().path;
  }
  else {
    newDataSrcPath = gCustomDataSrcPath.value;
  }

  let dsURL = aeUtils.getURLFromFilePath(newDataSrcPath);

  // Reinitialize the datasource to point to the new datasource location.
  gClippingsSvc.reset();
  try {
    gClippingsSvc.getDataSource(dsURL + aeConstants.CLIPDAT_FILE_NAME);
    gClippingsSvc.setBackupDir(dsURL + aeConstants.BACKUP_DIR_NAME);
  }
  catch (e) {
    doAlert(gStrBundle.getString("errorDSReset"));
    return;
  }

  gClippingsSvc.notifyDataSrcLocationChanged();
  aeUtils.setPref("clippings.datasource.location", newDataSrcPath);

  return true;
}
