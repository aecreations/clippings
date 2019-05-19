/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const WNDH_PLCHLDR_MULTI = 284;
const WNDH_PLCHLDR_MULTI_SHORT = 240;
const DLG_HEIGHT_ADJ_WINDOWS = 20;

const REGEXP_CUSTOM_PLACEHOLDER = /\$\[([\w\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]+)(\{([\w \-\.\?_\/\(\)!@#%&;:,'"$£¥€*¡¢\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF\|])+\})?\]/m;

let gClippings = null;
let gPlaceholders = null;
let gPlaceholdersWithDefaultVals = null;
let gClippingContent = null;


// DOM utility
function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, { SAFE_FOR_JQUERY: true });
}


// Page initialization
$(() => {
  chrome.history.deleteUrl({ url: window.location.href });

  gClippings = chrome.extension.getBackgroundPage();

  if (! gClippings) {
    throw new Error("Clippings/wx::placeholderPrompt.js: Failed to retrieve parent browser window!");
  }

  if (gClippings.isGoogleChrome()) {
    chrome.runtime.sendMessage({ msgID: "init-placeholder-prmt-dlg" }, aResp => {
      // TO DO: Same logic as for Firefox.
    });
  }
  else {
    // Firefox
    let sendMsg = browser.runtime.sendMessage({
      msgID: "init-placeholder-prmt-dlg"
    });

    sendMsg.then(aResp => {
      gPlaceholders = aResp.placeholders;
      gPlaceholdersWithDefaultVals = aResp.placeholdersWithDefaultVals;
      gClippingContent = aResp.content;

      if (gPlaceholders.length == 1) {
        let plchldr = gPlaceholders[0];
        $("#plchldr-single").show();
        $("#single-prmt-label").text(chrome.i18n.getMessage("plchldrPromptSingleDesc", plchldr));
        $("#single-prmt-input").focus();

        if (plchldr in gPlaceholdersWithDefaultVals) {
          let defaultVal = gPlaceholdersWithDefaultVals[plchldr];

          if (defaultVal.indexOf("|") == -1) {
            $("#single-prmt-input").val(defaultVal).select();
          }
          else {
            let vals = defaultVal.split("|");
            let optionElts = "";
            for (let val of vals) {
              optionElts += sanitizeHTML(`<option value="${val}">${val}</option>`);
            }
            $("#single-prmt-input").replaceWith(sanitizeHTML(`<select id="single-prmt-input" class="browser-style">${optionElts}</select>`));
            $("#single-prmt-input").focus();
          }
        }
      }
      else {
        $("#plchldr-multi").show();
        let height = gPlaceholders.length == 2 ? WNDH_PLCHLDR_MULTI_SHORT : WNDH_PLCHLDR_MULTI;
        if (gClippings.getOS() == "win") {
          height += DLG_HEIGHT_ADJ_WINDOWS;
        }
        
        chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { height }, aWnd => {
          for (let plchldr of gPlaceholders) {
            let defaultVal = "";
            if (plchldr in gPlaceholdersWithDefaultVals) {
              defaultVal = gPlaceholdersWithDefaultVals[plchldr];
            }

            if (defaultVal && defaultVal.indexOf("|") != -1) {
              let vals = defaultVal.split("|");
              let optionElts = "";
              for (let val of vals) {
                optionElts += sanitizeHTML(`<option value="${val}">${val}</option>`);
              }
              $("#plchldr-table").append(sanitizeHTML(`<div class="ph-row browser-style" data-placeholder="${plchldr}"><label class="ph-name">${plchldr}:</label><select class="ph-input browser-style">${optionElts}</select></div>`));
            }
            else {
              $("#plchldr-table").append(sanitizeHTML(`<div class="ph-row browser-style" data-placeholder="${plchldr}"><label class="ph-name">${plchldr}:</label><input type="text" class="ph-input" value="${defaultVal}"/></div>`));
            }
          }
          $("#plchldr-table").fadeIn("fast");

          let firstInputElt = $(".ph-input")[0];
          if (firstInputElt.nodeName == "input") {
            firstInputElt.select();
          }
          firstInputElt.focus();
        });
      }
    });
  }

  $("#btn-accept").click(aEvent => { accept(aEvent) });
  $("#btn-cancel").click(aEvent => { cancel(aEvent) });

  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  browser.windows.getCurrent(aWnd => {
    browser.windows.update(aWnd.id, {
      width: aWnd.width + 1,
      focused: true,
    });
  });
});


$(window).keydown(aEvent => {
  function isTextboxFocused(aEvent) {
    return (aEvent.target.tagName == "INPUT" || aEvent.target.tagName == "TEXTAREA");
  }
  
  if (aEvent.key == "Enter") {
    accept(aEvent);
  }
  else if (aEvent.key == "Escape") {
    cancel(aEvent);
  }
  else if (aEvent.key == "/" || aEvent.key == "'") {
    if (! isTextboxFocused(aEvent)) {
      aEvent.preventDefault();  // Suppress quick find in page.
    }
  }
  else if (aEvent.key == "F5") {
    aEvent.preventDefault();  // Suppress browser reload.
  }
});


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


function accept(aEvent)
{
  let replcIdx = -1;
  
  // Remember the value of the same placeholder that was filled in previously.
  let knownTags = {};

  function fnReplaceSingle(aMatch, aP1, aP2, aP3, aOffset, aString)
  {
    let rv = "";
    let varName = aP1;

    if (varName in knownTags) {
      return knownTags[varName];
    }

    let inputElt = document.getElementById("single-prmt-input");
    if (inputElt.tagName == "INPUT") {
      rv = inputElt.value;
    }
    else if (inputElt.tagName == "SELECT") {
      rv = inputElt.options[inputElt.selectedIndex].textContent;
    }

    knownTags[varName] = rv;
    return rv;
  }

  function fnReplaceMulti(aMatch, aP1, aP2, aP3, aOffset, aString)
  {
    let rv = "";

    //console.log("placeholderPrompt.js::fnReplaceMulti(): matched string: " + aMatch + `(length ${aMatch.length} chars)\naP1: ${aP1}; aP2: ${aP2}; aP3: ${aP3}\noffset: ${aOffset}`);

    let varName = aP1;

    if (varName in knownTags) {
      return knownTags[varName];
    }

    let inputElt = $(".ph-input")[replcIdx];
    
    if (inputElt.tagName == "INPUT") {
      rv = inputElt.value;
    }
    else if (inputElt.tagName == "SELECT") {
      rv = inputElt.options[inputElt.selectedIndex].textContent;
    }

    knownTags[varName] = rv;
    return rv;
  }
  
  let content = "";

  if (gPlaceholders.length == 1) {
    content = gClippingContent.replace(REGEXP_CUSTOM_PLACEHOLDER, fnReplaceSingle);
  }
  else {
    content = gClippingContent;
    for (replcIdx = 0; replcIdx < gPlaceholders.length; replcIdx++) {
      content = content.replace(REGEXP_CUSTOM_PLACEHOLDER, fnReplaceMulti);
    }
  }

  //console.log("Content:" + content);
  
  chrome.runtime.sendMessage({
    msgID: "paste-clipping-with-plchldrs",
    processedContent: content
  });
  
  closeDlg();
}


function cancel(aEvent)
{
  closeDlg();
}


function closeDlg()
{
  chrome.runtime.sendMessage({ msgID: "close-placeholder-prmt-dlg" });
  chrome.windows.remove(chrome.windows.WINDOW_ID_CURRENT);
}
