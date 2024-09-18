/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let aeVisual = {
  _os: null,
  _iconCache: [],


  init(aOSName)
  {
    this._os = aOSName;
  },

  preloadLafImages()
  {
    this.cacheIcons(
      "checked.svg",
      "drop-down.svg",
      "submenu-arrow.svg",
      "checked-dk.svg",
      "dropdown_dk.svg",
      "submenu-arrow-dk.svg"
    );
  },

  preloadMsgBoxIcons(aPreloadAll)
  {
    this.cacheIcons(
      "warning-64.png",
      "warning-64-mac.png",
      "alert-win.png"
    );

    if (aPreloadAll) {
      this.cacheIcons(
        "question-64.png",
        "question-64-mac.png",
        "confirm-win.png",
        "info.svg",
        "info-win.png",
        "error.svg",
        "error-win.png",
      );
    }
  },

  cacheIcons(...aIconFileNames)
  {
    for (let fileName of aIconFileNames) {
      let img = new Image();
      img.src = `../img/${fileName}`;
      this._iconCache.push(img);
    }
  },

  getErrorIconPath(aFromExtSubdir=false)
  {
    let rv = "";
    if (this._os == "win") {
      rv = "img/error-win.png";
    }
    else {
      rv = "img/error.svg";
    }
    if (aFromExtSubdir) {
      rv = `../${rv}`;
    }
    return rv;
  },
};
