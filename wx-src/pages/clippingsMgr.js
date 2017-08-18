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
 * Portions created by the Initial Developer are Copyright (C) 2005-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

const DEBUG = true;

var gOS;
var gClippingsDB;
var gClippings;


$(document).ready(() => {
  gClippings = chrome.extension.getBackgroundPage();

  if (gClippings) {
    gClippingsDB = gClippings.getClippingsDB();
    _log("Clippings/wx: clippingsMgr: Successfully opened Clippings DB");
  }
  else {
    showBanner("Error initializing Clippings Manager: Unable to locate parent browser window.");
  }

  chrome.runtime.getPlatformInfo(aInfo => { gOS = aInfo.os; });

  gClippingsDB.clippings.count().then(aResult => {
    console.log("Number of clippings at root folder level: " + aResult);
    let numClippingsInRoot = aResult;
    if (numClippingsInRoot > 0) {
      let treeData = [];

      let getRootClippings = gClippingsDB.clippings.where("parentFolderID").equals(0).each((aItem, aCursor) => {
        let treeNode = {
          key: aItem.id,
          title: aItem.name
        };

        treeData.push(treeNode);
      });

      getRootClippings.then(() => {
        $("#clippings-tree").fancytree({
          source: treeData,
          selectMode: 1,
          icon: true
        });
     });
    }
    else {
      $("#clippings-tree").fancytree({
        source: [{title: "No clippings found.", key: 0}],
        icon: false
      });
    }
  }, onError);
  
});



function showBanner(aMessage)
{
  let bannerElt = $("#dlg-banner");
  let bannerMsgElt = $("#dlg-banner-msg");

  bannerMsgElt.children().remove();
  bannerMsgElt.text(aMessage);
  bannerElt.css("display", "block");
}



function onError(aError)
{
  showBanner(aError);
}


function _log(aMessage)
{
  if (DEBUG) {
    console.log(aMessage);
  }
}
