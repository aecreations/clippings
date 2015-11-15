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
 * Portions created by the Initial Developer are Copyright (C) 2005-2015
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");


function initPrefPaneGeneral()
{
  initDlg();

  // Workaround to height rendering issue on the <description> element of the
  // pref dialog.  Do not do this on platforms where pref dialogs dynamically
  // adjust their heights when switching between pref panes (e.g. Mac OS X), as
  // it will interfere with the dialog height.
  var prefs = Services.prefs;
  var fadeInEffect = prefs.getBoolPref("browser.preferences.animateFadeIn");
  if (! fadeInEffect.value) {
    window.sizeToContent();
    var vbox = $("paste-html-vbox");
    vbox.height = vbox.boxObject.height;
    window.sizeToContent();
  }

  var shortcutKeyPrefix;
  if (aeUtils.getOS() == "Darwin") {
    shortcutKeyPrefix = gStrBundle.getString("shortcutKeyPrefixMac");
  }
  else {
    shortcutKeyPrefix = gStrBundle.getString("shortcutKeyPrefix");
  }

  if (aeUtils.getHostAppID() == aeConstants.HOSTAPP_TB_GUID) {    
    $("paste-html-formatted-clipping").value = gStrBundle.getString("htmlPasteOptionsTB");
    $("tab-modal-prmt").hidden = true;
    $("always-save-src-url").hidden = true;
  }

  var shortcutKeyStr = gStrBundle.getFormattedString("shortcutMode", [shortcutKeyPrefix]);
  $("enable-shortcut-key").label = shortcutKeyStr;
  $("enable-shortcut-key").accessKey = gStrBundle.getString("shortcutModeAccessKey");

  var useClipboard = aeUtils.getPref("clippings.use_clipboard", false);
  if (! useClipboard) {
    togglePasteOptionsCheckedState();
  }
}


function togglePasteOptionsCheckedState() 
{
  var useClipboard = $("use-clipboard");
  var htmlPasteOptions = $("html-paste-options");
  var autoLineBreak = $("html-auto-line-break");

  $("paste-html-formatted-clipping").disabled = !useClipboard.checked;
  htmlPasteOptions.disabled = !useClipboard.checked;
  autoLineBreak.disabled = !useClipboard.checked;

  if (! useClipboard.checked) {
    htmlPasteOptions.selectedIndex = 2;
    autoLineBreak.checked = false;
  }
}


function showChangedPrefMsg() 
{
  var strKey;
  var hostAppID = aeUtils.getHostAppID();

  if (hostAppID == aeConstants.HOSTAPP_FX_GUID) {
    strKey = "prefChangeMsgFx";
  }
  else if (hostAppID == aeConstants.HOSTAPP_TB_GUID) {
    strKey = "prefChangeMsgTb";
  }

  aeUtils.alertEx(document.title, gStrBundle.getString(strKey));
}
