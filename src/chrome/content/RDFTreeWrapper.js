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

//
// Wrapper object for an RDF <tree> element.  Tree rows can be identified
// either by index or by the URI of its corresponding RDF resource node.
//

function RDFTreeWrapper(aXULTreeElt)
{
  this._tree = aXULTreeElt || null;
}


RDFTreeWrapper.prototype = {
  _rdfSvc:  Components.classes["@mozilla.org/rdf/rdf-service;1"]
                      .getService(Components.interfaces.nsIRDFService),

  get tree()
  {
    return this._tree;
  },

  set tree(aXULTreeElt)
  {
    return (this._tree = aXULTreeElt);
  },

  get selectedIndex()
  {
    return this._tree.currentIndex;
  },

  set selectedIndex(aIndex)
  {
    return (this._tree.view.selection.select(aIndex));
  },

  get selectedURI()
  {
    var rv = "";
    var idx = this._tree.currentIndex;
    if (idx != -1) {
      var res = this._tree.builderView.getResourceAtIndex(idx);
      rv = res.Value;
    }
    return rv;
  },

  set selectedURI(aURI)
  {
    var res = this._rdfSvc.GetResource(aURI);
    var idx = this._tree.builderView.getIndexOfResource(res);
    this._tree.view.selection.select(idx);
  }
};


RDFTreeWrapper.prototype.ensureURIIsVisible = function (aURI)
{
  var res = this._rdfSvc.GetResource(aURI);
  var idx = this._tree.builderView.getIndexOfResource(res);
  this._tree.treeBoxObject.ensureRowIsVisible(idx);
};


RDFTreeWrapper.prototype.ensureIndexIsVisible = function (aIndex)
{
  this._tree.treeBoxObject.ensureRowIsVisible(aIndex);
};


RDFTreeWrapper.prototype.getRowCount = function ()
{
  return this._tree.view.rowCount;
};


RDFTreeWrapper.prototype.getURIAtIndex = function (aIndex)
{
  var rv;
  var res = this._tree.builderView.getResourceAtIndex(aIndex);
  rv = res.Value;
  return rv;
};

RDFTreeWrapper.prototype.getIndexAtURI = function (aURI)
{
  var rv;
  var res = this._rdfSvc.GetResource(aURI);
  rv = this._tree.builderView.getIndexOfResource(res);
  return rv;
};
