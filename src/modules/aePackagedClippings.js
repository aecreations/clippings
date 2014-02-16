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
 * Portions created by the Initial Developer are Copyright (C) 2007-2014
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://clippings/modules/aeString.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");


const EXPORTED_SYMBOLS = ["aePackagedClippings"];


//
// Packaged data source library
//

var aePackagedClippings = {
  PACKAGED_DS_FILENAME: "clippak.rdf",
  PACKAGED_DS_DIRNAME:  "defaults",

  // Exceptions
  E_CLIPPINGSSVC_NOT_INITIALIZED: "nsIClippingsService not initialized",
  E_IMPORT_FAILED: "Import of packaged datasource failed",
  E_FLUSH_FAILED:  "Flush after import of packaged datasource failed"
};


/*
 * Returns the packaged data source file object (instance of nsIFile),
 * if it exists.
 */
aePackagedClippings.getPackagedDataSrcFile = function (aClippingsInstallDir)
{
  var rv;
  let pdsDir = aClippingsInstallDir.clone();
  pdsDir.append(aePackagedClippings.PACKAGED_DS_DIRNAME);

  if (pdsDir.exists() && pdsDir.isDirectory()) {
    let pdsFile = pdsDir.clone();
    pdsFile.append(aePackagedClippings.PACKAGED_DS_FILENAME);
    if (pdsFile.exists() && pdsFile.isFile()) {
      rv = pdsFile;
    }
  }

  return rv;
};


/*
 * Import the packaged clippings data into the Clippings data source
 */
aePackagedClippings.import = function (aClippingsSvc, aPackagedDSFile)
{
  if (! aClippingsSvc) {
    throw this.E_CLIPPINGSSVC_NOT_INITIALIZED;
  }

  var fph = Components.classes["@mozilla.org/network/protocol;1?name=file"].createInstance(Components.interfaces.nsIFileProtocolHandler); 
  var pkgDataSrcURL = fph.getURLSpecFromFile(aPackagedDSFile);
  var numImported = -1;
  var importShortcutKeys = true;

  aeUtils.log(aeString.format("URL of the packaged data source file to import: %S", pkgDataSrcURL));

  try {
    numImported = aClippingsSvc.importFromFile(pkgDataSrcURL, true, importShortcutKeys, {});
  }
  catch (e) {
    aeUtils.log(aeString.format("aePackagedClippings.import(): Exception thrown by nsIClippingsService.importFromFile():\n\n%s", e));
    throw this.E_IMPORT_FAILED;
  }

  if (numImported != -1) {
    aeUtils.log(aeString.format("Successfully imported the packaged data into the Clippings data source\n%d item(s) imported", numImported));
    
    try {
      aClippingsSvc.flushDataSrc();
    }
    catch (e) {
      aeUtils.log(aeString.format("aePackagedClippings.import(): Exception thrown by nsIClippingsService.flushDataSrc():\n\n%s", e));
      throw this.E_FLUSH_FAILED;
    }
  }
};

