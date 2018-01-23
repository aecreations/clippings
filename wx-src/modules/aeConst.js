/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let aeConst = {
  DEBUG: true,
  
  // Extension GUID
  EXTENSION_ID: "{91aa5abe-9de4-4347-b7b5-322c38dd9271}",

  // Host app GUIDs
  HOSTAPP_FX_GUID: "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
  HOSTAPP_TB_GUID: "{3550f703-e582-4d05-9a08-453d09bdfdc6}",

  // Constants for HTML paste options
  HTMLPASTE_ASK_THE_USER: 0,
  HTMLPASTE_AS_FORMATTED: 1,
  HTMLPASTE_AS_IS:        2,

  // Keyboard pasting mode
  PASTEACTION_SHORTCUT_KEY:   1,
  PASTEACTION_SEARCH_CLIPPING: 2,

  // Folder IDs
  ROOT_FOLDER_ID: 0,
  DELETED_ITEMS_FLDR_ID: -1,

  // Export to file
  CLIPPINGS_EXPORT_FILENAME: "clippings.json",
  HTML_EXPORT_FILENAME: "clippings.html",
  CLIPPINGS_BACKUP_FILENAME: "clippings-backup.json",
};
