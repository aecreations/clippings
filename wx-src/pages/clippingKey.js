/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */


$(document).ready(() => {
  $("#btn-cancel").click(aEvent => { cancel(aEvent) });
});


$(window).keypress(aEvent => {
  if (aEvent.key == "Escape" || aEvent.key == "Enter") {
    cancel(aEvent);
  }
  else if (aEvent.key == "F1") {
    // TO DO: Show shortcut key help.
  }
  else if (aEvent.key == "Tab") {
    // TO DO: Switch to search by name mode.
  }
  else {
    let msg = {
      msgID: "paste-shortcut-key",
      shortcutKey: aEvent.key
    }
    browser.runtime.sendMessage(msg);
    closeWnd();
  }
});


function cancel(aEvent)
{
  closeWnd();
}


function closeWnd()
{
  chrome.windows.remove(chrome.windows.WINDOW_ID_CURRENT);
}
