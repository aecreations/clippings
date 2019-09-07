/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */

for (let node of document.querySelectorAll("[data-i18n]")) {
  let [text, attr] = node.dataset.i18n.split("|");
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
}
