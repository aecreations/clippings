/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const DEBUG = false;
const HTMLPASTE_AS_FORMATTED = 1;
const HTMLPASTE_AS_IS = 2;
const FOCUSABLE_ELTS_STOR = "button:not([disabled])";

let gLastFocusedElt;


browser.runtime.onMessage.addListener(aRequest => {
  log(`Clippings/wx: Content script received message "${aRequest.msgID}" from WebExtension.\n${window.location.href}`);

  let resp = null;
  
  switch (aRequest.msgID) {
  case "new-clipping":
    resp = handleRequestNewClipping(aRequest);
    break;

  case "paste-clipping":
    resp = handleRequestInsertClipping(aRequest);
    break;

  case "get-wnd-geometry":
    resp = handleRequestGetWndGeometry(aRequest);
    break;

  case "show-lightbox":
    resp = handleRequestShowLightbox(aRequest);
    break;

  default:
    break;
  }
  
  if (resp !== null) {
    return Promise.resolve(resp);
  }
});


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
    if (doc) {
      let selection = doc.defaultView.getSelection();

      // New (from entire contents)
      if (selection == "") {
        doc.execCommand("selectAll");
        selection = doc.defaultView.getSelection();
      }

      let text = selection.toString() || "";
      rv = { content: text };
    }
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
    if (selection == "") {
      let doc = activeElt.ownerDocument;
      if (activeElt.contentEditable || doc.designMode == "on") {
        doc.execCommand("selectAll");
        selection = doc.defaultView.getSelection();
      }
    }

    let text = selection.toString() || "";
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
    warn(`Clippings/wx::content.js: handleRequestInsertClipping(): The web page at ${document.URL} does not have the focus; exiting message handler.`);
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
    if (doc && doc.body.hasAttribute("contenteditable")
        && doc.body.getAttribute("contenteditable") != "false") {
      rv = insertTextIntoRichTextEditor(doc, clippingText, autoLineBrk, htmlPaste, aRequest.dispatchInputEvent);
    }
    else {
      warn("Clippings/wx::content.js: handleRequestInsertClipping(): Document element is null or <body> doesn't have 'contenteditable' attribute set; exiting message handler");
    }
  }
  // Rich text editor used by Gmail and Outlook.com
  else if (isElementOfType(activeElt, "HTMLDivElement")) {
    if (activeElt.classList.contains("ck-content")) {
      info("Clippings/wx::content.js: handleRequestInsertClipping(): Detected CKEditor.");
    }

    let doc = activeElt.ownerDocument;
    rv = insertTextIntoRichTextEditor(doc, clippingText, autoLineBrk, htmlPaste, aRequest.dispatchInputEvent);
  }
  // Experimental - enable from background script
  else if (isElementOfType(activeElt, "HTMLBodyElement") && aRequest.pasteIntoHTMLBodyElt
           && (activeElt.contentEditable || activeElt.ownerDocument.designMode == "on")) {
    let doc = activeElt.ownerDocument;
    rv = insertTextIntoRichTextEditor(doc, clippingText, autoLineBrk, htmlPaste, aRequest.dispatchInputEvent);
  }
  else {
    rv = null;
  }

  return rv;
}


function handleRequestGetWndGeometry(aRequest)
{
  let rv = {
    w: window.outerWidth,
    h: window.outerHeight,
    x: window.screenX,
    y: window.screenY,
  };

  return rv;
}


