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
let gSamePlchldrs = {};
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

      let plchldrCount = {};

      gPlaceholders.forEach(aPlchldr => {
        if (aPlchldr in plchldrCount) {
          plchldrCount[aPlchldr]++;
        }
        else {
          plchldrCount[aPlchldr] = 1;
        }
      });

      for (let plchldr in plchldrCount) {
        if (plchldrCount[plchldr] > 1) {
          gSamePlchldrs[plchldr] = [];
        }
      }

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

        let plchldrSet = new Set(gPlaceholders);
        let height = plchldrSet.size <= 2 ? WNDH_PLCHLDR_MULTI_SHORT : WNDH_PLCHLDR_MULTI;

        if (gClippings.getOS() == "win") {
          height += DLG_HEIGHT_ADJ_WINDOWS;
        }
        
        chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { height }, aWnd => {
          for (let i = 0; i < gPlaceholders.length; i++) {
            let plchldr = gPlaceholders[i];
            let defaultVal = "";
            if (plchldr in gPlaceholdersWithDefaultVals) {
              defaultVal = gPlaceholdersWithDefaultVals[plchldr];
            }

            let classNames = "ph-row browser-style";
            if (plchldr in gSamePlchldrs && gSamePlchldrs[plchldr].length > 0) {
              classNames += " duplicate-plchldr";
            }

            if (defaultVal && defaultVal.indexOf("|") != -1) {
              let vals = defaultVal.split("|");
              let optionElts = "";
              for (let val of vals) {
                optionElts += sanitizeHTML(`<option value="${val}">${val}</option>`);
              }
              $("#plchldr-table").append(sanitizeHTML(`<div class="${classNames}" data-placeholder="${plchldr}"><label class="ph-name">${plchldr}:</label><select class="ph-input browser-style">${optionElts}</select></div>`));
            }
            else {
              $("#plchldr-table").append(sanitizeHTML(`<div class="${classNames}" data-placeholder="${plchldr}"><label class="ph-name">${plchldr}:</label><input type="text" class="ph-input" value="${defaultVal}"/></div>`));
            }

            if (plchldr in gSamePlchldrs) {
              gSamePlchldrs[plchldr].push(i);
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
  let multiReplcIdx = -1;

  function fnReplaceSingle(aMatch, aP1, aP2, aP3, aOffset, aString)
  {
    let rv = "";
    let inputElt = document.getElementById("single-prmt-input");
    if (inputElt.tagName == "INPUT") {
      rv = inputElt.value;
    }
    else if (inputElt.tagName == "SELECT") {
      rv = inputElt.options[inputElt.selectedIndex].textContent;
    }

    return rv;
  }

  function fnReplaceMulti(aMatch, aP1, aP2, aP3, aOffset, aString)
  {
    let rv = "";
    let inputElt = $(".ph-input")[multiReplcIdx];
    if (inputElt.tagName == "INPUT") {
      rv = inputElt.value;
    }
    else if (inputElt.tagName == "SELECT") {
      rv = inputElt.options[inputElt.selectedIndex].textContent;
    }

    return rv;
  }

  // Populate hidden duplicate placeholder fields.
  for (let plchldr in gSamePlchldrs) {
    let phRows = $(`.ph-row[data-placeholder="${plchldr}"]`);
    let phInputEltFirst = phRows[0].children[1];
    let usrSelxn;
    if (phInputEltFirst.tagName == "INPUT") {
      usrSelxn = phInputEltFirst.value;
    }
    else if (phInputEltFirst.tagName == "SELECT") {
      usrSelxn = phInputEltFirst.selectedIndex;
    }

    for (let i = 1; i < phRows.length; i++) {
      let phInputElt = phRows[i].children[1];
      if (phInputElt.tagName == "INPUT") {
        phInputElt.value = usrSelxn;
      }
      else if (phInputElt.tagName == "SELECT") {
        phInputElt.selectedIndex = usrSelxn;
      }
    }
  }
  
  let content = "";

  if (gPlaceholders.length == 1) {
    content = gClippingContent.replace(REGEXP_CUSTOM_PLACEHOLDER, fnReplaceSingle);
  }
  else {
    content = gClippingContent;
    for (multiReplcIdx = 0; multiReplcIdx < gPlaceholders.length; multiReplcIdx++) {
      content = content.replace(REGEXP_CUSTOM_PLACEHOLDER, fnReplaceMulti);
    }
  }

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
