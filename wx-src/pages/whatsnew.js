/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function $(aID)
{
  return document.getElementById(aID);
}


async function init()
{
  browser.history.deleteUrl({ url: window.location.href });

  let donateCTA = $("donate-cta");
  donateCTA.appendChild(createTextNode("donateCta1"));
  donateCTA.appendChild(createTextNodeWithSpc());
  donateCTA.appendChild(createHyperlink("donateLink", aeConst.DONATE_URL));
  donateCTA.appendChild(createTextNode("donateCta2"));
  
  $("btn-close").addEventListener("click", async (aEvent) => { closePage() }); 
}


function createTextNode(aStringKey)
{
  let rv = document.createTextNode(browser.i18n.getMessage(aStringKey));
  return rv;
}


function createTextNodeWithSpc()
{
  let rv = document.createTextNode("\u00a0");
  return rv;
}


function createEltWithID(aNodeName, aNodeID, aStringKey)
{
  let rv = document.createElement(aNodeName);
  rv.id = aNodeID;
  let text = document.createTextNode(browser.i18n.getMessage(aStringKey));
  rv.appendChild(text);
  return rv;
}


function createEltWithClass(aNodeName, aNodeClass, aStringKey)
{
  let rv = document.createElement(aNodeName);
  rv.className = aNodeClass;
  let text = document.createTextNode(browser.i18n.getMessage(aStringKey));
  rv.appendChild(text);
  return rv;
}


function createHyperlink(aStringKey, aURL)
{
  let rv = document.createElement("a");
  rv.setAttribute("href", aURL);
  let text = document.createTextNode(browser.i18n.getMessage(aStringKey));
  rv.appendChild(text);
  return rv; 
}


async function closePage()
{
  let tab = await browser.tabs.getCurrent();
  browser.tabs.remove(tab.id);
}


document.addEventListener("DOMContentLoaded", async (aEvent) => { init() });

document.addEventListener("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.getAttribute("type") != "text") {
    aEvent.preventDefault();
  }
});
