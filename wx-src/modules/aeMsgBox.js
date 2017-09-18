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


let aeMsgBox = {
  MSG_UNKNOWN: 0,
  MSG_UNAVAILABLE: 1,
  MSG_NO_TEXT_SELECTED: 2,
  MSG_BROWSER_WND_NOT_FOCUSED: 3,
  MSG_CLIPPING_NOT_FOUND: 4,
  MSG_NO_ACTIVE_BROWSER_TAB: 5,
  MSG_RETRY_PAGE_BUSY: 6,
  MSG_RETRY_PAGE_NOT_LOADED: 7,

  msg: [
    "No help is available (so leave me alone)",
    "The selected option is not available right now.",
    "No text was selected. Please select text first.",
    "Please return to the browser window and try again.",
    "Unable to find the selected clipping!",
    "Unable to paste clipping because there is no active browser tab.",
    "The page is currently busy. Wait for the page to finish, and then try again.",
    "Unable to retrieve selected text. Reload the page, and then try again."
  ]
};
