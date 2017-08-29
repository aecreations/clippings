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
  ORIGIN_IMPORT: 4,
  
  _db: null
};


aeImportExport.setDatabase = function (aDatabase)
{
  this._db = aDatabase;
};


aeImportExport.importFromJSON = function (aImportJSON)
{
  if (! this._db) {
    throw "aeImportExport: Database not initialized!";
  }
  
  let importData = JSON.parse(aImportJSON);

  this._log("Imported JSON data:");
  this._log(importData);

  if (importData === null) {
    throw "aeImportExport: Unable to read imported JSON data.";
  }

  this._importFromJSONHelper(0, importData.userClippingsRoot);
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
}


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
