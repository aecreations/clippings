/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const DEBUG = false;
const HTMLPASTE_AS_FORMATTED = 1;
const HTMLPASTE_AS_IS = 2;


//
// Message handlers
//

function handleRequestNewClipping(aRequest)
{
  let rv = null;

  if (! document.hasFocus()) {
    warn("Clippings/wx::content.js: handleRequestNewClipping(): This web page does not have the focus; exiting message handler.");
    return rv;
  }

  let activeElt = getActiveElt();

  log("Clippings/wx::content.js: handleRequestNewClipping(): activeElt = " + (activeElt ? activeElt.toString() : "???"));

  if (isElementOfType(activeElt, "HTMLInputElement")
      || isElementOfType(activeElt, "HTMLTextAreaElement")) {
    // <input type="text"> or <textarea>
    let text = "";

    if (activeElt.selectionStart == activeElt.selectionEnd) {
      text = activeElt.value;
    }
    else {
      text = activeElt.value.substring(activeElt.selectionStart, 
                                       activeElt.selectionEnd);
    }

    rv = { content: text };
  }
  // Rich text editor - an <iframe> with designMode == "on"
  else if (isElementOfType(activeElt, "HTMLIFrameElement")) {
    let doc = activeElt.contentDocument;
    let selection = doc.defaultView.getSelection();

    // New (from entire contents)
    if (selection == "") {
      doc.execCommand("selectAll");
      selection = doc.defaultView.getSelection();
    }

    let text = selection.toString() || "";
    rv = { content: text };
  }
  // Rich text editor used by Gmail, Outlook.com, etc.
  else if (isElementOfType(activeElt, "HTMLDivElement")) {
    let doc = activeElt.ownerDocument;
    let selection = doc.defaultView.getSelection();

    // New (from entire contents)
    if (selection == "") {
      doc.execCommand("selectAll");
      selection = doc.defaultView.getSelection();
    }

    let text = selection.toString() || "";
    rv = { content: text };
  }
  else if (isElementOfType(activeElt, "HTMLBodyElement")) {
    let selection = activeElt.ownerDocument.getSelection();
    let text = "";
    if (selection) {
      text = selection.toString();

    }

    rv = { content: text };
  }

  if (rv !== null) {
    // Check if the text is truly empty.
    if (rv.content.trim() == "") {
      rv.content = "";
    }

    info("Content retrieved from " + activeElt.toString() + ":\n" + rv.content);
  }
  
  return rv;
}


function handleRequestInsertClipping(aRequest)
{
  let rv = null;

  if (! document.hasFocus()) {
    warn("Clippings/wx::content.js: handleRequestInsertClipping(): This web page does not have the focus; exiting message handler.");
    return rv;
  }

  let clippingText = aRequest.content;
  let htmlPaste = aRequest.htmlPaste;
  let autoLineBrk = aRequest.autoLineBreak;
  let activeElt = getActiveElt();

  log("Clippings/wx::content.js: handleRequestInsertClipping(): activeElt = " + (activeElt ? activeElt.toString() : "???"));  

  if (isElementOfType(activeElt, "HTMLInputElement")
      || isElementOfType(activeElt, "HTMLTextAreaElement")) {
    rv = insertTextIntoTextbox(activeElt, clippingText, aRequest.dispatchInputEvent);
  }
  // Rich text editor
  else if (isElementOfType(activeElt, "HTMLIFrameElement")) {
    let doc = activeElt.contentDocument;
    rv = insertTextIntoRichTextEditor(doc, clippingText, autoLineBrk, htmlPaste, aRequest.dispatchInputEvent);
  }
  // Rich text editor used by Gmail and Outlook.com
  else if (isElementOfType(activeElt, "HTMLDivElement")) {
    let doc = activeElt.ownerDocument;
    rv = insertTextIntoRichTextEditor(doc, clippingText, autoLineBrk, htmlPaste, aRequest.dispatchInputEvent);
  }
  else {
    rv = null;
  }

  return rv;
}


//
// Helper functions
//

function isElementOfType(aElement, aTypeStr)
{
  let re = new RegExp(aTypeStr);
  return (aElement.toString().search(re) != -1);
}


