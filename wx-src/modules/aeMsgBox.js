/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


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
