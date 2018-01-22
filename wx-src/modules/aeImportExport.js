/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let aeImportExport = {
  DEBUG: false,

  CLIPPINGS_JSON_VER: "6.0",
  ROOT_FOLDER_ID: 0,

  HTML_EXPORT_PAGE_TITLE: "Clippings",
  
  RDF_MIME_TYPE: "application/rdf+xml",
  RDF_SEQ: "http://www.w3.org/1999/02/22-rdf-syntax-ns#Seq",
  CLIPPINGS_RDF_NS: "http://clippings.mozdev.org/ns/rdf#",
  CLIPPINGS_RDF_ROOT_FOLDER: "http://clippings.mozdev.org/rdf/user-clippings-v2",
  
  _db: null
};


aeImportExport.setDatabase = function (aDatabase)
{
  this._db = aDatabase;
};


aeImportExport.importFromJSON = function (aImportRawJSON, aReplaceShortcutKeys)
{
  if (! this._db) {
    throw new Error("aeImportExport: Database not initialized!");
  }

  let importData;

  try {
    importData = JSON.parse(aImportRawJSON);
  }
  catch (e) {
    // SyntaxError - Raw JSON data is invalid.
    throw e;
  }

  this._log("aeImportExport: Imported JSON data:");
  this._log(importData);

  this._getShortcutKeysToClippingIDs().then(aShortcutKeyLookup => {
    this._log("Starting JSON import...");
    try {
      this._importFromJSONHelper(this.ROOT_FOLDER_ID, importData.userClippingsRoot, aReplaceShortcutKeys, aShortcutKeyLookup);
    }
    catch (e) {
      console.error("Import of JSON data failed!");
      throw e;
    }
    this._log("Import completed!");

  }).catch(aErr => { throw aErr });
};


aeImportExport._importFromJSONHelper = function (aParentFolderID, aImportedItems, aReplaceShortcutKeys, aShortcutKeys)
{
  this._db.transaction("rw", this._db.clippings, this._db.folders, () => {
    let importedClippings = [];
    let clippingsWithKeyConflicts = [];

    for (let item of aImportedItems) {
      if ("children" in item) {
        let folder = {};
        try {
          folder = {
            name: item.name,
            parentFolderID: aParentFolderID
          };
        }
        catch (e) {
          console.error(e);
          throw e;
        }
        
        this._db.folders.add(folder).then(aNewFolderID => {
          this._importFromJSONHelper(aNewFolderID, item.children, aReplaceShortcutKeys, aShortcutKeys);
        });
      }
      else {
        let clipping = {};
        let shortcutKey = "";

        if (aShortcutKeys[item.shortcutKey]) {
          if (aReplaceShortcutKeys) {
            shortcutKey = item.shortcutKey;
            clippingsWithKeyConflicts.push(aShortcutKeys[item.shortcutKey]);
          }
          else {
            shortcutKey = "";
          }
        }
        else {
          shortcutKey = item.shortcutKey;
        }
        
        clipping = {
          name: item.name,
          content: item.content,
          shortcutKey,
          sourceURL: item.sourceURL,
          label: ("label" in item ? item.label : ""),
          parentFolderID: aParentFolderID
        };

        importedClippings.push(clipping);
      }
    }

    this._db.clippings.bulkAdd(importedClippings).then(aLastAddedID => {
      if (aReplaceShortcutKeys) {
        for (let clippingID of clippingsWithKeyConflicts) {
          this._db.clippings.update(clippingID, { shortcutKey: "" });
        }
      }
    });
  }).catch(aErr => {
    console.error("aeImportExport._importFromJSONHelper(): " + aErr);
    throw aErr;
  });
};


aeImportExport.exportToJSON = function (aIncludeSrcURLs, aDontStringify)
{
  let expData = {
    version: this.CLIPPINGS_JSON_VER,
    createdBy: "Clippings/wx",
    userClippingsRoot: []
  };

  return new Promise((aFnResolve, aFnReject) => {
    this._exportToJSONHelper(this.ROOT_FOLDER_ID, aIncludeSrcURLs).then(aExpItems => {
      expData.userClippingsRoot = aExpItems;

      if (aDontStringify) {
        aFnResolve(expData);
      }
      aFnResolve(JSON.stringify(expData));

    }).catch(aErr => {
      console.error("aeImportExport.exportToJSON(): " + aErr);
      aFnReject(aErr);
    });
  });
}


aeImportExport._exportToJSONHelper = function (aFolderID, aIncludeSrcURLs)
{
  let rv = [];
  
  return new Promise((aFnResolve, aFnReject) => {
    this._db.transaction("r", this._db.clippings, this._db.folders, () => {
      this._db.folders.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
        let folder = {
          name: aItem.name,
          children: []
        };

        this._exportToJSONHelper(aItem.id, aIncludeSrcURLs).then(aChildItems => {
          folder.children = aChildItems;
          rv.push(folder);
        });
      }).then(() => {
        return this._db.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
          let clipping = {
            name: aItem.name,
            content: aItem.content,
            shortcutKey: aItem.shortcutKey,
            sourceURL: (aIncludeSrcURLs ? aItem.sourceURL : ""),
            label: aItem.label,
          };
          rv.push(clipping);
        });
      }).then(() => {
        aFnResolve(rv);
      });
    }).catch(aErr => {
      console.error("aeImportExport._exportToJSONHelper(): " + aErr);
      aFnReject(aErr);
    });
  });
};


