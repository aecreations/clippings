/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


class aeFolderPicker
{
  constructor(aTreeEltSelector, aClippingsDB, aActiveTreeNodeKey)
  {
    this._treeEltSelector = aTreeEltSelector;
    this._db = aClippingsDB;
    this._fnOnSelectFolder = function (aFolderData) {};

    this._init(aActiveTreeNodeKey);
  }

  _init(aActiveTreeNodeKey)
  {
    let treeData = [
      {
	title: "Clippings",
	key: 0,
	folder: true,
	expanded: true,
	children: []
      }
    ];

    this._db.folders.where("parentFolderID").equals(0).each((aItem, aCursor) => {
      let folderNode = {
	key: aItem.id,
	title: aItem.name,
	folder: true
      };

      folderNode.children = this._buildFolderTree(aItem);
      treeData[0].children.push(folderNode);
    }).then(() => {
      let that = this;
      
      $(this._treeEltSelector).fancytree({
	source: treeData,
	selectMode: 1,
	icon: true,
        escapeTitles: true,

	init: function (aEvent, aData) {
          if (aActiveTreeNodeKey) {
            aData.tree.activateKey(aActiveTreeNodeKey);
          }
          else {
            aData.tree.getRootNode().children[0].setActive();
          }
	},

	click: function (aEvent, aData) {
          if (aData.targetType == "icon" || aData.targetType == "title") {
	    that._fnOnSelectFolder(aData);
          }
	}
      });
    });
  }

  _buildFolderTree(aFolderData)
  {
    let rv = [];
    let folderID = aFolderData.id;

    this._db.folders.where("parentFolderID").equals(folderID).each((aItem, aCursor) => {
      let folderNode = {
	key: aItem.id,
	title: aItem.name,
	folder: true
      }

      folderNode.children = this._buildFolderTree(aItem);    
      rv.push(folderNode);
    });

    return rv;
  }

  setOnSelectFolder(aFnOnSelectFolder)
  {
    this._fnOnSelectFolder = aFnOnSelectFolder;
  }

  getTree()
  {
    let rv = $(this._treeEltSelector).fancytree("getTree");

    return rv;
  }
}