function insertTextIntoTextbox(aTextboxElt, aInsertedText, aDispatchInputEvent)
{
  log("Clippings/wx::content.js: >> insertTextIntoTextbox()");
  
  var text, pre, post, pos;
  text = aTextboxElt.value;

  if (aTextboxElt.selectionStart == aTextboxElt.selectionEnd) {
    var point = aTextboxElt.selectionStart;
    pre = text.substring(0, point);
    post = text.substring(point, text.length);
    pos = point + aInsertedText.length;
  }
  else {
    var p1 = aTextboxElt.selectionStart;
    var p2 = aTextboxElt.selectionEnd;
    pre = text.substring(0, p1);
    post = text.substring(p2, text.length);
    pos = p1 + aInsertedText.length;
  }

  aTextboxElt.value = pre + aInsertedText + post;
  aTextboxElt.selectionStart = pos;
  aTextboxElt.selectionEnd = pos;

  if (aDispatchInputEvent) {
    log(`Clippings/wx::content.js: Dispatching "input" event at ${aTextboxElt} element.`);
    let inputEvt = createInputEventInstance();
    aTextboxElt.dispatchEvent(inputEvt);
  }

  return true;
}


function insertTextIntoRichTextEditor(aRichTextEditorDocument, aClippingText, aAutoLineBreak, aPasteMode, aDispatchInputEvent)
{
  log("Clippings/wx::content.js: >> insertTextIntoRichTextEditor()");

  let hasHTMLTags = aClippingText.search(/<[a-z1-6]+( [a-z]+(\="?.*"?)?)*>/i) != -1;
  let hasRestrictedHTMLTags = aClippingText.search(/<\?|<%|<!DOCTYPE|(<\b(html|head|body|meta|script|applet|embed|object|i?frame|frameset)\b)/i) != -1;
  let clippingText = aClippingText;

  if (hasHTMLTags) {
    if (hasRestrictedHTMLTags || aPasteMode == HTMLPASTE_AS_IS) {
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

  let hasLineBreakTags = clippingText.search(/<br|<p/i) != -1;
  if (aAutoLineBreak && !hasLineBreakTags) {
    clippingText = clippingText.replace(/\n/g, "<br>");
  }

  try {
    aRichTextEditorDocument.execCommand("insertHTML", false, clippingText);
  }
  catch (e) {}

  if (aDispatchInputEvent) {
    log(`Clippings/wx::content.js: Dispatching "input" event at ${aRichTextEditorDocument} element.`);
    let inputEvt = createInputEventInstance();
    aRichTextEditorDocument.dispatchEvent(inputEvt);
  }

  return true;
}


function createInputEventInstance()
{
  return new Event("input", { bubbles: true, cancelable: false });
}


function isGoogleChrome()
{
  let rv = null;
  let extManifest = chrome.runtime.getManifest();

  rv = ("version_name" in extManifest);
  
  return rv;
}

function getActiveElt() {
  let activeElt = window.document.activeElement;

  if (!!activeElt && !!activeElt.shadowRoot) {
    activeElt = activeElt.shadowRoot.activeElement;
  }
  
  return activeElt;
}


function init()
{
  log(`Clippings/wx::content.js: Initializing content script for:\n${window.location.href}`);

  if (isGoogleChrome()) {
    chrome.runtime.onMessage.addListener((aRequest, aSender, aSendResponse) => {
      log("Clippings/wx::content.js: Received message '" + aRequest.msgID + "' from Chrome extension.\n" + window.location.href);

      let resp = null;
  
      if (aRequest.msgID == "new-clipping") {
        resp = handleRequestNewClipping(aRequest);
      }
      else if (aRequest.msgID == "paste") {
        resp = handleRequestInsertClipping(aRequest);
      }

      if (resp !== null) {
        aSendResponse(resp);
      }
    });
  }
  else {
    // Firefox
    browser.runtime.onMessage.addListener(aRequest => {
      log(`Clippings/wx::content.js: Received message "${aRequest.msgID}" from extension.\n${window.location.href}`);

      let resp = null;
  
      if (aRequest.msgID == "new-clipping") {
        resp = handleRequestNewClipping(aRequest);
      }
      else if (aRequest.msgID == "paste-clipping") {
        resp = handleRequestInsertClipping(aRequest);
      }
    
      if (resp !== null) {
        return Promise.resolve(resp);
      }
    });
  }
}

init();


//
// Error reporting and debugging output
//

function onError(aError)
{
  console.error("Clippings/wx::content.js: " + aError);
}


function log(aMessage)
{
  if (DEBUG) { console.log(aMessage); }
}


function info(aMessage)
{
  if (DEBUG) { console.info(aMessage); }
}


function warn(aMessage)
{
  if (DEBUG) { console.warn(aMessage); }
}
