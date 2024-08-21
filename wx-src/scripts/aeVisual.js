/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let aeVisual = {
  _iconCache: [],


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

  cacheIcons(...aIconFileNames)
  {
    for (let fileName of aIconFileNames) {
      let img = new Image();
      img.src = `../img/${fileName}`;
      this._iconCache.push(img);
    }
  },
};
