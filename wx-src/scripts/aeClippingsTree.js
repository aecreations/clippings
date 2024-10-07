/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let aeClippingsTree = {
  DEBUG: false,

  getTree()
  {
    let rv = $.ui.fancytree.getTree("#clippings-tree");
    return rv;
  },
  
  build(aFolderID, aPrefs)
  {
    let rv = [];

    return new Promise((aFnResolve, aFnReject) => {
      gClippingsDB.transaction("r", gClippingsDB.folders, gClippingsDB.clippings, () => {
        gClippingsDB.folders.where("parentFolderID").equals(aFolderID).each(async (aItem, aCursor) => {
          let folderNode = {
            key: aItem.id + "F",
            folder: true,
          }

          let title = "";
          if (this.DEBUG) {
            title = this.sanitizeTreeNodeTitle(`${aItem.name} [key=${aItem.id}F]`);
          }
          else {
            title = this.sanitizeTreeNodeTitle(aItem.name);
          }
          folderNode.title = title;

          if (aItem.id == aPrefs.syncFolderID) {
            folderNode.extraClasses = "ae-synced-clippings-fldr";
            if (aPrefs.isSyncReadOnly) {
              folderNode.extraClasses += " ae-synced-clippings-readonly";
            }
          }

          if ("displayOrder" in aItem) {
            folderNode.displayOrder = aItem.displayOrder;
          }
          else {
            folderNode.displayOrder = 0;
          }

          if ("sid" in aItem) {
            folderNode.sid = aItem.sid;
            if (this.DEBUG) {
              folderNode.title += ` [sid=${aItem.sid}]`;
            }
          }
          
          let childNodes = await this.build(aItem.id, aPrefs);
          folderNode.children = childNodes;
          rv.push(folderNode);

        }).then(() => {
          return gClippingsDB.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
            let clippingNode = {
              key: aItem.id + "C",
            };

            let title = "";
            if (this.DEBUG) {
              title = this.sanitizeTreeNodeTitle(`${aItem.name} [key=${aItem.id}C]`);
            }
            else {
              title = this.sanitizeTreeNodeTitle(aItem.name);
            }
            clippingNode.title = title;

            if (aItem.label) {
              clippingNode.extraClasses = `ae-clipping-label-${aItem.label}`;
            }

            if ("displayOrder" in aItem) {
              clippingNode.displayOrder = aItem.displayOrder;
            }
            else {
              clippingNode.displayOrder = 0;
            }

            if (aItem.separator) {
              clippingNode.title = "<hr>";
              clippingNode.extraClasses = "ae-separator";
            }

            rv.push(clippingNode);
          });
        }).then(() => {
          rv.sort((aItem1, aItem2) => {
            let rv = 0;
            if ("displayOrder" in aItem1 && "displayOrder" in aItem2) {
              rv = aItem1.displayOrder - aItem2.displayOrder;
            }
            return rv;
          });

          aFnResolve(rv);
        });
      }).catch(aErr => {
        console.error("Clippings/wx::clippingsMgr.js: buildClippingsTreeHelper(): %s", aErr.message);
        aFnReject(aErr);
      });
    });
  },

  sanitizeTreeNodeTitle(aNodeTitle)
  {
    let rv = "";
    rv = this._sanitizeHTML(aNodeTitle);
    rv = rv.replace(/</g, "&lt;");
    rv = rv.replace(/>/g, "&gt;");
    
    return rv;
  },

  isFolderSelected()
  {
    let selectedNode = this.getTree().activeNode;

    if (! selectedNode) {
      return undefined;
    }
    return selectedNode.isFolder();
  },

  isSeparatorSelected()
  {
    let selectedNode = this.getTree().activeNode;

    if (! selectedNode) {
      return undefined;
    }
    return selectedNode.extraClasses == "ae-separator";
  },

  isEmpty()
  {
    let rv;
    let rootNode = this.getTree().getRootNode();
    if (rootNode.children === null) {
      // May be set to `null` (instead of an empty array) if there are zero
      // children.
      rv = true;
    }
    else {
      rv = rootNode.children.length == 0;
    }
    return rv;
  },

  // Helper
  _sanitizeHTML(aHTMLStr)
  {
    return DOMPurify.sanitize(aHTMLStr, {SAFE_FOR_JQUERY: true});
  },
  
};


