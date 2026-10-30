/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class aeActiveTreeNodeHistory
{
  constructor()
  {
    this._treeNodes = [];
  }


  async add(aNode)
  {
    if (!aNode || !aNode.key) {
      throw new TypeError("aeActiveTreeNodeHistory.add(): aNode not a FancytreeNode");
    }

    if (gSyncedItemsIDs.has(aNode.key)) {
      if (aNode.isFolder()) {
        let folderID = parseInt(aNode.key);
        // The "Synced Clippings" folder does not have a static synced
        // item ID (sid).
        let syncFolderID = await aePrefs.getPref("syncFolderID");
        if (folderID == syncFolderID) {
          this._treeNodes.push(aNode.key);
        }
        else {
          let folder = await gClippingsDB.folders.get(folderID);
          if (!folder) {
            throw new ReferenceError("aeActiveTreeNodeHistory.add(): Cannot find folder " + folderID);
          }
          this._treeNodes.push(folder.sid);
        }
      }
      else {
        let clippingID = parseInt(aNode.key);
        let clipping = await gClippingsDB.clippings.get(clippingID);
        if (!clipping) {
          throw new ReferenceError("aeActiveTreeNodeHistory.add(): Cannot find clipping " + clippingID);
        }
        this._treeNodes.push(clipping.sid);
      }
    }
    else {
      this._treeNodes.push(aNode.key);
    }
  }


  getPreviousNodeKey(aFromReloadBtn)
  {
    let rv = null;
    if (this._treeNodes.length < 2) {
      return rv;
    }

    // Workaround to previously-active tree node being changed to Synced
    // Clippings folder when the Reload button is clicked.
    let idx = aFromReloadBtn ? -2 : -1;
    rv = this._treeNodes.at(idx);

    return rv;
  }


  clear()
  {
    this._treeNodes = [];
  }
}
