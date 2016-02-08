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
 * Portions created by the Initial Developer are Copyright (C) 2016
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://clippings/modules/aeUtils.js");
Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeInsertTextIntoTextbox.js");


//
// Clippings frame script for multi-process Firefox
//

const EXPORTED_SYMBOLS = ["addFrame"];



function addFrame(aFrameGlobal)
{
  let msgListenerMap = {};

  msgListenerMap[aeConstants.MSG_REQ_INSERT_CLIPPING] = handleRequestInsertClipping;
  msgListenerMap[aeConstants.MSG_REQ_IS_READY_FOR_SHORTCUT_MODE] = handleRequestIsReadyForShortcutMode;

  for (let msgID in msgListenerMap) {
    aFrameGlobal.addMessageListener(msgID, msgListenerMap[msgID]);
  }
}


//
// Message handler functions
//

function handleRequestInsertClipping(aMessage)
{
  aeUtils.log("aeFrameModule.js::handleRequestInsertClipping(): Handling message: " + aeConstants.MSG_REQ_INSERT_CLIPPING);

  let frameGlobal = aMessage.target;

  // frameGlobal.content - Top-level object; corresponds to the 'window' object
  // aMessage.data - JSON data, if any, that was passed with the message

  let clippingText = aMessage.data.clippingText;
  let activeElt = frameGlobal.content.document.activeElement;

  if (isElementOfType(activeElt, "HTMLInputElement")
      || isElementOfType(activeElt, "HTMLTextAreaElement")) {
    aeInsertTextIntoTextbox(activeElt, clippingText);
  }
  else if (isElementOfType(activeElt, "HTMLIFrameElement")) {
    insertTextIntoRichTextEditor(activeElt, clippingText);
  }
}


function handleRequestIsReadyForShortcutMode(aMessage)
{
  aeUtils.log("aeFrameModule.js::handleRequestIsReadyForShortcutMode(): Handling message: " + aeConstants.MSG_REQ_IS_READY_FOR_SHORTCUT_MODE);

  let frameGlobal = aMessage.target;
  let activeElt = frameGlobal.content.document.activeElement;
  let respArgs = {};

  if (isElementOfType(activeElt, "HTMLInputElement")
      || isElementOfType(activeElt, "HTMLTextAreaElement")) {
    // <input type="text"> or <textarea>
    respArgs.isTextboxFocused = true;
  }
  else if (isElementOfType(activeElt, "HTMLIFrameElement")) {
    // Rich text editor - an <iframe> with designMode == "on"
    let doc = activeElt.contentDocument;
    respArgs.isTextboxFocused = doc.designMode == "on";
  }

  aeUtils.log("aeFrameModule.js::handleRequestIsReadyForShortcutMode(): Sending message to chrome script: " + aeConstants.MSG_RESP_IS_READY_FOR_SHORTCUT_MODE);
  frameGlobal.sendAsyncMessage(aeConstants.MSG_RESP_IS_READY_FOR_SHORTCUT_MODE, respArgs);
}


//
// Helper functions
//

function isElementOfType(aElement, aTypeStr)
{
  let re = new RegExp(aTypeStr);
  return (aElement.toString().search(re) != -1);
}


function insertTextIntoRichTextEditor(aRichTextEditor, aClippingText)
{
  let doc = aRichTextEditor.contentDocument;
  let hasHTMLTags = aClippingText.search(/<[a-z1-6]+( [a-z]+(\="?.*"?)?)*>/i) != -1;
  let hasRestrictedHTMLTags = aClippingText.search(/<\?|<%|<!DOCTYPE|(<\b(html|head|body|meta|script|applet|embed|object|i?frame|frameset)\b)/i) != -1;
  let clippingText = aClippingText;

  if (hasHTMLTags) {
    let pasteAsRichText;

    if (! hasRestrictedHTMLTags) {
      let showHTMLPasteOpts = aeUtils.getPref("clippings.html_paste", 0);
      if (showHTMLPasteOpts == aeConstants.HTMLPASTE_ASK_THE_USER) {
        // Get the localized UI string
        let strBundle = Services.strings.createBundle("chrome://clippings/locale/clippings.properties");
        let chromeWnd = aRichTextEditor.ownerDocument.defaultView;
        pasteAsRichText = chromeWnd.confirm(strBundle.GetStringFromName("pasteAsHTMLPrompt"));
      }
      else {
        pasteAsRichText = showHTMLPasteOpts == aeConstants.HTMLPASTE_AS_HTML;
      }
    }

    if (!pasteAsRichText || hasRestrictedHTMLTags) {
      clippingText = clippingText.replace(/&/g, "&amp;");
      clippingText = clippingText.replace(/</g, "&lt;");
      clippingText = clippingText.replace(/>/g, "&gt;");
    }
  }
  else {
    // Could be plain text but with angle brackets, e.g. for denoting URLs
    // or email addresses, e.g. <joel_user@acme.com>, <http://www.acme.com>
    let hasOpenAngleBrackets = clippingText.search(/</) != -1;
    let hasCloseAngleBrackets = clippingText.search(/>/) != -1;

    if (hasOpenAngleBrackets) {
      clippingText = clippingText.replace(/</g, "&lt;");
    }
    if (hasCloseAngleBrackets) {
      clippingText = clippingText.replace(/>/g, "&gt;");	  
    }
  }

  let autoLineBreak = aeUtils.getPref("clippings.html_auto_line_break", true);
  let hasLineBreakTags = clippingText.search(/<br|<p/i) != -1;
  if (autoLineBreak && !hasLineBreakTags) {
    clippingText = clippingText.replace(/\n/g, "<br>");
  }

  try {
    doc.execCommand("insertHTML", false, clippingText);
  }
  catch (e) {}
}
