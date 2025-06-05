/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const WNDH_PLCHLDR_MULTI = 318;
const WNDH_PLCHLDR_MULTI_SHORT = 272;
const WNDH_PLCHLDR_MULTI_VSHORT = 212;
const DLG_HEIGHT_ADJ_WINDOWS = 20;
const DLG_HEIGHT_ADJ_LINUX = 60;

const REGEXP_CUSTOM_PLACEHOLDER = /\$\[([\w\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]+)(\{([\w \-\.\?_\/\(\)!@#%&;:,'"$£¥€*¡¢\u{0080}-\u{10FFFF}\|])+\})?\]/mu;

let gPlaceholders = null;
let gPlaceholdersWithDefaultVals = null;
let gSamePlchldrs = {};
let gClippingContent = null;
let gBrowserTabID = null;
let gDlgMode = 0;


// DOM utility
function sanitizeHTML(aHTMLStr)
{
  return DOMPurify.sanitize(aHTMLStr, {SAFE_FOR_JQUERY: true});
}


// Page initialization
$(async () => {
  let params = new URLSearchParams(window.location.search);
  gBrowserTabID = Number(params.get("tabID"));
  gDlgMode = Number(params.get("mode"));

  if (gDlgMode > 0) {
    document.title = browser.i18n.getMessage("mnuCopyClipTxt");
  }

  let [brws, platform] = await Promise.all([
    browser.runtime.getBrowserInfo(),
    browser.runtime.getPlatformInfo(),
  ]);
  document.body.dataset.os = platform.os;
  aeInterxn.init(platform.os);

  let resp = await browser.runtime.sendMessage({
    msgID: "init-placeholder-prmt-dlg"
  });

  let clippingName = sanitizeHTML(resp.clippingName);
  gPlaceholders = resp.placeholders;
  gPlaceholdersWithDefaultVals = resp.placeholdersWithDefaultVals;
  gClippingContent = resp.content;

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
    $("#plchldr-single-content > .clipping-name").text(clippingName);
    let plchldr = gPlaceholders[0];
    $("#plchldr-single").show();
    $("#single-prmt-label").text(browser.i18n.getMessage("plchldrPromptSingleDesc", plchldr));
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
    $("#plchldr-multi-content > .clipping-name").text(clippingName);

    let plchldrSet = new Set(gPlaceholders);
    let height;
    switch (plchldrSet.size) {
    case 1:
      height = WNDH_PLCHLDR_MULTI_VSHORT;
      let plchldr = gPlaceholders[0];
      $("#multi-prmt-label").text(browser.i18n.getMessage("plchldrPromptSingleDesc", plchldr));
      $("#plchldr-table").addClass("single-plchldr-multi-use");
      break;
    case 2:
      height = WNDH_PLCHLDR_MULTI_SHORT;
      break;
    default:
      height = WNDH_PLCHLDR_MULTI;
      break;
    }

    if (platform.os == "win") {
      height += DLG_HEIGHT_ADJ_WINDOWS;
    }
    else if (platform.os == "linux" && aeVersionCmp(brws.version, "137.0") >= 0) {
      height += DLG_HEIGHT_ADJ_LINUX;
    }

    await browser.windows.update(browser.windows.WINDOW_ID_CURRENT, {height});

    for (let i = 0; i < gPlaceholders.length; i++) {
      let plchldr = gPlaceholders[i];
      let defaultVal = "";
      if (plchldr in gPlaceholdersWithDefaultVals) {
        defaultVal = gPlaceholdersWithDefaultVals[plchldr];
      }

      let classNames = "ph-row";
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

    // A single placeholder is used multiple times. Make the UI resemble
    // single placeholder mode, hiding the <label> with placeholder name
    // directly above the input field.
    if (plchldrSet.size == 1) {
      $(".ph-name").hide();
    }
    
    $("#plchldr-table").fadeIn("fast");

    let firstInputElt = $(".ph-input")[0];
    if (firstInputElt.nodeName == "input") {
      firstInputElt.select();
    }
    firstInputElt.focus();
  }

  $("#btn-accept").click(aEvent => { accept(aEvent) });
  $("#btn-cancel").click(aEvent => { cancel(aEvent) });

  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  let wnd = await browser.windows.getCurrent();
  browser.windows.update(wnd.id, {
    width: wnd.width + 1,
    focused: true,
  });
});


$(window).keydown(aEvent => {
  if (aEvent.key == "Enter") {
    // Avoid duplicate invocation due to pressing ENTER while OK button
    // is focused.
    if (aEvent.target.id != "btn-accept") {
      accept(aEvent);
    }
  }
  else if (aEvent.key == "Escape") {
    cancel(aEvent);
  }
  else {
    aeInterxn.suppressBrowserShortcuts(aEvent, aeConst.DEBUG);
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

  let msg;
  if (gDlgMode > 0) {
    msg = {
      msgID: "copy-clipping-with-plchldrs",
      copyMode: gDlgMode,
      processedContent: content,
    }
  }
  else {
    msg = {
      msgID: "paste-clipping-with-plchldrs",
      processedContent: content,
      browserTabID: gBrowserTabID,
    };
  }
  
  browser.runtime.sendMessage(msg);
  closeDlg();
}


function cancel(aEvent)
{
  closeDlg();
}


async function closeDlg()
{
  await browser.runtime.sendMessage({msgID: "close-placeholder-prmt-dlg"});
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}
