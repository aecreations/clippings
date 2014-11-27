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
 * Portions created by the Initial Developer are Copyright (C) 2005-2013
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

// Supported in Firefox 3 and higher, and Thunderbird 3 and higher
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


function nsClippingsService() {}

nsClippingsService.prototype = {
  // Public constants
  FILETYPE_RDF_XML: 0,
  FILETYPE_CLIPPINGS_1X: 1,
  FILETYPE_HTML: 2,

  ORIGIN_CLIPPINGS_MGR: 1,
  ORIGIN_HOSTAPP: 2,
  ORIGIN_NEW_CLIPPING_DLG: 3,

  IMPORT_REPLACE_CURRENT:  1,
  IMPORT_KEEP_CURRENT:     2,

  MAX_NAME_LENGTH:        64,

  // Private constants (not declared in interface definition)
  _DEBUG:  false,
  _TEST_CORRUPTION: false,
  _SEQNODE_RESOURCE_URI:  "http://clippings.mozdev.org/rdf/user-clippings-v2",
  _OLD_SEQNODE_RESOURCE_URI: "http://clippings.mozdev.org/rdf/user-clippings",
  _PREDNAME_RESOURCE_URI: "http://clippings.mozdev.org/ns/rdf#name",
  _PREDTEXT_RESOURCE_URI: "http://clippings.mozdev.org/ns/rdf#text",
  _PREDKEY_RESOURCE_URI:  "http://clippings.mozdev.org/ns/rdf#key",
  _PREDHASSUBFOLDERS_RESOURCE_URI: "http://clippings.mozdev.org/ns/rdf#hassubfolders",
  _PREDTYPE_RESOURCE_URI: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  _RDFTYPE_FOLDER_RESOURCE_URI: "http://clippings.mozdev.org/ns/rdf#folder",
  _RDFTYPE_CLIPPING_RESOURCE_URI: "http://clippings.mozdev.org/ns/rdf#clipping",
  _RDFTYPE_NULL_RESOURCE_URI: "http://clippings.mozdev.org/ns/rdf#null",
  _RDF_SEQ_URI: "http://www.w3.org/1999/02/22-rdf-syntax-ns#Seq",
  _BACKUP_FILE_PREFIX:    "clippings_",
  _BACKUP_FILE_EXTENSION: ".rdf",

  _CLIPPINGS_HTML_NS: "http://clippings.mozdev.org/ns/html#",

  // Private member variables
  _dataSrc: null,
  _rdfSvc:  Components.classes["@mozilla.org/rdf/rdf-service;1"]
                      .getService(Components.interfaces.nsIRDFService),
  _rdfContainerUtils: Components.classes["@mozilla.org/rdf/container-utils;1"].getService(Components.interfaces.nsIRDFContainerUtils),
  _rdfContainer:        null,
  _dsFileURL:        "",
  _backupDirURL:     "",
  _maxBackupFiles:   10,
  _emptyClippingStr: "(Empty)",
  _listeners:        [],
  _detachedItems:    [],
  _count:            -1,

  // Getter
  get kRootFolderURI()
  {
    return this._SEQNODE_RESOURCE_URI;
  },

  get dataSourceURL()
  {
    return this._dsFileURL;
  },

  get numItems() 
  {
    var rv;
    if (this._rdfContainer) {
      if (this._count == -1) {
	this._count = this._countRec(this._rdfContainer);
      }
      rv = this._count;
    }
    return rv;
  },

  // Component registration
  classDescription: "Clippings Datasource API",
  classID:          Components.ID("{8ebf6eef-c354-4211-89d0-603b45b76393}"),
  contractID:       "clippings@mozdev.org/clippings;1",
  QueryInterface:   XPCOMUtils.generateQI([Components.interfaces.nsIClippingsService])

};


nsClippingsService.prototype.addListener = function (aListener)
{
  this._listeners.push(aListener);
  this._log("Added listener object to nsIClippingsService");
};


nsClippingsService.prototype.removeListener = function (aListener)
{
  for (let i = 0; i < this._listeners.length; i++) {
    if (this._listeners[i] == aListener) {
      delete this._listeners[i];
      this._log("Removed listener object " + i + " from nsIClippingsService");
    }
  }
};


nsClippingsService.prototype.getDataSource = function (aDataSrcURL)
{
  if (this._dataSrc) {
    return this._dataSrc;
  }

  this._dsFileURL = aDataSrcURL;

  try {
    // If Clippings data file doesn't exist, it will be created automatically.
    this._dataSrc = this._rdfSvc.GetDataSourceBlocking(aDataSrcURL);
  }
  catch (e) {
    this._log(e);
    throw e;
  }

  var seqNode = this._rdfSvc.GetResource(this._SEQNODE_RESOURCE_URI);
  
  // MakeSeq will create a new <RDF:Seq> if it doesn't already exist.
  // If it does, it just initializes it
  this._rdfContainer = this._rdfContainerUtils.MakeSeq(this._dataSrc, seqNode);
  this._rdfContainer = this._rdfContainer.QueryInterface(Components.interfaces.nsIRDFContainer);

  if (this._count == -1) {
    this._count = this._countRec(this._rdfContainer);
  }

  this._log("nsClippingsService.getDataSource(): Initialization complete\nDatasource URL: \"" + aDataSrcURL + "\"\n" + this._count + " item(s) in root folder");
  return this._dataSrc;
};


nsClippingsService.prototype.reset = function ()
{
  this.purgeDetachedItems();

  this._dataSrc = null;
  this._rdfContainer = null;
  this._dsFileURL = "";
  this._count = -1;
};


nsClippingsService.prototype.setBackupDir = function (aBackupDirURL)
{
  this._backupDirURL = aBackupDirURL;
};


nsClippingsService.prototype.setMaxBackupFiles = function (aNumFiles)
{
  this._maxBackupFiles = aNumFiles;
};


nsClippingsService.prototype.createClippingNameFromText = function (aText)
{
  var rv = "";
  var clipName = "";

  if (aText.length > this.MAX_NAME_LENGTH) {
    // Leave room for the three-character elipsis.
    clipName = this._strtrm(aText).substr(0, this.MAX_NAME_LENGTH - 3) + "...";
  } 
  else {
    clipName = this._strtrm(aText);
  }

  // Truncate clipping names at newlines if they exist.
  let newlineIdx = clipName.indexOf("\n");
  rv = (newlineIdx == -1) ? clipName : clipName.substring(0, newlineIdx);

  return rv;
};


nsClippingsService.prototype.newClippingFromText = function (aText, aShowDialog, aChromeWnd, aParentFolder, aDontNotify)
{
  var rv = "";
  var clipName;
  var parentFolderURI = aParentFolder || this.kRootFolderURI;
  var clipText = new String(aText);

  if (clipText && aText) {
    clipName = this.createClippingNameFromText(clipText);

    this._log("nsClippingsService.newClippingFromText(): clipName: \"" + clipName + "\"; length: " + clipName.length);

    if (aShowDialog) {
      var args = {
	name: clipName,
	text: clipText,
	key:  null,
	destFolder: null,
	userCancel: null
      };
      aChromeWnd.openDialog("chrome://clippings/content/new.xul", "newclp_dlg",
			    "centerscreen,modal", args);
      if (args.userCancel) {
	return args.destFolder || "";
      }
      clipName = args.name;
      clipText = args.text;
      parentFolderURI = args.destFolder;
    }

    if (! this.exists(parentFolderURI)) {
       throw Components.Exception("nsClippingsService.newClippingFromText(): Folder does not exist: " + parentFolderURI);
    }

    this._log("nsClippingsService.newClippingFromText(): Parent folder URI: " + parentFolderURI);
    rv = this.createNewClipping(parentFolderURI, clipName, clipText, aDontNotify);

    if (args && args.key) {
      this.setShortcutKey(rv, args.key);
    }
  } 
  return rv;
};


nsClippingsService.prototype.createNewClipping = function (aParentFolder, aName, aText, aDontNotify, aDataSrc)
  // aDataSrc param for internal use only - not exposed in interface (needed
  // for exporting)
{
  var newNode = this._rdfSvc.GetAnonymousResource();
  this._createNewClippingHelper(aParentFolder, newNode, aName, aText, null, aDontNotify, aDataSrc);
  return newNode.Value;  // URI of new RDF node
};


nsClippingsService.prototype.createNewClippingEx = function (aParentFolder, aURI, aName, aText, aPos, aDontNotify)
{
  var rv;
  var newNode;
  if (aURI) {
    newNode = this._rdfSvc.GetResource(aURI);
    rv = aURI;
  }
  else {
    newNode = this._rdfSvc.GetAnonymousResource();
    rv = newNode.Value;
  }

  this._createNewClippingHelper(aParentFolder, newNode, aName, aText, aPos, aDontNotify);
  return rv;
};


