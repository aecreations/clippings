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
 * Portions created by the Initial Developer are Copyright (C) 2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

let aeImportExport = {
  DEBUG: true,

  RDF_MIME_TYPE: "application/rdf+xml",
  RDF_SEQ: "http://www.w3.org/1999/02/22-rdf-syntax-ns#Seq",
  CLIPPINGS_RDF_NS: "http://clippings.mozdev.org/ns/rdf#",
  CLIPPINGS_RDF_ROOT_FOLDER: "http://clippings.mozdev.org/rdf/user-clippings-v2",
  CLIPPINGS_RDF_TYPE_FOLDER: "http://clippings.mozdev.org/ns/rdf#folder",
  CLIPPINGS_RDF_TYPE_CLIPPING: "http://clippings.mozdev.org/ns/rdf#clipping",
  CLIPPINGS_RDF_PREDNAME: "http://clippings.mozdev.org/ns/rdf#name",
  CLIPPINGS_RDF_PREDTEXT: "http://clippings.mozdev.org/ns/rdf#text",
  CLIPPINGS_RDF_PREDKEY:  "http://clippings.mozdev.org/ns/rdf#key",
  CLIPPINGS_RDF_PREDSRCURL: "http://clippings.mozdev.org/ns/rdf#srcurl",
  CLIPPINGS_RDF_PREDLABEL: "http://clippings.mozdev.org/ns/rdf#label",
  
  _db: null
};


aeImportExport.setDatabase = function (aDatabase)
{
  this._db = aDatabase;
};


aeImportExport.importFromJSON = function (aImportRawJSON)
{
  if (! this._db) {
    throw "aeImportExport: Database not initialized!";
  }
  
  let importData = JSON.parse(aImportRawJSON);

  this._log("aeImportExport: Imported JSON data:");
  this._log(importData);

  if (importData === null) {
    throw "aeImportExport: Unable to read imported JSON data.";
  }

  this._log("Starting JSON import...");
  this._importFromJSONHelper(0, importData.userClippingsRoot);
  this._log("Import completed!");
};


aeImportExport._importFromJSONHelper = function (aParentFolderID, aImportedItems)
{
  this._db.transaction("rw", this._db.clippings, this._db.folders, () => {
    let importedClippings = [];

    for (let item of aImportedItems) {
      if ("children" in item) {
        let createFolder = this._db.folders.add({
          name: item.name,
          parentFolderID: aParentFolderID
        });
        createFolder.then(aNewFolderID => {
          this._importFromJSONHelper(aNewFolderID, item.children);
        });
      }
      else {
        importedClippings.push({
          name: item.name,
          content: item.content,
          shortcutKey: "",
          parentFolderID: aParentFolderID
        });
      }
    }

    let bulkCreateClippings = this._db.clippings.bulkAdd(importedClippings);
    bulkCreateClippings.then(aLastAddedID => {
      // ...
    }).catch(aErr => { console.error(aErr) });
  });
};


aeImportExport.importFromRDF = function (aRDFRawData)
{
  this._log(`aeImportExport.importFromRDF(): Reading raw RDF data (size: ${aRDFRawData.length} bytes)`);

  let dataSrc = $rdf.graph();
  try {
    $rdf.parse(aRDFRawData, dataSrc, this.CLIPPINGS_RDF_ROOT_FOLDER, this.RDF_MIME_TYPE);
  }
  catch (e) {
    this._warn("aeImportExport.importFromRDF(): Failed to parse Clippings RDF data!\n" + e);
    return;
  }

  let rootFolderNode = $rdf.sym(this.CLIPPINGS_RDF_ROOT_FOLDER);
  this._importFromRDFHelper(dataSrc, rootFolderNode);
};


aeImportExport._importFromRDFHelper = function (aDataSrc, aRDFFolderNode)
{
  let folderItems = aDataSrc.statementsMatching(aRDFFolderNode);
  
  for (let i = 0; i < folderItems.length; i++) {
    if (folderItems[i].object.value != this.RDF_SEQ) {
      let itemURI = folderItems[i].object.value;
      let item = aDataSrc.each($rdf.sym(itemURI));

      if (item.length == 0) {
        continue;
      }
      
      let itemType = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(aDataSrc.namespaces.RDF + "type")).value;

      this._log(`[${i}]: Item type: "${itemType}"`);

      if (itemType == this.RDF_SEQ) {
        let folderName = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_PREDNAME));

        this._info("Folder name: " + folderName);
        this._importFromRDFHelper(aDataSrc, $rdf.sym(itemURI));
      }
      else if (itemType == this.CLIPPINGS_RDF_TYPE_CLIPPING) {
        let clippingName = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_PREDNAME)).value;
        let content = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_PREDTEXT)).value;

        let debugMsg = `Clipping name: ${clippingName}\nContent: ${content}`;

        let shortcutKey = "";
        try {
          shortcutKey = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_PREDKEY)).value;
        }
        catch (e) {}

        if (shortcutKey) {
          debugMsg += `\nShortcut key: '${shortcutKey}'`;
        }

        // TO DO: Wrap the next 2 lines in a try...catch block, like above.
        /***
        let srcURL = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_PREDSRCURL)).value;
        let label = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_PREDLABEL)).value;
        ***/

        this._log(debugMsg);
      }
    }
  }
};


//
// Debugging methods
//

aeImportExport._log = function (aMessage)
{
  if (DEBUG) { console.log(aMessage); }
};


aeImportExport._info = function (aMessage)
{
  if (DEBUG) { console.info(aMessage); }
};


aeImportExport._warn = function (aMessage)
{
  if (DEBUG) { console.warn(aMessage); }
};
