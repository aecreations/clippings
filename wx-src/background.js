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

let db = null;

/***
chrome.contextMenus.create({
  id: "clipping-1",
  title: "New Clipping 1",
  contexts: ["editable"]
});

chrome.contextMenus.create({
  id: "clipping-2",
  title: "New Clipping 2",
  contexts: ["editable"]
});

// Test nested menus
var parentMnuID = chrome.contextMenus.create({
  id: "folder-menu-1",
  title: "Folder A",
  contexts: ["editable"]
});

chrome.contextMenus.create({
  id: "clipping-A1",
  title: "New Clipping A1",
  parentId: parentMnuID,
  contexts: ["editable"]
});

chrome.contextMenus.create({
  id: "clipping-A2",
  title: "New Clipping A2",
  parentId: parentMnuID,
  contexts: ["editable"]
});

var parentSubmnuID = chrome.contextMenus.create({
  id: "subfolder-AA",
  title: "Folder AA",
  parentId: parentMnuID,
  contexts: ["editable"]
});

chrome.contextMenus.create({
  id: "clipping-A3",
  title: "New Clipping A3",
  parentId: parentMnuID,
  contexts: ["editable"]
});

chrome.contextMenus.create({
  id: "clipping-AA-1",
  title: "New Clipping AA1",
  parentId: parentSubmnuID,
  contexts: ["editable"]
});
***/


//
// Browser window and Clippings menu initialization
//

function init()
{
  db = new Dexie("aeClippings");
  db.version(1).stores({
    clippings: "++id, name, parentFolderID"
  });
  db.open().catch(e => {
    console.error("Clippings/wx: Error opening database: " + e);
  });

  if (! ("browser" in window)) {
    console.log("Clippings/wx: Browser: Google Chrome");  
  }
  else {
    let getBrowserInfo = browser.runtime.getBrowserInfo();
    getBrowserInfo.then(aBrwsInfo => {
      console.log(`Clippings/wx: Browser: ${aBrwsInfo.name} (version ${aBrwsInfo.version})`);
    });
  }

  chrome.runtime.getPlatformInfo(aInfo => { console.log("Clippings/wx: OS: " + aInfo.os); });

  chrome.browserAction.onClicked.addListener(aTab => {
    // TO DO: Get this from a pref.
    let openInNewTab = true;

    if (openInNewTab) {
      chrome.tabs.create({
        url: "pages/clippingsMgr.html"
      });
    }
    else {
      chrome.windows.create({
        url: "pages/clippingsMgr.html",
        type: "popup",
        focused: true,
        left: 64, top: 128,
        width: 600, height: 400
      });
    }      
  });
  
  buildContextMenu();
}


function buildContextMenu()
{
  chrome.contextMenus.create({
    id: "ae-clippings-new",
    title: "New...",
    contexts: ["editable", "selection"]
  });

  chrome.contextMenus.create({
    id: "ae-clippings-manager",
    title: "Organize Clippings",
    contexts: ["editable", "selection"]
  });

  db.clippings.count().then(aResult => {
    console.log("Number of clippings at root folder level: " + aResult);
    let numClippingsInRoot = aResult;
    if (numClippingsInRoot > 0) {
      chrome.contextMenus.create({ type: "separator", contexts: ["editable"]});

      db.clippings.where("parentFolderID").equals(0).each((aItem, aCursor) => {
          chrome.contextMenus.create({
            id: "ae-clippings-clipping-" + aItem.id,
            title: aItem.name,
            contexts: ["editable"]
          });
      });
    }
  });  
}


function rebuildContextMenu()
{
  chrome.contextMenus.removeAll();  
  buildContextMenu();
}


function createClipping(aName, aContent/*, aShortcutKey, aSrcURL */)
{
  let createClipping = db.clippings.add({name: aName, content: aContent, shortcutKey: "", parentFolderID: 0});

  createClipping.then(aID => {
    if (isGoogleChrome()) {
      window.alert("Successfully created new clipping \"" + aName + "\".");
    }
    console.info("Clippings/wx: Successfully created new clipping!\nid = %d", aID);
    
    let getClipping = db.clippings.get(aID);
    getClipping.then(aResult => {
      console.log("Name: %s\nText: %s", aResult.name, aResult.content);
    });

    rebuildContextMenu();
  }, onError);
}


function getClippingsDB()
{
  return db;
}