nsClippingsService.prototype._createNewClippingHelper = function (aParentFolderURI, aNode, aName, aText, aPos, aDontNotify, aDataSrc)
{
  var ds = aDataSrc || this._dataSrc;
  if (! ds) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  var name = this._sanitize(aName);
  var text = this._sanitize(aText);
  var predName = this._rdfSvc.GetResource(this._PREDNAME_RESOURCE_URI);
  var predText = this._rdfSvc.GetResource(this._PREDTEXT_RESOURCE_URI);
  var predType = this._rdfSvc.GetResource(this._PREDTYPE_RESOURCE_URI);
  var targName = this._rdfSvc.GetLiteral(name);
  var targText = this._rdfSvc.GetLiteral(text);
  var targType = this._rdfSvc.GetResource(this._RDFTYPE_CLIPPING_RESOURCE_URI);

  ds.Assert(aNode, predName, targName, true);
  ds.Assert(aNode, predText, targText, true);
  ds.Assert(aNode, predType, targType, true);

  var parentFolderCtr = this._getSeqContainerFromFolder(aParentFolderURI, ds);

  if (aPos) {
    try {
      parentFolderCtr.InsertElementAt(aNode, aPos, true);
    } catch (e) {
      throw Components.Exception("**ERROR: aNode=" + aNode + "; aPos=" + aPos + "\n" + e);
    }
  }
  else {
    try {
      parentFolderCtr.AppendElement(aNode);
    }
    catch (e) {
      // Exception thrown if the datasource is empty AND common clippings
      // are enabled.
    }
  }

  if (ds == this._dataSrc) {
    this._count++;

    // Get rid of the dummy item that would be present in the folder if it was
    // empty before this new clipping was added to it.
    this._removeDummyNode(aParentFolderURI, ds);

    // Notify all observers
    if (! aDontNotify) {
      for (let i = 0; i < this._listeners.length; i++) {
	if (this._listeners[i]) {
	  this._log("nsClippingsService._createNewClippingHelper(): Notifying observer " + i);
	  this._listeners[i].newClippingCreated(aNode.Value);
	}
      }
    }
  }
};


nsClippingsService.prototype.createNewFolder = function (aParentFolder, aName, aDontNotify, aDataSrc)
  // aDataSrc param for internal use only - not exposed in interface (needed
  // for exporting)
{
  var newNode = this._rdfSvc.GetAnonymousResource();
  this._createNewFolderHelper(aParentFolder, newNode, aName, null, aDontNotify, null, aDataSrc);
  return newNode.Value;  // URI of new RDF node
};


nsClippingsService.prototype.createNewFolderEx = function (aParentFolder, aURI, aName, aPos, aDontNotify, aOrigin)
{
  var rv;
  var newNode;
  if (aURI) {
    newNode = this._rdfSvc.GetResource(aURI);
    rv = aURI;
  }
  else {
    newNode = this._rdfSvc.GetAnonymousResource();
    rv = newNode.Value;
  }

  this._createNewFolderHelper(aParentFolder, newNode, aName, aPos, aDontNotify, aOrigin, null);
  return rv;
};


nsClippingsService.prototype._createNewFolderHelper = function (aParentFolderURI, aNode, aName, aPos, aDontNotify, aOrigin, aDataSrc)
{
  var ds = aDataSrc || this._dataSrc;
  if (! ds) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  var name = this._sanitize(aName);

  // Add triples to the folder node with `name' and `type' predicates.
  var predName = this._rdfSvc.GetResource(this._PREDNAME_RESOURCE_URI);
  var predType = this._rdfSvc.GetResource(this._PREDTYPE_RESOURCE_URI);
  var targName = this._rdfSvc.GetLiteral(name);
  var targType = this._rdfSvc.GetResource(this._RDFTYPE_FOLDER_RESOURCE_URI);
  ds.Assert(aNode, predName, targName, true);
  ds.Assert(aNode, predType, targType, true);

  // Add a triple indicating whether or not this folder has any subfolders.
  // This is needed for generating the folder submenu for Move To and Copy To
  // commands in Clippings Manager.
  var predHasSubf = this._rdfSvc.GetResource(this._PREDHASSUBFOLDERS_RESOURCE_URI);
  var targHasSubf = this._rdfSvc.GetLiteral("false");
  ds.Assert(aNode, predHasSubf, targHasSubf, true);

  var prevSubfCount = this.getCountSubfolders(aParentFolderURI, ds);

  // Append the folder to the parent folder.
  var parentFolderCtr = this._getSeqContainerFromFolder(aParentFolderURI, ds);

  if (aPos) {
    try {
      parentFolderCtr.InsertElementAt(aNode, aPos, true);
    } catch (e) {
      throw Components.Exception("**ERROR: aNode=" + aNode + "; aPos=" + aPos + "\n" + e);
    }
  }
  else {
    parentFolderCtr.AppendElement(aNode);
  }

  // Make the folder node an <rdf:Seq> container.
  var folderCtr = this._rdfContainerUtils.MakeSeq(ds, aNode);

  // Update the "has subfolders" triple of the parent folder.
  if (prevSubfCount == 0) {
    this._setHasSubfoldersTriple(aParentFolderURI, true, ds);
  }

  if (ds == this._dataSrc) {
    this._count++;

    aNode = aNode.QueryInterface(Components.interfaces.nsIRDFResource);
    var newFolderURI = aNode.Value;

    // Get rid of dummy item if it already exists for this folder - this would
    // happen if this folder was deleted before and is being recreated by a
    // Undo Undo command
    this._removeDummyNode(newFolderURI, ds);
    this._appendDummyNode(newFolderURI, ds);

    // Get rid of the dummy item in the parent folder if it exists.
    this._removeDummyNode(aParentFolderURI, ds);

    // Notify all observers, except the one that is creating the folder.
    if (! aDontNotify) {
      for (let i = 0; i < this._listeners.length; i++) {
	if (this._listeners[i] && this._listeners[i].origin != aOrigin) {
	  this._log("nsClippingsService._createNewFolderHelper(): Notifying observer " + i);
	  this._listeners[i].newFolderCreated(aNode.Value);
	}
      }
    }
  }
};



nsClippingsService.prototype._getSeqContainerFromFolder = function (aURI, aDataSrc)
{
  var ds = aDataSrc || this._dataSrc;

  // Don't need to do anything special if folder is root
  if (aURI == this.kRootFolderURI) {
    if (! aDataSrc) {
      return this._rdfContainer;
    }
  }

  var seqNode = this._rdfSvc.GetResource(aURI);
  var container = this._rdfContainerUtils.MakeSeq(ds, seqNode);
  container = container.QueryInterface(Components.interfaces.nsIRDFContainer);

  return container;
};


nsClippingsService.prototype.createEmptyClipping = function (aFolderURI)
{
  if (! this.isFolder(aFolderURI)) {
    throw Components.Exception("nsClippingsService.createEmptyClipping(): URI argument is not a folder resource", Components.results.NS_ERROR_INVALID_ARG);
  }

  this._appendDummyNode(aFolderURI);
};


nsClippingsService.prototype.processRootFolder = function ()
{
  if (! this._rdfContainer) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  if (this.getCount(this.kRootFolderURI) == 0) {
    this._appendDummyNode(this.kRootFolderURI);
    this.flushDataSrc();
  }
};


nsClippingsService.prototype.processEmptyFolders = function ()
{
  if (! this._rdfContainer) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }
  this._processEmptyFolders(this._rdfContainer);
};


nsClippingsService.prototype._processEmptyFolders = function (aFolderCtr)
{
  var childrenEnum = aFolderCtr.GetElements();
  while (childrenEnum.hasMoreElements()) {
    var child = childrenEnum.getNext();
    child = child.QueryInterface(Components.interfaces.nsIRDFResource);
    var childURI = child.Value;

    if (this.isFolder(childURI)) {
      if (this.getCount(childURI) == 0) {
	this._appendDummyNode(childURI);
	this._log("Empty clipping appended to folder \"" + this.getName(childURI) + "\"");
      }
      else {
	var folderCtr = this._getSeqContainerFromFolder(childURI);
	this._processEmptyFolders(folderCtr);
      }
    }
  }
};


nsClippingsService.prototype._appendDummyNode = function (aFolderURI, aDataSrc)
{
  var ds = aDataSrc || this._dataSrc;

  var folderCtr = this._getSeqContainerFromFolder(aFolderURI, ds);
  var dummyNode = this._rdfSvc.GetAnonymousResource();
  var predType = this._rdfSvc.GetResource(this._PREDTYPE_RESOURCE_URI);
  var targType = this._rdfSvc.GetResource(this._RDFTYPE_NULL_RESOURCE_URI);

  var predDummy = this._rdfSvc.GetResource("http://clippings.mozdev.org/ns/rdf#dummy_flag");
  var targDummy = this._rdfSvc.GetLiteral("dummy");
  var predName = this._rdfSvc.GetResource(this._PREDNAME_RESOURCE_URI);
  var targName = this._rdfSvc.GetLiteral(this._emptyClippingStr);

  ds.Assert(dummyNode, predType, targType, true);
  ds.Assert(dummyNode, predDummy, targDummy, true);
  ds.Assert(dummyNode, predName, targName, true);
  folderCtr.AppendElement(dummyNode);
};


nsClippingsService.prototype._removeDummyNode = function (aFolderURI, aDataSrc)
{
  var ds = aDataSrc || this._dataSrc;

  var ctr = this._getSeqContainerFromFolder(aFolderURI, ds);
  var childrenEnum = ctr.GetElements();

  while (childrenEnum.hasMoreElements()) {
    let child = childrenEnum.getNext();
    child = child.QueryInterface(Components.interfaces.nsIRDFResource);
    let childURI = child.Value;
    if (this._isDummyNode(childURI, ds)) {

      // Unassert all assertions on this node, then remove it from its parent
      // container; this ensures the node is removed from the datasource.
      let predsEnum = ds.ArcLabelsOut(child);
      while (predsEnum.hasMoreElements()) {
	let pred = predsEnum.getNext();
	pred = pred.QueryInterface(Components.interfaces.nsIRDFResource);
	let targ = ds.GetTarget(child, pred, true);
	ds.Unassert(child, pred, targ);
      }

      ctr.RemoveElement(child, false);
    }
  }
};


nsClippingsService.prototype.setEmptyClippingString = function (aString)
{
  this._emptyClippingStr = aString;
};


