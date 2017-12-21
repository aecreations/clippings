/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const WNDH_PLCHLDR_MULTI = 292;
const WNDH_PLCHLDR_MULTI_SHORT = 242;

let gClippings = null;
let gPlaceholders = null;
let gClippingContent = null;


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
      gClippingContent = aResp.content;
      
      if (gPlaceholders.length == 1) {
        $("#plchldr-single").show();
        $("#single-prmt-label").text(`Enter value for "${gPlaceholders[0]}":`);
        $("#single-prmt-input").focus();
      }
      else {
        $("#plchldr-multi").show();
        let height = gPlaceholders.length == 2 ? WNDH_PLCHLDR_MULTI_SHORT : WNDH_PLCHLDR_MULTI;
        
        chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { height }, aWnd => {
          for (let plchldr of gPlaceholders) {
            $("#plchldr-table").append(`<div class="ph-row browser-style" data-placeholder="${plchldr}"><label class="ph-name">${plchldr}:</label><br/><input type="text" class="ph-input"/></div>`);
          }
          $("#plchldr-table").fadeIn("fast");
          $(".ph-input")[0].focus();
        });
      }
    });
  }

  $("#btn-accept").click(aEvent => { accept(aEvent) });
  $("#btn-cancel").click(aEvent => { cancel(aEvent) });
});


$(window).keypress(aEvent => {
  if (aEvent.key == "Enter") {
    accept(aEvent);
  }
  else if (aEvent.key == "Escape") {
    cancel(aEvent);
  }
});


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


function accept(aEvent)
{
  let content = "";

  if (gPlaceholders.length == 1) {
    content = gClippingContent.replace(
      new RegExp("\\$\\[" + gPlaceholders[0] + "\\]", "g"),
      $("#single-prmt-input").val()
    );
  }
  else {
    content = gClippingContent;
    for (let i = 0; i < gPlaceholders.length; i++) {
      let plchldr = gPlaceholders[i];
      content = content.replace(
        new RegExp("\\$\\[" + plchldr + "\\]", "g"),
        $(".ph-input")[i].value
      );
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
