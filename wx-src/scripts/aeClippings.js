/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let aeClippings = {
  MAX_NAME_LENGTH: 64,
  _db: null,
  

  init()
  {
    this._db = new Dexie("aeClippings");
    this._db.version(1).stores({
      clippings: "++id, name, parentFolderID"
    });
    // This was needed to use the Dexie.Observable add-on (discontinued as of 6.2)
    this._db.version(2).stores({});

    this._db.version(3).stores({
      folders: "++id, name, parentFolderID"
    });
    this._db.version(4).stores({
      clippings: "++id, name, parentFolderID, shortcutKey"
    });
    this._db.version(5).stores({
      clippings: "++id, name, parentFolderID, shortcutKey, sourceURL"
    });

    this._db.open().catch(aErr => {
      console.error("aeClippings.init(): " + aErr);
    });  
  },


  getDB()
  {
    if (! this._db) {
      this.init();
    }
    return this._db;
  },


  verifyDB()
  {
    return new Promise((aFnResolve, aFnReject) => {
      let numClippings;

      this._db.clippings.count(aNumItems => {
        numClippings = aNumItems;
      }).then(() => {
        aFnResolve(numClippings);
      }).catch(aErr => {
        aFnReject(aErr);
      });
    });    
  },

  createClippingNameFromText(aText)
  {
    let rv = "";
    let clipName = "";

    aText = aText.trim();

    if (aText.length > this.MAX_NAME_LENGTH) {
      // Leave room for the three-character elipsis.
      clipName = aText.substr(0, this.MAX_NAME_LENGTH - 3) + "...";
    } 
    else {
      clipName = aText;
    }

    // Truncate clipping names at newlines if they exist.
    let newlineIdx = clipName.indexOf("\n");
    rv = (newlineIdx == -1) ? clipName : clipName.substring(0, newlineIdx);

    return rv;
  },

  
  async getClippingsByName(aName)
  {
    if (! this._db) {
      this.init();
    }
    
    let rv = await this._db.clippings.where("name").equals(aName).toArray();
    return rv;
  },

  
  hasHTMLTags(aText)
  {
    let rv = aText.search(/<[a-z1-6]+( [a-z]+(\="?.*"?)?)*>/i) != -1;
    return rv;
  }
};