nsClippingsService.prototype.getCount = function (aFolderURI)
{
  if (! this._dataSrc) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  if (!this.isFolder(aFolderURI) && aFolderURI != this.kRootFolderURI) {
    throw Components.Exception("nsClippingsService.getCount(): URI argument is not a folder resource", Components.results.NS_ERROR_INVALID_ARG);
  }

  let ctr = this._getSeqContainerFromFolder(aFolderURI);
  let e, i;

  // Running time is O(n) - we need to do better than this!
  for (e = ctr.GetElements(), i = 0; e.hasMoreElements(); e.getNext(), ++i);

  return i;
};


nsClippingsService.prototype.getCountSubfolders = function (aFolderURI, aDataSrc)
{
  var ds = aDataSrc || this._dataSrc;
  if (! ds) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  if (!this.isFolder(aFolderURI, ds) && aFolderURI != this.kRootFolderURI) {
    throw Components.Exception("nsClippingsService.getCountSubfolders(): URI argument is not a folder resource", Components.results.NS_ERROR_INVALID_ARG);
  }

  var rv;
  var container = this._getSeqContainerFromFolder(aFolderURI, ds);
  var childrenEnum = container.GetElements();
  var numSubfolders = 0;

  while (childrenEnum.hasMoreElements()) {
    let child = childrenEnum.getNext();
    child = child.QueryInterface(Components.interfaces.nsIRDFResource);
    let childURI = child.Value;
    if (this.isFolder(childURI, ds)) {
      numSubfolders++;
    }
  }

  rv = numSubfolders;
  return rv;
};


nsClippingsService.prototype.recountAll = function ()
{
  if (! this._dataSrc) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  var rv = 0;
  rv = this._count = this._countRec(this._rdfContainer);

  return rv;
};


nsClippingsService.prototype._countRec = function (aFolderCtr)
{
  var count = 0;
  var childrenEnum = aFolderCtr.GetElements();

  while (childrenEnum.hasMoreElements()) {
    let child = childrenEnum.getNext();
    child = child.QueryInterface(Components.interfaces.nsIRDFResource);
    let childURI = child.Value;
    if (this.isFolder(childURI)) {
      let subfolderCtr = this._getSeqContainerFromFolder(childURI);
      count += this._countRec(subfolderCtr);
    }
    if (! this.isEmptyClipping(childURI)) {
      count++;
    }
  }

  return count;
};


nsClippingsService.prototype.findByName = function (aSearchText, aMatchCase, aSearchFolders, aCount)
{
  if (! this._dataSrc) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  var reFlags = aMatchCase ? "" : "i";
  var regExp = new RegExp(aSearchText, reFlags);
  var rv = [];
  rv = this._findRec(regExp, this._rdfContainer, aSearchFolders);
  aCount.value = rv.length;

  return rv;
};


nsClippingsService.prototype._findRec = function (aRegExp, aFolderCtr, aSearchFolders)
{
  var srchResults = [];
  var childrenEnum = aFolderCtr.GetElements();

  while (childrenEnum.hasMoreElements()) {
    let child = childrenEnum.getNext();
    child = child.QueryInterface(Components.interfaces.nsIRDFResource);
    let childURI = child.Value;
    if (this.isFolder(childURI)) {
      if (aSearchFolders) {
        let folderName = this.getName(childURI);
        if (folderName.search(aRegExp) != -1) {
          srchResults.push(childURI);
        }
      }
      
      let subfolderCtr = this._getSeqContainerFromFolder(childURI);
      let subfolderSrchResults = this._findRec(aRegExp, subfolderCtr, aSearchFolders);
      srchResults = srchResults.concat(subfolderSrchResults);
    }
    if (this.isClipping(childURI)) {
      let clippingName = this.getName(childURI);
      if (clippingName.search(aRegExp) != -1) {
        srchResults.push(childURI);
      }
    }
  }

  return srchResults;
};


nsClippingsService.prototype.getParent = function (aURI)
{
  if (! this._dataSrc) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  if (aURI == this.kRootFolderURI) {
    return "";
  }

  var rv;
  var subject, predicate;
  var target = this._rdfSvc.GetResource(aURI);
  var predsEnum = this._dataSrc.ArcLabelsIn(target);
  while (predsEnum.hasMoreElements()) {
    let pred = predsEnum.getNext();
    pred = pred.QueryInterface(Components.interfaces.nsIRDFResource);
    predicate = pred;
    break;
  }

  if (! predicate) {
    let name = this.getName(aURI);
    throw Components.Exception("nsClippingsService.getParent(): Failed to get predicate of resource\nURI: \"" + aURI + "\"; name: \"" + name + "\"");
  }

  subject = this._dataSrc.GetSource(predicate, target, true);
  if (subject instanceof Components.interfaces.nsIRDFResource) {
    rv = subject.Value;
  }
  return rv;
};


nsClippingsService.prototype.isFolder = function (aURI, aDataSrc)
  // aDataSrc param for internal use only.  Not exposed in interface.
{
  var ds = aDataSrc || this._dataSrc;
  if (! ds) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  var rv = false;
  var subjType = this._rdfSvc.GetResource(aURI);
  var predType = this._rdfSvc.GetResource(this._PREDTYPE_RESOURCE_URI);
  var targType = ds.GetTarget(subjType, predType, true);
  if (targType instanceof Components.interfaces.nsIRDFResource) {
    rv = (targType.Value == this._RDFTYPE_FOLDER_RESOURCE_URI);
  }
  return rv;
};


nsClippingsService.prototype.isClipping = function (aURI, aDataSrc)
  // aDataSrc param for internal use only.  Not exposed in interface.
{
  var ds = aDataSrc || this._dataSrc;
  if (! ds) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  var rv = false;
  var subjType = this._rdfSvc.GetResource(aURI);
  var predType = this._rdfSvc.GetResource(this._PREDTYPE_RESOURCE_URI);
  var targType = ds.GetTarget(subjType, predType, true);
  if (targType instanceof Components.interfaces.nsIRDFResource) {
    rv = (targType.Value == this._RDFTYPE_CLIPPING_RESOURCE_URI);
  }
  return rv;
};


nsClippingsService.prototype.isEmptyClipping = function (aURI)
{
  return this._isDummyNode(aURI);
};


nsClippingsService.prototype._isDummyNode = function (aURI, aDataSrc)
{
  var ds = aDataSrc || this._dataSrc;
  if (! ds) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  var rv = false;
  var subjType = this._rdfSvc.GetResource(aURI);
  var predType = this._rdfSvc.GetResource(this._PREDTYPE_RESOURCE_URI);
  var targType = ds.GetTarget(subjType, predType, true);
  if (targType instanceof Components.interfaces.nsIRDFResource) {
    rv = (targType.Value == this._RDFTYPE_NULL_RESOURCE_URI);
  }
  return rv;
};


