/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


class aeFolderPicker
{
  constructor(aTreeEltSelector, aClippingsDB, aParentFldrID, aParentFldrName, aRootFldrCls, aActiveTreeNodeKey)
  {
    this.ROOT_FOLDER_CLS = "ae-clippings-root";
    this.SYNCED_ROOT_FOLDER_CLS = "ae-clippings-sync-root";
  
    this._treeEltSelector = aTreeEltSelector;
    this._db = aClippingsDB;
    this._fnOnSelectFolder = function (aFolderData) {};

    this._init(aParentFldrID, aParentFldrName, aRootFldrCls, aActiveTreeNodeKey);
  }

  _init(aParentFldrID, aParentFldrName, aRootFldrCls, aActiveTreeNodeKey)
  {
    let isSyncClippings = false;
    let rootFldrTreeNodes = [];

    this._db.folders.where("parentFolderID").equals(aParentFldrID).each((aItem, aCursor) => {
      let folderNode = {
	key: aItem.id,
	title: aItem.name,
	folder: true
      };

      if ("isSync" in aItem) {
        isSyncClippings = true;
        folderNode.extraClasses = "ae-synced-clippings-fldr";
      }

      if ("displayOrder" in aItem)  {
        folderNode.displayOrder = aItem.displayOrder;
      }
      else {
        folderNode.displayOrder = 0;
      }

      this._buildFolderTree(aItem).then(aChildItems => {
        folderNode.children = aChildItems;
        rootFldrTreeNodes.push(folderNode);
      });
    }).then(() => {
      let that = this;

      rootFldrTreeNodes.sort((aItem1, aItem2) => { return this._sort(aItem1, aItem2) });

      let rootFldrCls = aRootFldrCls || this.ROOT_FOLDER_CLS;
      let treeData = [
        {
	  title: aParentFldrName,
	  key: aParentFldrID,
	  folder: true,
	  expanded: true,
          extraClasses: rootFldrCls,
	  children: rootFldrTreeNodes,
        }
      ];
      
      $(this._treeEltSelector).fancytree({
	source: treeData,
	selectMode: 1,
	icon: true,
        escapeTitles: true,

	init(aEvent, aData)
        {
          if (aActiveTreeNodeKey) {
            aData.tree.activateKey(String(aActiveTreeNodeKey));
          }
          else {
            aData.tree.getRootNode().children[0].setActive();
          }
	},

	click(aEvent, aData)
        {
          if (aData.targetType == "icon" || aData.targetType == "title") {
	    that._fnOnSelectFolder(aData);
          }
	}
      });

      if (isSyncClippings) {
        $(".ae-synced-clippings-fldr").parent().addClass("ae-synced-clippings");
      }
    }).catch(aErr => {
      console.error("aeFolderPicker._init(): " + aErr);
      throw aErr;
    });
  }

  _buildFolderTree(aFolderData)
  {
    let that = this;
    let rv = [];
    let folderID = aFolderData.id;

    return new Promise((aFnResolve, aFnReject) => {
      that._db.folders.where("parentFolderID").equals(folderID).each((aItem, aCursor) => {
        let folderNode = {
	  key: aItem.id,
	  title: aItem.name,
	  folder: true
        };

        if ("displayOrder" in aItem) {
          folderNode.displayOrder = aItem.displayOrder;
        }
        else {
          folderNode.displayOrder = 0;
        }

        that._buildFolderTree(aItem).then(aChildItems => {
          folderNode.children = aChildItems;    
          rv.push(folderNode);  
        });
      }).then(() => {
        rv.sort((aItem1, aItem2) => { return that._sort(aItem1, aItem2) });
        aFnResolve(rv);
      });
    });
  }

  _sort(aTreeNode1, aTreeNode2) {
    let rv = 0;
    if ("displayOrder" in aTreeNode1 && "displayOrder" in aTreeNode2) {
      rv = aTreeNode1.displayOrder - aTreeNode2.displayOrder;
    }
    return rv; 
  }

  set onSelectFolder(aFnOnSelectFolder)
  {
    this._fnOnSelectFolder = aFnOnSelectFolder;
  }

  getTree()
  {
    let rv = $(this._treeEltSelector).fancytree("getTree");

    return rv;
  }
}