aeImportExport.exportToHTML = async function ()
{
  function exportToHTMLHelper(aFldrItems)
  {
    let rv = "<dl>";
    let that = aeImportExport;
    
    for (let item of aFldrItems) {
      if (item.children) {
        let name = that._sanitize(item.name);
        let dt = `<dt class="folder"><h2>${name}</h2></dt>`;
        let dd = "<dd>" + exportToHTMLHelper(item.children);
        dd += "</dd>";
        rv += dt + dd;
      }
      else {
        let name = that._sanitize(item.name);
        let dt = `<dt class="clipping"><h3>${name}</h3></dt>`;
        let text = that._sanitize(item.content);
        text = text.replace(/\n/g, "<br>");
        let dd = `<dd>${text}</dd>`;
        rv += dt + dd;
      }
    }

    rv = rv + "</dl>";
    return rv;
  }
  
  let rv = "";

  let expData;
  try {
    expData = await this.exportToJSON(false, true);
  }
  catch (e) {
    console.error("aeImportExport.exportToHTML(): " + e);
    throw e;
  }
  
  let htmlSrc = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${this.HTML_EXPORT_PAGE_TITLE}</title></head><body><h1>${this.HTML_EXPORT_PAGE_TITLE}</h1>`;

  htmlSrc += exportToHTMLHelper(expData.userClippingsRoot);
  
  rv = htmlSrc + "</body></html>";

  return rv;
};


aeImportExport.importFromRDF = function (aRDFRawData, aReplaceShortcutKeys)
{
  this._log(`aeImportExport.importFromRDF(): Reading raw RDF data (size: ${aRDFRawData.length} bytes)`);

  let dataSrc = $rdf.graph();
  try {
    $rdf.parse(aRDFRawData, dataSrc, this.CLIPPINGS_RDF_ROOT_FOLDER, this.RDF_MIME_TYPE);
  }
  catch (e) {
    console.error("aeImportExport.importFromRDF(): Failed to parse Clippings RDF data!\n" + e);
    throw e;
  }

  let jsonData = {
    version: "6.0"
  };
  
  let rootFolderNode = $rdf.sym(this.CLIPPINGS_RDF_ROOT_FOLDER);
  jsonData.userClippingsRoot = this._importFromRDFHelper(dataSrc, rootFolderNode);

  this._getShortcutKeysToClippingIDs().then(aShortcutKeyLookup => {
    this._importFromJSONHelper(this.ROOT_FOLDER_ID, jsonData.userClippingsRoot, aReplaceShortcutKeys, aShortcutKeyLookup);
  });
};


aeImportExport._importFromRDFHelper = function (aDataSrc, aRDFFolderNode)
{
  let rv = [];
  let folderItems = aDataSrc.statementsMatching(aRDFFolderNode);
  
  for (let i = 0; i < folderItems.length; i++) {
    if (folderItems[i].object.value != this.RDF_SEQ) {
      let itemURI = folderItems[i].object.value;
      let item = aDataSrc.each($rdf.sym(itemURI));
      let cnvItem = {};

      if (item.length == 0) {
        continue;
      }
      
      let itemType = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(aDataSrc.namespaces.RDF + "type")).value;

      this._log(`[${i}]: Item type: "${itemType}"`);

      if (itemType == this.CLIPPINGS_RDF_NS + "null") {
        this._log("Skipping null clipping in empty folder.");
        continue;
      }
      else if (itemType == this.RDF_SEQ) {
        let folderName = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_NS + "name")).value;

        this._info("Folder name: " + folderName);

        cnvItem = {
          name: folderName,
          children: []
        };
        
        cnvItem.children = this._importFromRDFHelper(aDataSrc, $rdf.sym(itemURI));
      }
      else if (itemType == this.CLIPPINGS_RDF_NS + "clipping") {
        let clippingName = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_NS + "name")).value;
        let content = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_NS + "text")).value;

        let debugMsg = `Clipping name: ${clippingName}\nContent: ${content}`;

        let shortcutKey = "";
        try {
          shortcutKey = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_NS + "key")).value;
        }
        catch (e) {}
        if (shortcutKey) {
          debugMsg += `\nShortcut key: '${shortcutKey}'`;
        }

        let sourceURL = "";
        try {
          sourceURL = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_NS + "srcurl")).value;
        }
        catch (e) {}
        if (sourceURL) {
          debugMsg += `\nSource URL: ${sourceURL}`;
        }
        
        let label = "";
        try {
          label = aDataSrc.any($rdf.sym(itemURI), $rdf.sym(this.CLIPPINGS_RDF_NS + "label")).value;
        }
        catch (e) {}
        if (label) {
          debugMsg += `\nLabel: ${label}`;
        }

        cnvItem = { name: clippingName, content, shortcutKey, sourceURL, label };

        this._log(debugMsg);
      }
      
      rv.push(cnvItem);
    }
  }
  return rv;
};


aeImportExport._getShortcutKeysToClippingIDs = async function ()
{
  let rv = {};

  await this._db.clippings.where("shortcutKey").notEqual("").each((aItem, aCursor) => {
    rv[aItem.shortcutKey] = aItem.id;
  });
  
  return rv;
};


aeImportExport._sanitize = function (aStr)
{
  let rv = aStr.replace(/</g, "&lt;");
  rv = rv.replace(/>/g, "&gt;");

  return rv;
};


//
// Debugging methods
//

aeImportExport._log = function (aMessage)
{
  if (this.DEBUG) { console.log(aMessage); }
};


aeImportExport._info = function (aMessage)
{
  if (this.DEBUG) { console.info(aMessage); }
};


aeImportExport._warn = function (aMessage)
{
  if (this.DEBUG) { console.warn(aMessage); }
};