// aDataSrc parameter used internally - not exposed in interface
nsClippingsService.prototype.getShortcutKey = function (aURI, aDataSrc)
{
  var ds = aDataSrc || this._dataSrc;
  if (! ds) {
    throw Components.Exception("nsClippingsService.getShortcutKey(): Data source not initialized", Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  if (!aDataSrc && !this.exists(aURI)) {
    throw Components.Exception("nsClippingsService.getShortcutKey(): URI argument doesn't exist", Components.results.NS_ERROR_INVALID_ARG);
  }

  if (! this.isClipping(aURI, ds)) {
    throw Components.Exception("nsClippingsService.getShortcutKey(): URI argument is not a clipping resource", Components.results.NS_ERROR_INVALID_ARG);
  }

  var rv = "";
  var subjKey = this._rdfSvc.GetResource(aURI);
  var predKey = this._rdfSvc.GetResource(this._PREDKEY_RESOURCE_URI);
  var targKey = ds.GetTarget(subjKey, predKey, true);

  if (targKey instanceof Components.interfaces.nsIRDFLiteral) {
    rv = targKey.Value;
  }

  return rv;
};


// aDataSrc parameter used internally - not exposed in interface
nsClippingsService.prototype.setShortcutKey = function (aURI, aKey, aDataSrc)
{
  var ds = aDataSrc || this._dataSrc;
  if (! ds) {
    throw Components.Exception("nsClippingsService.setShortcutKey(): Data source not initialized", Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  if (!aDataSrc && !this.exists(aURI, ds)) {
    throw Components.Exception("nsClippingsService.setShortcutKey(): URI argument doesn't exist", Components.results.NS_ERROR_INVALID_ARG);
  }

  if (! this.isClipping(aURI, ds)) {
    throw Components.Exception("nsClippingsService.setShortcutKey(): URI argument is not a clipping resource",  Components.results.NS_ERROR_INVALID_ARG);
  }

  var key = this._sanitize(aKey);

  // Check if this key has already been defined for another clipping.
  if (! aDataSrc) {
    let keyMap = this._createShortcutKeyMap(this._rdfContainer);
    if (keyMap[key]) {
      throw Components.Exception("nsClippingsService.setShortcutKey(): Key already defined: `" + key + "'", Components.results.NS_ERROR_FAILURE);
    }
  }

  var subjKey = this._rdfSvc.GetResource(aURI);
  var predKey = this._rdfSvc.GetResource(this._PREDKEY_RESOURCE_URI);
  var targOldKey = ds.GetTarget(subjKey, predKey, true);
  var targNewKey = this._rdfSvc.GetLiteral(key);

  if (! targOldKey) {
    // No shortcut key was assigned
    ds.Assert(subjKey, predKey, targNewKey, true);
  }
  else {
    // Shortcut key already assigned - we want to change it
    // Empty/null aKey parameter removes the key assignment from the clipping
    if (! key) {
      ds.Unassert(subjKey, predKey, targOldKey);
    }
    else {
      ds.Change(subjKey, predKey, targOldKey, targNewKey);
    }
  }
};


nsClippingsService.prototype.getShortcutKeyDict = function ()
{
  // Returns a nsIDictionary object which maps shortcut keys to the URIs
  // of clippings having that shortcut key assigned.

  if (! this._dataSrc) {
    throw Components.Exception("nsClippingsService.getShortcutKeyDict(): Data source not initialized", Components.results.NS_ERROR_NOT_INITIALIZED);
  }
  
  var keyMap = {};
  keyMap = this._createShortcutKeyMap(this._rdfContainer);

  var rv = Components.classes["clippings@mozdev.org/dictionary;1"]
                     .createInstance(Components.interfaces.nsIDictionary);

  for (let key in keyMap) {
    let valueStr = Components.classes["@mozilla.org/supports-string;1"]
                             .createInstance(Components.interfaces
                                                       .nsISupportsString);
    valueStr.data = keyMap[key];
    rv.setValue(key, valueStr);
  }

  return rv;
};


nsClippingsService.prototype._createShortcutKeyMap = function (aFolderCtr)
{
  var rv = {};
  var childrenEnum = aFolderCtr.GetElements();

  while (childrenEnum.hasMoreElements()) {
    let child = childrenEnum.getNext();
    child = child.QueryInterface(Components.interfaces.nsIRDFResource);
    let childURI = child.Value;

    if (this.isClipping(childURI)) {
      let key = this.getShortcutKey(childURI);
      if (key) {
	rv[key] = childURI;
      }
    }
    else if (this.isFolder(childURI)) {
      let folderCtr = this._getSeqContainerFromFolder(childURI);
      rv = this._combineJSMap(rv, this._createShortcutKeyMap(folderCtr));
    }
  }

  return rv;
};


nsClippingsService.prototype._combineJSMap = function (a, b)
{
  // Paremeters a and b are JavaScript objects
  var rv = {};
  for (let i in a) {
    rv[i] = a[i];
  }

  for (let j in b) {
    rv[j] = b[j];
  }

  return rv;
};


nsClippingsService.prototype.copyTo = function (aURI, aDestFolder, aDestItemURI, aDestPos, aRemoveOriginal, aOrigin)
{
  if (! this._dataSrc) {
    throw Components.Exception("nsClippingsService.copyTo(): Data source not initialized", Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  // Allow copying items to the same folder to create copies of items.
  // But disallow moving items into the same folder.
  try {
    var parentFolderURI = this.getParent(aURI);
  }
  catch (e) {
    throw Components.Exception("nsClippingsService.copyTo(): Unable to retrieve parent folder URI of item to move or copy!\n" + e);
  }

  if (parentFolderURI == aDestFolder && aRemoveOriginal) {
    throw Components.Exception("Source and destination folders are the same!");
  }

  var rv;
  var isFolderMovedOrCopied;
  var name = this.getName(aURI);

  if (this.isClipping(aURI)) {
    var text = this.getText(aURI);
    rv = this.createNewClippingEx(aDestFolder, aDestItemURI, name, text, aDestPos, true);

    // A clipping that is moved should preserve its shortcut key, if defined.
    var key;
    if (aRemoveOriginal && (key = this.getShortcutKey(aURI))) {
      try {
	this.setShortcutKey(aURI, "");
	this.setShortcutKey(rv, key);
      } 
      catch (e) {
	this._log("nsClippingsService.copyTo(): Unable to set shortcut key:\n" + e);
      }
    }
  }
  else if (this.isFolder(aURI)) {
    if (aURI == aDestFolder && aRemoveOriginal) {
      throw Components.Exception("nsClippingsService.copyTo(): Cannot move a folder into itself!");
    }

    isFolderMovedOrCopied = true;

    // HACK!!  Must notify host app window of the new folder creation so that
    // it can rebuild the Clippings submenu.
    var copiedFolderURI;
    copiedFolderURI = this.createNewFolderEx(aDestFolder, aDestItemURI, name, aDestPos, false, aOrigin);
    var folderCtr = this._getSeqContainerFromFolder(aURI);
    var childrenEnum = folderCtr.GetElements();

    while (childrenEnum.hasMoreElements()) {
      let child = childrenEnum.getNext();
      child = child.QueryInterface(Components.interfaces.nsIRDFResource);
      let childURI = child.Value;
      if (childURI != copiedFolderURI) {  // Avoid unwanted infinite recursion.
	this.copyTo(childURI, copiedFolderURI, null, null, false);
      }
    }
    rv = copiedFolderURI;

  }

  if (aRemoveOriginal) {
    this.remove(aURI, false, true);
    if (this.getCount(parentFolderURI) == 0) {
      this._appendDummyNode(parentFolderURI);
    }
  }

  return rv;
};


nsClippingsService.prototype.removeAll = function ()
{
  var childrenEnum = this._rdfContainer.GetElements();

  while (childrenEnum.hasMoreElements()) {
    let child = childrenEnum.getNext();
    child = child.QueryInterface(Components.interfaces.nsIRDFResource);
    let childURI = child.Value;
    this.remove(childURI, true, true);
  }

  this.purgeDetachedItems();
  this._appendDummyNode(this._SEQNODE_RESOURCE_URI);
  this.recountAll();

  this._log("nsClippingsService.removeAll(): Finished removing all clippings and folders. There are now " + this._count + " items.");
};


// aDontUpdateCount and aPurgeFlag params for internal use only - 
// not exposed in interface.
nsClippingsService.prototype.remove = function (aURI, aDontUpdateCount, aPurgeFlag)
{
  var subjectNode = this._rdfSvc.GetResource(aURI);
  var name = this.getName(aURI) || "(no name)";
  var isFolderBeingDeleted = false;
  var parentFolderURI = this.getParent(aURI);

  if (this.isClipping(aURI)) {
    this._log("Removing clipping: \"" + name + "\"");
  }
  else if (this.isFolder(aURI)) {
    isFolderBeingDeleted = true;
    this._log("Removing folder: \"" + name + "\"");

    if (this.getCount(aURI) > 0) {
      var folderCtr = this._getSeqContainerFromFolder(aURI);
      var childrenEnum = folderCtr.GetElements();

      while (childrenEnum.hasMoreElements()) {
	let child = childrenEnum.getNext();
	child = child.QueryInterface(Components.interfaces.nsIRDFResource);
	let childURI = child.Value;
	this.remove(childURI, aDontUpdateCount, aPurgeFlag);
      }
    }
  }

  var predsEnum = this._dataSrc.ArcLabelsOut(subjectNode);
  while (predsEnum.hasMoreElements()) {
    let pred = predsEnum.getNext();
    pred = pred.QueryInterface(Components.interfaces.nsIRDFResource);
    let targ = this._dataSrc.GetTarget(subjectNode, pred, true);
    this._dataSrc.Unassert(subjectNode, pred, targ);
  }

  // Do not renumber child elements; otherwise removing a folder will leave
  // behind one child.
  var parentCtr = this._getSeqContainerFromFolder(parentFolderURI);
  parentCtr.RemoveElement(subjectNode, false);
  this._log("Item \"" + name + "\" has been removed.");

  if (isFolderBeingDeleted) {
    var numSubfolders = this.getCountSubfolders(parentFolderURI);
    if (numSubfolders == 0) {
      this._setHasSubfoldersTriple(parentFolderURI, false);
    }
  }

  var numItemsInFolder = this.getCount(parentFolderURI);
  if (!aPurgeFlag && numItemsInFolder == 0) {
    this._appendDummyNode(parentFolderURI);
  }

  if (! aDontUpdateCount) {
    this._count = this._countRec(this._rdfContainer);
  }
};


nsClippingsService.prototype._setHasSubfoldersTriple = function (aFolderURI, aBoolFlag, aDataSrc)
{
  var ds = aDataSrc || this._dataSrc;

  // Do not do this for the Clippings root folder!
  if (aFolderURI == this.kRootFolderURI) {
    return;
  }

  var folderNode = this._rdfSvc.GetResource(aFolderURI);
  var predHasSubf = this._rdfSvc.GetResource(this._PREDHASSUBFOLDERS_RESOURCE_URI);
  var targNewVal = this._rdfSvc.GetLiteral(aBoolFlag.toString());
  var targOldVal = ds.GetTarget(folderNode, predHasSubf, true);
  ds.Change(folderNode, predHasSubf, targOldVal, targNewVal, true);
};


// Returns the 1-based index of the item being detached.
nsClippingsService.prototype.detachFromFolder = function (aFolderURI)
{
  if (! this.isFolder(aFolderURI)) {
    throw Components.Exception("nsClippingsService.detachFromFolder(): URI argument is not a folder resource", Components.results.NS_ERROR_INVALID_ARG);
  }

  var rv;
  var parentFolderURI = this.getParent(aFolderURI);
  var parentCtr = this._getSeqContainerFromFolder(parentFolderURI);
  var node = this._rdfSvc.GetResource(aFolderURI);
  node = node.QueryInterface(Components.interfaces.nsIRDFResource);

  rv = parentCtr.IndexOf(node);
  parentCtr.RemoveElement(node, true);

  this._detachedItems.push(aFolderURI);

  if (this.getCountSubfolders(parentFolderURI) == 0) {
    this._setHasSubfoldersTriple(parentFolderURI, false);
  }

  var numItemsInFolder = this.getCount(parentFolderURI);
  if (numItemsInFolder == 0) {
    this._appendDummyNode(parentFolderURI);
  }

  this._count = this._countRec(this._rdfContainer);

  return rv;
};


nsClippingsService.prototype.reattachToFolder = function (aParentFolder, aURI, aPos)
{
  // NOTE: aPos is a 1-based (not zero-based) index.
  var prevSubfCount = this.getCountSubfolders(aParentFolder);
  var parentCtr = this._getSeqContainerFromFolder(aParentFolder);
  var node = this._rdfSvc.GetResource(aURI);
  node = node.QueryInterface(Components.interfaces.nsIRDFResource);

  if (aPos) {
    try {
      parentCtr.InsertElementAt(node, aPos, true);
    }
    catch (e) {
      throw Components.Exception("**ERROR: aNode=" + node + "; aPos=" + aPos + "\n" + e);
    }
  }
  else {
    parentCtr.AppendElement(node);
  }

  this._removeDummyNode(aParentFolder);
  
  if (this.isFolder(aURI) && prevSubfCount == 0) {
    this._setHasSubfoldersTriple(aParentFolder, true);
  }

  for (let i = 0; i < this._detachedItems.length; i++) {
    if (this._detachedItems[i] == aURI) {
      delete this._detachedItems[i];
    }
  }

  this._count = this._countRec(this._rdfContainer);
};


nsClippingsService.prototype.purgeDetachedItems = function ()
{
  var node, uri;
  var len = this._detachedItems.length;
  var cnt = len;

  this._log("About to purge detached items; total " + this._detachedItems.length + " detached item(s)");

  for (let i = 0; i < len; i++) {
    uri = this._detachedItems[i];
    if (! uri) {
      continue;
    }

    node = this._rdfSvc.GetResource(uri);
    node = node.QueryInterface(Components.interfaces.nsIRDFResource);

    // Add the detached node to the root RDF container, and then delete the
    // node. This is the only known way to permanently remove the detached node
    // from the data source.
    this._rdfContainer.AppendElement(node);
    this.remove(uri, true, true);
    cnt--;
  }

  this._log("Purge completed; there are now " + cnt + " detached item(s)\n(count should be zero)");

  this._detachedItems = [];
};


nsClippingsService.prototype.isDetached = function (aURI)
{
  var rv = false;
  var i = 0;

  while (!rv && i < this._detachedItems.length) {
    if (this._detachedItems[i] && this._detachedItems[i] == aURI) {
      rv = true;
    }
    i++;
  }

  return rv;
};


nsClippingsService.prototype.exists = function (aURI)
{
  if (aURI == this.kRootFolderURI) {
    return true;
  }

  var rv = false;
  var node;

  try {
    node = this._rdfSvc.GetResource(aURI);
  }
  catch (e) {}

  if (! node) {
    return rv;
  }

  var parentFolderURI, parentCtr;

  try {
    parentFolderURI = this.getParent(aURI);
  }
  catch (e) {}

  if (! parentFolderURI) {
    return rv;
  }

  parentCtr = this._getSeqContainerFromFolder(parentFolderURI);

  if (parentCtr.IndexOf(node) != -1) {
    rv = true;
  }
  
  return rv;
};


nsClippingsService.prototype.indexOf = function (aURI)
{
  if (! this.exists(aURI)) {
    return -1;
  }

  var rv;
  var node = this._rdfSvc.GetResource(aURI);
  var parentFolderURI = this.getParent(aURI);
  var parentCtr = this._getSeqContainerFromFolder(parentFolderURI);
  var childrenEnum = parentCtr.GetElements();
  var i = 1;

  while (childrenEnum.hasMoreElements()) {
    if (childrenEnum.getNext().Value == aURI) {
      rv = i;
      break;
    }
    i++;
  }

  return rv;
};


nsClippingsService.prototype.ctrIndexOf = function (aURI)
{
  var rv;
  var node = this._rdfSvc.GetResource(aURI);
  var parentFolderURI = this.getParent(aURI);
  var parentCtr = this._getSeqContainerFromFolder(parentFolderURI);

  rv = parentCtr.IndexOf(node);  // Will return -1 if node doesn't exist.
  return rv;
};


nsClippingsService.prototype.getName = function (aURI, aDataSrc)
  // aDataSrc param for internal use only.  Not exposed in interface.
{
  var ds = aDataSrc || this._dataSrc;
  if (! ds) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  var rv;

  // Root folder
  if (aURI == this.kRootFolderURI) {
    rv = "[clippings-root]";
  }
  else {
    var subjName = this._rdfSvc.GetResource(aURI);
    var predName = this._rdfSvc.GetResource(this._PREDNAME_RESOURCE_URI);
    var targName = ds.GetTarget(subjName, predName, true);
    if (targName instanceof Components.interfaces.nsIRDFLiteral) {
      rv = targName.Value;
    }
  }
  return rv;
};


nsClippingsService.prototype.getText = function (aURI, aDataSrc)
  // aDataSrc param for internal use only.  Not exposed in interface.
{
  var ds = aDataSrc || this._dataSrc;
  if (! ds) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  var rv;
  var subjText = this._rdfSvc.GetResource(aURI);
  var predText = this._rdfSvc.GetResource(this._PREDTEXT_RESOURCE_URI);
  var targText = ds.GetTarget(subjText, predText, true);
  if (targText instanceof Components.interfaces.nsIRDFLiteral) {
    rv = targText.Value;
  }
  return rv;
};


nsClippingsService.prototype.setName = function (aURI, aName)
{
  var name = this._sanitize(aName);
  var subjName = this._rdfSvc.GetResource(aURI);
  var predName = this._rdfSvc.GetResource(this._PREDNAME_RESOURCE_URI);
  var targOldName = this._dataSrc.GetTarget(subjName, predName, true);
  var targNewName = this._rdfSvc.GetLiteral(name);
  this._dataSrc.Change(subjName, predName, targOldName, targNewName);
};


nsClippingsService.prototype.setText = function (aURI, aText)
{
  var text = this._sanitize(aText);
  var subjText = this._rdfSvc.GetResource(aURI);
  var predText = this._rdfSvc.GetResource(this._PREDTEXT_RESOURCE_URI);
  var targOldText;
  targOldText = this._dataSrc.GetTarget(subjText, predText, true);
  var targNewText = this._rdfSvc.GetLiteral(text);
  this._dataSrc.Change(subjText, predText, targOldText, targNewText); 
};


nsClippingsService.prototype.changePosition = function (aParentFolder, aOldPos, aNewPos)
{
  var parentCtr;
  if (aParentFolder == this.kRootFolderURI) {
    parentCtr = this._rdfContainer;
  }
  else {
    parentCtr = this._getSeqContainerFromFolder(aParentFolder);
  }

  var node = parentCtr.RemoveElementAt(aOldPos, true);
  this._log("nsClippingsService.changePosition(): node=" + node + "; aOldPos=" + aOldPos + "; aNewPos=" + aNewPos);
  parentCtr.InsertElementAt(node, aNewPos, true);
};


nsClippingsService.prototype.flushDataSrc = function ()
{
  this.flushDataSrcEx(true);
};


nsClippingsService.prototype.flushDataSrcEx = function (aDoBackup)
{
  if (! this._dataSrc) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }
  
  try {
    this._dataSrc.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();
  }
  catch (e) {
    this._log("nsClippingsService.flushDataSrc(): Data source flush failed!\n" + e);
    throw e;
  }
  this._log("*** Clippings datasource saved to disk ***");

  if (aDoBackup && this._maxBackupFiles > 0) {
    try {
      this._doBackup();
    }
    catch (e) {
      this._log("nsClippingsService.flushDataSrc(): WARNING: Backup failed:\n" + e);
    }
  }
   
  try {
    this._deleteOldBackupFiles();
  }
  catch (e) {
    this._log("nsClippingsService.flushDataSrc(): WARNING: Cannot delete old backup file(s):\n" + e);
  }
};


nsClippingsService.prototype.refreshDataSrc = function ()
{
  if (! this._dataSrc) {
    throw Components.Exception("Data source not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }
  
  try {
    this._dataSrc.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Refresh(true);
  }
  catch (e) {
    this._log("nsClippingsService.refreshDataSrc(): Data source refresh failed!\n" + e);
    throw e;
  }

  var newCount = this.recountAll();
  this._log("Data source refreshed!  There are now " + newCount + " items.");
};



nsClippingsService.prototype._doBackup = function ()
{
  var dir = this._getFileFromURL(this._backupDirURL);
  try {
    dir = dir.QueryInterface(Components.interfaces.nsIFile);
  }
  catch (e) {
    throw Components.Exception("nsClippingsService._doBackup(): Failed to get nsIFile object for backup dir:\n" + e);
  }

  if (!dir.exists() || !dir.isDirectory()) {
    this._log("nsClippingsService._doBackup(): Creating backup directory\n'" 
	      + this._backupDirURL + "'");
    dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
  }

  var dateTime = this._getDateTimeString();
  var fileURL = this._backupDirURL + "/" + this._BACKUP_FILE_PREFIX + dateTime 
                                   + this._BACKUP_FILE_EXTENSION;
  this._log("Writing backup file:\n'" + fileURL + "'");
  var rds = this._dataSrc.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
  try {
    rds.FlushTo(fileURL);
  }
  catch (e) {
    throw e;
  }
};


nsClippingsService.prototype._deleteOldBackupFiles = function ()
{
  try {
    var backupFiles = this._getBackupFiles();
  }
  catch (e) {
    this._log(e);
    throw e;
  }

  this._log("nsClippingsService._deleteOldBackupFiles(): Number of backup files: " + backupFiles.length);

  while (backupFiles.length > this._maxBackupFiles) {
    var file = backupFiles.shift();  // backupFiles[] ordered oldest -> newest
    try {
      file = file.QueryInterface(Components.interfaces.nsIFile);
    }
    catch (e) {
      throw Components.Exception("nsClippingsService._deleteOldBackupFiles(): Failed to get nsIFile object for backup file to remove:\n" + e);
    }

    this._log("nsClippingsService._deleteOldBackupFiles(): Deleting old backup file: " + file.leafName);
    try {
      file.remove(false);
    }
    catch (e) { 
      throw e;
    }
  }
};


nsClippingsService.prototype._getBackupFiles = function ()
{
  var dir = this._getFileFromURL(this._backupDirURL);
  try {
    dir = dir.QueryInterface(Components.interfaces.nsIFile);
  }
  catch (e) {
    throw Components.Exception("nsClippingsService._getBackupFiles(): Failed to get nsIFile object for backup dir:\n" + e);
  }

  var files = [];

  // The situation where the backup directory doesn't exist should be treated
  // the same as if no backup files were found, since this situation would
  // only occur if backups haven't been created yet.
  if (!dir.exists() || !dir.isDirectory()) {
    return files;
  }

  let dirEntriesEnum = dir.directoryEntries;
  while (dirEntriesEnum.hasMoreElements()) {
    let file = dirEntriesEnum.getNext();
    try {
      file = file.QueryInterface(Components.interfaces.nsIFile);
    }
    catch (e) {
      throw Components.Exception("nsClippingsService._getBackupFiles(): Failed to get nsIFile object for backup file being enumerated:\n" + e, Components.results.NS_ERROR_UNEXPECTED);
    }
    files.push(file);
  }

  // Sort files[] array, ordered by file names.
  files.sort(function (file1, file2) {
               if (file1.leafName < file2.leafName) return -1;
               if (file1.leafName > file2.leafName) return 1;
               return 0;
             });
  return files;
};  


nsClippingsService.prototype.getBackupFileNamesDict = function ()
{
  try {
    var backupFiles = this._getBackupFiles();
  }
  catch (e) {
    this._log(e);
    throw e;
  }

  var rv = Components.classes["clippings@mozdev.org/dictionary;1"]
                     .createInstance(Components.interfaces.nsIDictionary);

  for (let i = 0; i < backupFiles.length; i++) {
    let filename = backupFiles[i].leafName;
    let friendlyDateTime = this._parseBackupFilename(filename);
    let valueStr = Components.classes["@mozilla.org/supports-string;1"]
                             .createInstance(Components.interfaces
                                                       .nsISupportsString);
    valueStr.data = friendlyDateTime;
    rv.setValue(filename, valueStr);
  }

  return rv;
};


nsClippingsService.prototype._parseBackupFilename = function (aFilename)
{
  var rv;
  var processedFilename = aFilename.replace(/\.rdf$/, "");
  processedFilename = processedFilename.replace(/^clippings_/, "");
  
  var dateTimeSrch = processedFilename.match(/(\d{4}\-\d{2}\-\d{2})_(\d{6})/);
  var date = dateTimeSrch[1];
  var time = dateTimeSrch[2];

  // Note that numeric months are zero-based (0=Jan, 1=Feb, 2=Mar, ...)
  var dateTime = new Date(date.substr(0,4), (date.substr(5,2)-1), date.substr(8,2), time.substr(0,2), time.substr(2,2), time.substr(4,2));
  rv = dateTime.toLocaleString();

  return rv;
};


nsClippingsService.prototype.recoverFromBackup = function ()
{
  try {
    var backupFiles = this._getBackupFiles();
  }
  catch (e) {
    this._log(e);
    throw Components.Exception("nsClippingsService.recoverFromBackup(): Failed to enumerate backup files:\n" + e, Components.results.NS_ERROR_UNEXPECTED);
  }

  if (!backupFiles || backupFiles.length == 0) {
    throw Components.Exception("nsClippingsService.recoverFromBackup(): No backup files found!", Components.results.NS_ERROR_FILE_NOT_FOUND);
  }

  var extSeqNode = this._rdfSvc.GetResource(this._SEQNODE_RESOURCE_URI);
  var found = false;
  var url;

  while (!found && backupFiles.length > 0) {
    let file = backupFiles.pop();
    try {
      file = file.QueryInterface(Components.interfaces.nsIFile);
    }
    catch (e) {
      throw Components.Exception("nsClippingsService.recoverFromBackup(): Failed to retrieve nsIFile object", Components.results.NS_ERROR_UNEXPECTED);
    }

    try {
      url = this._getURLFromFile(file);
    }
    catch (e) {
      throw Components.Exception("nsClippingsService.recoverFromBackup(): Failed to retrieve URL of nsIFile object", Components.results.NS_ERROR_UNEXPECTED);
    }

    this._log("nsClippingsService.recoverFromBackup(): Trying backup file whose file name is '" + file.leafName + "' and whose URL is:\n'" + url + "'");

    var extRDFContainer = Components.classes["@mozilla.org/rdf/container;1"].createInstance(Components.interfaces.nsIRDFContainer);

    try {
      var extDataSrc = this._rdfSvc.GetDataSourceBlocking(url);
      extRDFContainer.Init(extDataSrc, extSeqNode);
    }
    catch (e) {
      // File not readable - either it is corrupted, or it isn't a valid
      // Clippings backup file.
      this._log(e);
      continue;
    }

    if (this._rdfContainerUtils.IsSeq(extDataSrc, extSeqNode)) {
      found = true;
    }
  }

  if (! found) {
    throw Components.Exception("nsClippingsService.recoverFromBackup(): Cannot find any valid backup files!", Components.results.NS_ERROR_FILE_NOT_FOUND);
  }
  
  this._log("nsClippingsService.recoverFromBackup(): Found a candidate backup file whose URL is:\n'" + url + "'\nContains " + extRDFContainer.GetCount() + " entries");

  // Delete corrupted data source file
  this._log("nsClippingsService.recoverFromBackup(): Deleting corrupted datasource file");

  try {
    this.killDataSrc();
  }
  catch (e) {
    throw Components.Exception("nsClippingsService.recoverFromBackup(): Cannot delete damaged data source file", Components.results.NS_ERROR_UNEXPECTED);
  }

  this._log("nsClippingsService.recoverFromBackup(): Invoking nsClippingsService.getDataSource() to generate a new, empty RDF datasource file");

  this._count = -1;  // Reset internal counter.
  var newDataSrc = this.getDataSource(this._dsFileURL, true);

  try {
    newDataSrc = newDataSrc.QueryInterface(Components.interfaces.nsIRDFDataSource);
  }
  catch (e) {
    throw Components.Exception("nsClippingsService.recoverFromBackup(): Failed to regenerate RDF datasource!\n" + e, Components.results.NS_ERROR_UNEXPECTED);
  }

  this._log("nsClippingsService.recoverFromBackup(): Invoking nsClippingsService.importFromFile()");

  var count = this.importFromFile(url, false, true, {});

  this._log("nsClippingsService.recoverFromBackup(): " + count + " entries imported\nnewDataSrc: " + newDataSrc);

  return newDataSrc;
};


nsClippingsService.prototype.notifyDataSrcLocationChanged = function ()
{
  if (!this._dataSrc || !this._dsFileURL) {
    throw Components.Exception("Datasource not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  for (let i = 0; i < this._listeners.length; i++) {
    if (this._listeners[i]) {
      this._log("nsClippingsService.notifyDataSrcLocationChange(): Notifying observer " + i + "\nOrigin: " + this._listeners[i].origin + " (1 = Clippings Manager; 2 = host app window; 3 = New Clipping dialog)");
      this._listeners[i].dataSrcLocationChanged(this._dsFileURL);
    }
  }
};


nsClippingsService.prototype.killDataSrc = function ()
{
  this._log("nsClippingsService.killDataSrc(): URL of data source:\n"
	    + "'" + this._dsFileURL + "'");
  if (! this._dsFileURL) {
    throw Components.Exception("dsFileURL not initialized",
			       Components.results.NS_ERROR_NOT_INITIALIZED);
  }

  var oldDSFile = this._getFileFromURL(this._dsFileURL);
  try {
    oldDSFile = oldDSFile.QueryInterface(Components.interfaces.nsIFile);
  }
  catch (e) {
    throw Components.Exception("nsClippingsService.killDataSrc(): Failed to get nsIFile object for datasource file!\n" + e, NS_ERROR_UNEXPECTED);
  }

  if (!oldDSFile.exists() || !oldDSFile.isFile()) {
    throw Components.Exception("nsClippingsService.killDataSrc(): File doesn't exist!", Components.results.NS_ERROR_FILE_NOT_FOUND);
  }

  this._log("nsClippingsService.killDataSrc(): removing file:\n"
	    + "'" + this._dsFileURL + "'");

  try {
    oldDSFile.remove(false);
  }
  catch (e) {
    var msg = "nsClippingsService.killDataSrc(): Failed to delete corrupted datasource file!\n" + e;
    this._log(msg);
    throw Components.Exception(msg);
  }
};


nsClippingsService.prototype.exportToFile = function (aFileURL, aFileType)
{
  // We have to do it this way because we don't want to include unpurged
  // detached folders with the exported file.
  var extSeqNode;
  var extDS;

  if (aFileType == this.FILETYPE_RDF_XML) {
    extSeqNode = this._rdfSvc.GetResource(this._SEQNODE_RESOURCE_URI);
  }
  else if (aFileType == this.FILETYPE_CLIPPINGS_1X) {
    extSeqNode = this._rdfSvc.GetResource(this._OLD_SEQNODE_RESOURCE_URI);
  }
  else {
    throw Components.Exception("File type not supported",
			       Components.result.NS_ERROR_INVALID_ARG);
  }

  // Must delete existing file with the same name; otherwise, the `FlushTo'
  // call below will append instead of overwrite.
  var file = this._getFileFromURL(aFileURL);
  if (file.exists()) {
    this._log("NOTE: A data source file with the same URL already exists; removing it.");
    file.remove(false);
  }

  try {
    // Exported data source file will be created automatically.
    extDS = this._rdfSvc.GetDataSourceBlocking(aFileURL);
  }
  catch (e) {
    throw e;
  }

  this._log("Initialized export data source; URL:\n'" + aFileURL + "'");

  var count, format;
  var extRootCtr = this._rdfContainerUtils.MakeSeq(extDS, extSeqNode);
  extRootCtr = extRootCtr.QueryInterface(Components.interfaces.nsIRDFContainer);
  
  if (aFileType == this.FILETYPE_CLIPPINGS_1X) {
    count = this._exportLegacyRDFXML(this._rdfContainer, extDS, extRootCtr);
    format = "Clippings 1.x series";
  }
  else {
    // A prime example of software reuse.
    count = this._importFromFileEx(this._rdfContainer, this._dataSrc, extRootCtr, extDS, true);
    format = "Clippings 2";
  }

  this._log("Exported " + count + " item(s); format: " + format);

  var rds = extDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
  try {
    rds.FlushTo(aFileURL);
  }
  catch (e) {
    this._log(e);
    throw e;
  }
};


nsClippingsService.prototype.getClippingsAsHTMLNodes = function ()
{
  var rv;

  // The XPCOM component with progid "@mozilla.org/xml/xml-document;1" 
  // is not available in Firefox 1.0.x
  var document = Components.classes["@mozilla.org/xml/xml-document;1"].createInstance(Components.interfaces.nsIDOMDocument);

  var body = document.createElement("body");
  var hdgElt = document.createElement("h1");

  // Put the Clippings HTML heading in a pref to permit localization.
  var prefSvc = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  var hdg = prefSvc.getCharPref("extensions.aecreations.clippings.export.html.title");
  var hdgTxt = document.createTextNode(hdg);

  hdgElt.appendChild(hdgTxt);
  body.appendChild(hdgElt);

  var dlEltOuter = this._exportHTMLRec(this._rdfContainer);
  var dlEltOuterEx = document.importNode(dlEltOuter, true);
  body.appendChild(dlEltOuterEx);

  rv = body.QueryInterface(Components.interfaces.nsIDOMElement);
  return rv;
};


nsClippingsService.prototype.writeFile = function (aFileURL, aData)
{
  var file = this._getFileFromURL(aFileURL);
  var charset = "UTF-8";
  var fos = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
  fos.init(file, 0x02 | 0x08 | 0x20, 0755, 0);  // Write, create, truncate.

  // Mozilla 1.8 (Firefox 1.5) or greater
  if ("nsIConverterOutputStream" in Components.interfaces) {
    var cos = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
                        .createInstance(Components.interfaces
		 	 	                  .nsIConverterOutputStream);
    cos.init(fos, charset, 0, "?".charCodeAt(0));
    cos.writeString(aData);
    cos.close();
  }
  // Firefox 1.0.x
  else {
    var conv = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    conv.charset = charset;
    
    try {
      var data = conv.ConvertToUnicode(aData);
      var fin = conv.Finish();
      fos.write(data, data.length);
      if (fin.length > 0) {
	fos.write(fin, fin.length);
      }
      
      this._log("nsClippingsService.writeFile(): Successfully wrote data to file");
    }
    catch (e) {
      this._log("nsClippingsService.writeFile(): Failed to convert data to Unicode; writing data as is");
      fos.write(aData, aData.length);
    }
    
    fos.close();
  }
};


nsClippingsService.prototype._exportHTMLRec = function (aLocalFolderCtr)
{
  var document = Components.classes["@mozilla.org/xml/xml-document;1"].createInstance(Components.interfaces.nsIDOMDocument);
  var dlElt = document.createElement("dl");
  var childrenEnum = aLocalFolderCtr.GetElements();

  while (childrenEnum.hasMoreElements()) {
    let child  = childrenEnum.getNext();
    child = child.QueryInterface(Components.interfaces.nsIRDFResource);
    let childURI = child.Value;

    let dtElt = document.createElement("dt");
    dtElt.setAttributeNS(this._CLIPPINGS_HTML_NS, "clippings-id", childURI);

    let ddElt = document.createElement("dd");
    
    if (this.isClipping(childURI)) {
      let h3Txt = document.createTextNode(this.getName(childURI));
      let h3Elt = document.createElement("h3");
      h3Elt.appendChild(h3Txt);
      dtElt.appendChild(h3Elt);
      dtElt.className = "clipping";

      let text = this.getText(childURI);
      text = text.replace(/\n/g, "<br>");

      let ddTxt = document.createTextNode(text);
      ddElt.appendChild(ddTxt);

      dlElt.appendChild(dtElt);
      dlElt.appendChild(ddElt);
    }
    else if (this.isFolder(childURI)) {   
      let h2Txt = document.createTextNode(this.getName(childURI));
      let h2Elt = document.createElement("h2");
      h2Elt.appendChild(h2Txt);
      dtElt.appendChild(h2Elt);

      dtElt.className = "folder";
      dlElt.appendChild(dtElt);

      let subfolderCtr = this._getSeqContainerFromFolder(childURI);
      let dlEltInner = this._exportHTMLRec(subfolderCtr);
      let dlEltInnerEx = document.importNode(dlEltInner, true);

      ddElt.appendChild(dlEltInnerEx);
      dlElt.appendChild(ddElt);
    }   
  }

  return dlElt;
};


nsClippingsService.prototype._exportLegacyRDFXML = function (aLocalFolderCtr, aExtDataSrc, aExtRootCtr)
{
  var count = 0;
  var childrenEnum = aLocalFolderCtr.GetElements();

  while (childrenEnum.hasMoreElements()) {
    let child = childrenEnum.getNext();
    child = child.QueryInterface(Components.interfaces.nsIRDFResource);
    let childURI = child.Value;

    if (this.isClipping(childURI)) {
      let name = this.getName(childURI);
      let text = this.getText(childURI);
      this._createLegacyClipping(name, text, aExtDataSrc, aExtRootCtr);
    }
    else if (this.isFolder(childURI)) {
      let localSubfolderCtr = this._getSeqContainerFromFolder(childURI);
      count += this._exportLegacyRDFXML(localSubfolderCtr, aExtDataSrc, aExtRootCtr);
    }
    count++;
  }

  return count;
};


nsClippingsService.prototype._createLegacyClipping = function (aName, aText, aExtDataSrc, aExtRootCtr)
{
  var subjectNode = this._rdfSvc.GetAnonymousResource();
  var predName = this._rdfSvc.GetResource(this._PREDNAME_RESOURCE_URI);
  var predText = this._rdfSvc.GetResource(this._PREDTEXT_RESOURCE_URI);
  var targName = this._rdfSvc.GetLiteral(aName);
  var targText = this._rdfSvc.GetLiteral(aText);

  aExtDataSrc.Assert(subjectNode, predName, targName, true);
  aExtDataSrc.Assert(subjectNode, predText, targText, true);

  aExtRootCtr.AppendElement(subjectNode);
};


nsClippingsService.prototype.importFromFile = function (aFileURL, aDontNotify, aImportShortcutKeys, /*out*/ aImportRootCtr)
{
  var rv;
  var extDataSrc;
  var extRDFContainer = Components.classes["@mozilla.org/rdf/container;1"]
                                  .createInstance(Components.interfaces
						            .nsIRDFContainer);
  var extSeqNode = this._rdfSvc.GetResource(this._SEQNODE_RESOURCE_URI);
  var extOldSeqNode = this._rdfSvc.GetResource(this._OLD_SEQNODE_RESOURCE_URI);

  try {
    extDataSrc = this._rdfSvc.GetDataSourceBlocking(aFileURL);
  }
  catch (e) {
    this._log(e);
    throw e;
  }

  // Root folder container initialization priority:
  // 1 - New Clippings data source
  // 2 - Clippings 1.x data source
  var isNewDataSrc = false;
  try {
    extRDFContainer.Init(extDataSrc, extSeqNode);
    isNewDataSrc = true;
  }
  catch (e) {
    try {
      extRDFContainer.Init(extDataSrc, extOldSeqNode);
    }
    catch (e) {
      throw Components.Exception("Failed to initialize RDF container!");
    }
  }

  if ((isNewDataSrc && !this._rdfContainerUtils.IsSeq(extDataSrc, extSeqNode))
      || (!isNewDataSrc && !this._rdfContainerUtils.IsSeq(extDataSrc, extOldSeqNode))) {
    throw Components.Exception("Not an RDF Seq container!");
  }

  rv = extRDFContainer.GetCount();
  this._log("External datasource successfully loaded from \"" + aFileURL
	    + "\":\n" + rv + " item(s) in root folder\nFormat: "
	    + (isNewDataSrc ? "Clippings 2" : "Clippings 1.x series"));

  if (isNewDataSrc) {
    rv = this._importFromFileEx(extRDFContainer, extDataSrc, this._rdfContainer, null, aImportShortcutKeys);

    if (! aDontNotify) {
      this._notifyImportDone(rv);
    }

    aImportRootCtr.value = extRDFContainer;
    return rv;
  }

  // Import Clippings 1.x data
  var predName = this._rdfSvc.GetResource(this._PREDNAME_RESOURCE_URI);
  var predText = this._rdfSvc.GetResource(this._PREDTEXT_RESOURCE_URI);
  var targName, targText, newNode;
  var childNodesEnum = extRDFContainer.GetElements();
  var childNode;

  while (childNodesEnum.hasMoreElements()) {
    childNode = childNodesEnum.getNext();
    if (childNode instanceof Components.interfaces.nsIRDFResource) {
      targName = extDataSrc.GetTarget(childNode, predName, true);
      targText = extDataSrc.GetTarget(childNode, predText, true);

      if (targName instanceof Components.interfaces.nsIRDFLiteral
	  && targText instanceof Components.interfaces.nsIRDFLiteral) {
	var name = targName.Value;
	var text = targText.Value;
      }
      else {
	throw Components.Exception("Name and Text nodes are not valid RDF literals!");
      }

      newNode = this._rdfSvc.GetAnonymousResource();
      try {
	this._createNewClippingHelper(this.kRootFolderURI, newNode, name, text, null, true);
      }
      catch (e) {
	throw Components.Exception("Data source not initialized", Components.results.NS_ERROR_NOT_INITIALIZED);
      }
    }
    else {
      throw Components.Exception("Child node of container is not a valid RDF resource!");
    }
  }

  if (! aDontNotify) {
    this._notifyImportDone(rv);
  }

  aImportRootCtr.value = extRDFContainer;
  return rv;
};


// Import data from Clippings 2.x and newer
nsClippingsService.prototype._importFromFileEx = function (aExtFolderCtr, aExtDataSrc, aLocalFolderCtr, aLocalDataSrc, aImportShortcutKeys)
{
  var count = 0;
  var localFolderURI = aLocalFolderCtr.Resource.Value;
  var extChildrenEnum = aExtFolderCtr.GetElements();

  while (extChildrenEnum.hasMoreElements()) {
    let extChild = extChildrenEnum.getNext();
    extChild = extChild.QueryInterface(Components.interfaces.nsIRDFResource);
    let extChildURI = extChild.Value;
    let name = this.getName(extChildURI, aExtDataSrc);

    if (this.isClipping(extChildURI, aExtDataSrc)) {
      let text = this.getText(extChildURI, aExtDataSrc);
      let uri = this.createNewClipping(localFolderURI, name, text, true, aLocalDataSrc);

      let key;
      if (key = this.getShortcutKey(extChildURI, aExtDataSrc)) {
	if (aImportShortcutKeys) {
	  try {
	    this.setShortcutKey(uri, key, aLocalDataSrc);
	  }
	  catch (e) {
	    // Can't set shortcut key because it is already assigned
	    this._log(e);
	  }
	}
	else {
	  // Shortcut key import will be deferred until importShortcutKeys()
	  // is invoked. For now, store the shortcut keys to be imported into
	  // a temporary array to be used later by importShortcutKeys().
	  this._deferredShortcutKeyImport[key] = uri;
	}
      }

      this._log("nsClippingsService._importFromFileEx(): Clipping `" + name + "'");
    }
    else if (this.isFolder(extChildURI, aExtDataSrc)) {
      let extSubfolderCtr = this._getSeqContainerFromFolder(extChildURI, aExtDataSrc);
      let localSubfolderURI = this.createNewFolder(localFolderURI, name, true, aLocalDataSrc);
      let localSubfolderCtr = this._getSeqContainerFromFolder(localSubfolderURI, aLocalDataSrc);

      this._log("nsClippingsService._importFromFileEx(): Folder `" + name + "'");

      count += this._importFromFileEx(extSubfolderCtr, aExtDataSrc, localSubfolderCtr, aLocalDataSrc, aImportShortcutKeys);
    }
    else {
      // Neither a clipping nor folder - ignore.  Possibly a new item type that
      // might be introduced in future versions.
    }
    count++;
  }

  return count;
};


nsClippingsService.prototype._deferredShortcutKeyImport = {};


nsClippingsService.prototype._notifyImportDone = function (aNumItems)
{
  for (let i = 0; i < this._listeners.length; i++) {
    if (this._listeners[i]) {
      this._log("nsClippingsService._notifyImportDone(): Notifying observer " + i);
      this._listeners[i].importDone(aNumItems);
    }
  }
};


nsClippingsService.prototype.hasConflictingShortcutKeys = function (aImportRootCtr)
{
  if (aImportRootCtr.Resource.Value == this._OLD_SEQNODE_RESOURCE_URI) {
    throw Components.Exception("Shortcut keys are not supported in Clippings 1.x series");
  }

  var dict = this.getShortcutKeyDict();
  return this._hasConflictingShortcutKeys(aImportRootCtr, dict);
};


nsClippingsService.prototype._hasConflictingShortcutKeys = function (aExtContainer, aShortcutKeyDict)
{
  var extChildrenEnum = aExtContainer.GetElements();
  var extDataSrc = aExtContainer.DataSource;

  while (extChildrenEnum.hasMoreElements()) {
    let extChild = extChildrenEnum.getNext();
    extChild = extChild.QueryInterface(Components.interfaces.nsIRDFResource);
    let extChildURI = extChild.Value;

    if (this.isClipping(extChildURI, extDataSrc)) {
      let pred = this._rdfSvc.GetResource(this._PREDKEY_RESOURCE_URI);
      let targ = extDataSrc.GetTarget(extChild, pred, true);

      if (targ instanceof Components.interfaces.nsIRDFLiteral) {
	let key = targ.Value;
	if (aShortcutKeyDict.hasKey(key)) {
	  return true;
	}
      }
    }
    else if (this.isFolder(extChildURI, extDataSrc)) {
      let extSubfolderCtr = this._getSeqContainerFromFolder(extChildURI, extDataSrc);
      if (this._hasConflictingShortcutKeys(extSubfolderCtr, aShortcutKeyDict)) { 
	return true;
      }
    }
  }

  return false;
};


nsClippingsService.prototype.importShortcutKeys = function (aImportRootCtr, aImportFlag)
{
  if (aImportRootCtr.Resource.Value == this._OLD_SEQNODE_RESOURCE_URI) {
    throw Components.Exception("Shortcut keys are not supported in Clippings 1.x series");
  }

  var dict = this.getShortcutKeyDict();

  for (let key in this._deferredShortcutKeyImport) {
    // Check for shortcut key conflicts
    if (dict.hasKey(key)) {
      if (aImportFlag == this.IMPORT_REPLACE_CURRENT) {
	var currentlyAssignedURI;
	try {
	  var currentlyAssignedURIStr = dict.getValue(key, currentlyAssignedURIStr);
	}
	catch (e) {}
	currentlyAssignedURIStr = currentlyAssignedURIStr.QueryInterface(Components.interfaces.nsISupportsString);
	currentlyAssignedURI = currentlyAssignedURIStr.data;

	this._log("nsClippingsService.importShortcutKeys(): Overwriting shortcut key assignment for key `" + key + "'\n(was assigned to clipping `" + currentlyAssignedURI + "')");

	this.setShortcutKey(currentlyAssignedURI, "");

	var newURI = this._deferredShortcutKeyImport[key];
	this.setShortcutKey(newURI, key);

	this._log("nsClippingsService.importShortcutKeys(): Key `" + key + "' is now assigned to clipping `" + newURI + "'");
      }
      else {
	this._log("nsClippingsService.importShortcutKeys(): Key `" + key + "' is already assigned to an existing clipping; skipping");
      }
    }
    else {
      this.setShortcutKey(this._deferredShortcutKeyImport[key], key);
    }
  }

  this.cancelDeferredShortcutKeyImport();
};


nsClippingsService.prototype.cancelDeferredShortcutKeyImport = function ()
{
  this._deferredShortcutKeyImport = {};
};



//
// Private utility functions
//

nsClippingsService.prototype._log = function (aMessage)
{
  if (this._DEBUG) {
    var consoleSvc = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
    consoleSvc.logStringMessage(aMessage);
  }
};


nsClippingsService.prototype._strtrm = function (aString)
{
  const SPACE_CODE = 32;

  if (! aString) {
    return aString;
  }

  let len = aString.length;

  if (aString.charCodeAt(0) > SPACE_CODE 
      && aString.charCodeAt(len - 1) > SPACE_CODE) {
	return aString;
      }

  let k = -1;
  while (k < len && aString.charCodeAt(++k) <= SPACE_CODE);
  if (k == len) {
    return "";
  }

  let m = len;
  while (m > 0 && aString.charCodeAt(--m) <= SPACE_CODE);
  return aString.substring(k, m + 1);
};


nsClippingsService.prototype._sanitize = function (aString)
{
  // Strips control characters from the string: ASCII codes 0-31 and 127 (DEL),
  // excluding 10 (NL) and 13 (CR) to allow line breaks.
  // Don't exclude tabs (HT, ASCII 9) since they'll be collapsed anyway when
  // the RDF data is saved.
  var rv = aString.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f\x7f]/g, " ");
  return rv;
};


nsClippingsService.prototype._getDateTimeString = function ()
{
  var oDate = new Date();
  var month = oDate.getMonth();
  var date = oDate.getDate();
  var year = oDate.getFullYear();
  var sDate;

  month += 1;
  if (month < 10) month = "0" + month;  
  if (date < 10) date = "0" + date;
  sDate = year.toString() + "-" + month.toString() + "-" + date.toString();

  var hrs = oDate.getHours();  // 24-hr format
  if (hrs < 10) hrs = "0" + hrs;
  var min = oDate.getMinutes();
  if (min < 10) min = "0" + min;
  var sec = oDate.getSeconds();
  if (sec < 10) sec = "0" + sec;
  var sTime = hrs.toString() + min.toString() + sec.toString();

  return (sDate + "_" + sTime);
};


nsClippingsService.prototype._getFileFromURL = function (aFileURL)
  // Returns the nsIFile object of the file with the given URL.
{
  var rv;
  var io = Components.classes["@mozilla.org/network/io-service;1"]
                     .getService(Components.interfaces.nsIIOService);
  var fh = io.getProtocolHandler("file")
             .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
  rv = fh.getFileFromURLSpec(aFileURL);
  return rv;
};


nsClippingsService.prototype._getURLFromFile = function (aFile)
{
  var rv, file;
  try {
    file = aFile.QueryInterface(Components.interfaces.nsIFile);
  }
  catch (e) {
    throw e;
  }

  var fph = Components.classes["@mozilla.org/network/protocol;1?name=file"].createInstance(Components.interfaces.nsIFileProtocolHandler);
  rv = fph.getURLSpecFromFile(file);

  return rv;
};


//
// Component registration
//

const NSGetFactory = XPCOMUtils.generateNSGetFactory([nsClippingsService]);