function isGoogleChrome()
{
  return (! ("browser" in window));
}


function alertEx(aMessage)
{
  if (isGoogleChrome()) {
    window.alert(aMessage);
  }
  else {
    console.info("Clippings/wx: " + aMessage);
  }
}


function onError(aError)
{
  console.error("Clippings/wx: " + aError);
}


//
// Click event listener for the context menu items
//

chrome.contextMenus.onClicked.addListener((aInfo, aTab) => {
  switch (aInfo.menuItemId) {
  case "ae-clippings-new":
    // TEMPORARY - To be moved into a popup
    let text = aInfo.selectionText;  // Line breaks are NOT preserved!
    if (! text) {
      alertEx("No text was selected.  Please select text first.");
      break;
    }

    let name = "";

    if (isGoogleChrome()) {
      name = window.prompt("New clipping name:", "New Clipping");
    }
    else {
      name = text.substring(0, 64);
      if (text.length > 64) {
        name += "...";
      }
    }
    
    if (! name) {
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, aTabs => {
      if (! aTabs[0]) {
        alertEx("Please return to the browser window and try again.");
        return;
      }

      let activeTabID = aTabs[0].id;

      chrome.tabs.get(activeTabID, aTabInfo => {
        if (aTabInfo.status == "loading") {
          console.warn("Clippings/wx: The active tab (ID = %s) is still loading or busy. Sending messages to it may not work.", activeTabID);
        }
      });
      
      console.log("Clippings/wx: Extension sending message 'ae-clippings-new' to content script; active tab ID: " + activeTabID);

      if (isGoogleChrome()) {
        chrome.tabs.sendMessage(activeTabID, { msgID: "ae-clippings-new", hostApp: "chrome" }, null, aResp => {
          let content = aResp.content;
          if (! content) {
            console.warn("Clippings/wx: Content script was unable to retrieve content from the web page.  Retrieving selection text from context menu info.");
            content = text;
          }
          console.log("Clippings/wx: Creating clipping from selected text:\nName: " + name + "\nText: " + content);
          createClipping(name, content);
        });
      }
      else {
        browser.tabs.sendMessage(activeTabID, { msgID: "ae-clippings-new" })
        .then(aResp => {
          if (! aResp) {
            console.error("Clippings/wx: Unable to receive response from content script!");
            return;
          }
          let content = aResp.content;
          if (! aResp.content) {
            console.warn("Clippings/wx: Content script was unable to retrieve textual content from the web page.  Retrieving selection text from context menu info.");
            content = text;
          }
          console.log("Clippings/wx: Creating clipping from selected text:\nName: " + name + "\nText: " + content);
          createClipping(name, content);
        }, onError);
      }
    });
    // END TEMPORARY
    break;

  case "ae-clippings-manager":
    // TO DO: Get this from a pref.
    let openInNewTab = true;

    if (openInNewTab) {
      chrome.tabs.create({
        url: "clippingsMgr.html"
      });
    }
    else {
      chrome.windows.create({
        url: "clippingsMgr.html",
        type: "popup",
        focused: true,
        left: 64, top: 128,
        width: 600, height: 400
      });
    }
    break;

  default:
    if (aInfo.menuItemId.startsWith("ae-clippings-clipping-")) {
      let clippingID = Number(aInfo.menuItemId.substr(22));
      db.clippings.where("id").equals(clippingID).first(aClipping => {
        if (! aClipping) {
          alertEx("Cannot find clipping.\nClipping ID = " + clippingID);
          return;
        }
        console.log("Pasting clipping named \"" + aClipping.name + "\"\nid = " + aClipping.id);

        chrome.tabs.query({ active: true, currentWindow: true }, aTabs => {
          if (! aTabs[0]) {
            // This should never happen...
            alertEx("Unable to paste clipping because there is no active browser tab.");
            return;
          }

          let activeTabID = aTabs[0].id;
          let msgParams = {
            msgID: "ae-clippings-paste",
            content: aClipping.content,
            hostApp: (isGoogleChrome() ? "chrome" : "firefox")
          };

          console.log("Clippings/wx: Extension sending message 'ae-clippings-paste' to content script");
          
          chrome.tabs.sendMessage(activeTabID, msgParams, null, aResp => {
            console.log("It is " + aResp + " that the clipping was successfully pasted.");
          });
        });        
      });
    }
    break;
  }
});


init();