let aeCopyClippingTextFormatDlg = new aeDialog("#copy-clipping-txt-fmt-dlg");

aeCopyClippingTextFormatDlg.getClippingID = function ()
{
  let rv = null;
  let tree = aeClippingsTree.getTree();
  let selectedNode = tree.activeNode;
  if (selectedNode.isFolder()) {
    throw new TypeError("The selected tree node is not a clipping!");
  }
  
  let id = parseInt(selectedNode.key);
  rv = id;

  return rv;
};

aeCopyClippingTextFormatDlg.copyClippingText = function (aButtonID)
{
  let copyFormat;
  if (aButtonID == "copy-cliptxt-html") {
    copyFormat = aeConst.COPY_AS_HTML;
  }
  else if (aButtonID == "copy-cliptxt-plain-html") {
    copyFormat = aeConst.COPY_AS_PLAIN_HTML;
  }
  else {
    copyFormat = aeConst.COPY_AS_PLAIN;
  }

  browser.runtime.sendMessage({
    msgID: "copy-clipping",
    clippingID: this.getClippingID(),
    copyFormat,
  });
};

aeCopyClippingTextFormatDlg.onFirstInit = async function ()
{
  $("#copy-cliptxt-html, #copy-cliptxt-plain, #copy-cliptxt-plain-html").on("click", aEvent => {
    this.copyClippingText(aEvent.target.id);
    this.close();
  });

  let copyAsHTML = browser.i18n.getMessage("copyAsHTML");
  let copyAsPlain = browser.i18n.getMessage("copyAsPlain");
  let copyAsPlainHTML = browser.i18n.getMessage("copyAsPlainHTML");
  copyAsHTML = aeVisual.formatShortcutKey(copyAsHTML, "F");
  copyAsPlain = aeVisual.formatShortcutKey(copyAsPlain, "C");
  copyAsPlainHTML = aeVisual.formatShortcutKey(copyAsPlainHTML, "H");

  // Compact dialog
  if (this._dlgElt.attr("data-compact")) {
    let btnLabels = {
      copyAsHTML: this._sanitizeHTML(copyAsHTML),
      copyAsPlain: this._sanitizeHTML(copyAsPlain),
      copyAsPlainHTML: this._sanitizeHTML(copyAsPlainHTML),
    };

    $("#copy-cliptxt-html, #copy-cliptxt-plain, #copy-cliptxt-plain-html").on("focus mouseover", aEvent => {
      let title = aEvent.target.dataset.title;
      $("#copy-title").html(btnLabels[title]);

    }).on("blur mouseout", aEvent => {
      $("#copy-title").text('');
    });

    aeVisual.cacheIcons(
      "copy-clipping-html-hover32.svg",
      "copy-clipping-txt-hover32.svg",
      "copy-clipping-txt-html-hover32.svg"
    );
  }
  else {
    $("#copy-cliptxt-html").html(this._sanitizeHTML(copyAsHTML));
    $("#copy-cliptxt-plain").html(this._sanitizeHTML(copyAsPlain));
    $("#copy-cliptxt-plain-html").html(this._sanitizeHTML(copyAsPlainHTML));

    aeVisual.cacheIcons(
      "copy-clipping-html-hover16.svg",
      "copy-clipping-txt-hover16.svg",
      "copy-clipping-txt-html-hover16.svg"
    );
  }

  this._dlgElt.keydown(aEvent => {
    if (aEvent.key.toUpperCase() == "F") {
      $("#copy-cliptxt-html")[0].click();
    }
    else if (aEvent.key.toUpperCase() == "C") {
      $("#copy-cliptxt-plain")[0].click();
    }
    else if (aEvent.key.toUpperCase() == "H") {
      $("#copy-cliptxt-plain-html")[0].click();
    }
  });
};

aeCopyClippingTextFormatDlg.onInit = function ()
{
  $("#copy-cliptxt-html")[0].focus();
};


aeCopyClippingTextFormatDlg._sanitizeHTML = function (aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, {SAFE_FOR_JQUERY: true});
};