function handleRequestShowLightbox(aRequest)
{
  let rv = null;
  
  if (isLightboxLoaded()) {
    info("Clippings/wx: The lightbox modal is already displayed.");
    rv = {status: "ok"};
  }
  else {
    loadLightboxUI();

    let ovl = document.querySelector("#ae-clippings-ui > .ae-clippings-lightbox-bkgrd");
    let lbox = document.querySelector("#ae-clippings-ui > #ae-clippings-tm-lightbox");

    if (ovl && lbox) {
      let msg = browser.i18n.getMessage(aRequest.strKey);
      let txt = document.createTextNode(msg);
      document.getElementById("ae-clippings-lightbox-body").appendChild(txt);
      
      ovl.classList.add("ae-clippings-lightbox-show");
      lbox.classList.add("ae-clippings-lightbox-show");
      document.querySelector("#ae-clippings-lightbox-btn-accept").focus();
      rv = {status: "ok"};
    }
    else {
      console.error("Lightbox: Unable to locate lightbox DOM elements!");
      rv = {status: "error"};
    }
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

  log(`Clippings/wx::content.js: insertTextIntoTextbox(): Inserting into textbox ${aTextboxElt}`);
  
  aTextboxElt.value = pre + aInsertedText + post;
  aTextboxElt.selectionStart = pos;
  aTextboxElt.selectionEnd = pos;

  if (aDispatchInputEvent) {
    let inputEvt = createInputEventInstance();
    aTextboxElt.dispatchEvent(inputEvt);
  }

  return true;
}


function insertTextIntoRichTextEditor(aRichTextEditorDocument, aClippingText, aAutoLineBreak, aPasteMode, aDispatchInputEvent)
{
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

  log(`Clippings/wx::content.js: insertTextIntoRichTextEditor(): Inserting HTML content into rich text editor ${aRichTextEditorDocument}`);

  try {
    aRichTextEditorDocument.execCommand("insertHTML", false, clippingText);
  }
  catch (e) {}

  if (aDispatchInputEvent) {
    let inputEvt = createInputEventInstance();
    aRichTextEditorDocument.dispatchEvent(inputEvt);
  }

  return true;
}


function createInputEventInstance()
{
  return new Event("input", { bubbles: true, cancelable: false });
}


function getActiveElt() {
  let activeElt = window.document.activeElement;

  if (!!activeElt && !!activeElt.shadowRoot) {
    activeElt = activeElt.shadowRoot.activeElement;
  }
  
  return activeElt;
}


function loadLightboxUI()
{
  let ovl = document.createElement("div");
  ovl.className = "ae-clippings-lightbox-bkgrd";

  let lbox = document.createElement("div");
  lbox.id = "ae-clippings-tm-lightbox";
  lbox.className = "ae-clippings-lightbox";

  let img = document.createElement("div");
  img.id = "ae-clippings-lightbox-icon";

  let title = document.createElement("div");
  title.id = "ae-clippings-lightbox-title";
  let titleTxt = document.createTextNode(browser.i18n.getMessage("extName"));
  title.appendChild(titleTxt);

  let titleBar = document.createElement("div");
  titleBar.id = "ae-clippings-lightbox-titlebar";
  titleBar.appendChild(img);
  titleBar.appendChild(title);
  lbox.appendChild(titleBar);

  // Message box text
  let body = document.createElement("div");
  body.id = "ae-clippings-lightbox-body";
  lbox.appendChild(body);

  let dlgBtns = document.createElement("div");
  dlgBtns.className = "ae-clippings-lightbox-dlg-btns";
  let btn = document.createElement("button");
  btn.id = "ae-clippings-lightbox-btn-accept";
  btn.className = "default";
  btn.addEventListener("click", aEvent => {unloadLightboxUI()});
  
  let btnCapt = document.createTextNode(browser.i18n.getMessage("btnOK"));
  btn.appendChild(btnCapt);
  dlgBtns.appendChild(btn);
  lbox.appendChild(dlgBtns);

  let wrapper = document.createElement("div");
  wrapper.id = "ae-clippings-ui";
  wrapper.appendChild(ovl);
  wrapper.appendChild(lbox);
  document.body.prepend(wrapper);

  initLightboxKeyboardNav();
}


function initLightboxKeyboardNav()
{
  gLastFocusedElt = document.activeElement;

  let lightbox = document.getElementById("ae-clippings-tm-lightbox");
  if (! lightbox) {
    console.error("Clippings/wx: initLightboxKeyboardNav(): Unable to locate tab modal lightbox element!");
    return;
  }

  let focusableElts = lightbox.querySelectorAll(FOCUSABLE_ELTS_STOR);
  let firstTabStop = focusableElts[0];
  let lastTabStop = focusableElts[focusableElts.length - 1];

  lightbox.addEventListener("keydown", aEvent => {
    if (aEvent.key == "Tab") {
      if (aEvent.shiftKey) {
        if (document.activeElement == firstTabStop) {
          aEvent.preventDefault();
          lastTabStop.focus();
        }
      }
      else {
        if (document.activeElement == lastTabStop) {
          aEvent.preventDefault();
          firstTabStop.focus();
        }
      }
    }
  });

  firstTabStop.focus();
}


function unloadLightboxUI()
{
  document.querySelector("#ae-clippings-ui > #ae-clippings-tm-lightbox").classList.remove("ae-clippings-lightbox-show");
  document.querySelector("#ae-clippings-ui > .ae-clippings-lightbox-bkgrd").classList.remove("ae-clippings-lightbox-show");

  let wrapper = document.getElementById("ae-clippings-ui");
  document.body.removeChild(wrapper);
}


function isLightboxLoaded()
{
  let lightbox = document.querySelector("#ae-clippings-ui > #ae-clippings-tm-lightbox");

  return (lightbox && lightbox.classList.contains("ae-clippings-lightbox-show"));
}


//
// Utilities
//

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
