/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


let aeConst = {
  DEBUG: false,
  
  // Extension GUID
  EXTENSION_ID: "{91aa5abe-9de4-4347-b7b5-322c38dd9271}",

  // Host app GUIDs
  HOSTAPP_FX_GUID: "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
  HOSTAPP_TB_GUID: "{3550f703-e582-4d05-9a08-453d09bdfdc6}",

  // Native messaging helper app
  SYNC_CLIPPINGS_APP_NAME: "syncClippings",

  // Keyboard shortcut
  CMD_CLIPPINGS_KEYBOARD_PASTE: "ae-clippings-paste-clipping",
  
  // Constants for HTML paste options
  HTMLPASTE_ASK_THE_USER: 0,
  HTMLPASTE_AS_FORMATTED: 1,
  HTMLPASTE_AS_IS:        2,

  // Keyboard pasting mode
  PASTEACTION_SHORTCUT_KEY:   1,
  PASTEACTION_SEARCH_CLIPPING: 2,

  // Special folder IDs
  ROOT_FOLDER_ID: 0,
  DELETED_ITEMS_FLDR_ID: -1,

  // IndexedDB database change types
  DB_CREATED: 1,
  DB_UPDATED: 2,
  DB_DELETED: 3,

  // Origin of clipping/folder creation for Clippings listener
  ORIGIN_HOSTAPP: 1,
  ORIGIN_CLIPPINGS_MGR: 2,

  // Export to file
  CLIPPINGS_EXPORT_FILENAME: "clippings.json",
  HTML_EXPORT_FILENAME: "clippings.html",
  HTML_EXPORT_SHORTCUTS_FILENAME: "clippings-shortcuts.html",
  CSV_EXPORT_FILENAME: "clippings.csv",
  CLIPPINGS_BACKUP_FILENAME: "clippings-backup.json",
  CLIPPINGS_BACKUP_FILENAME_WITH_DATE: "clippings-backup %s.json",

  // Backup reminder frequency
  BACKUP_REMIND_NEVER: 0,
  BACKUP_REMIND_DAILY: 1,
  BACKUP_REMIND_WEEKLY: 2,
  BACKUP_REMIND_MONTHLY: 3,
  BACKUP_REMIND_TWOWEEKS: 4,
  BACKUP_REMIND_TWODAYS: 5,
  BACKUP_REMIND_THREEDAYS: 6,
  BACKUP_REMIND_FIVEDAYS: 7,
  BACKUP_REMINDER_DELAY_MS: 300000,      // 5 minutes
  BACKUP_REMINDER_INTERVAL_MS: 86400000, // 24 hours

  // Sync Clippings Helper app update checking
  SYNC_HELPER_CHECK_UPDATE_URL: "https://aecreations.github.io/updates/syncClippings.json",
  SYNC_HELPER_CHECK_UPDATE_DELAY_MS: 600000,  // 10 minutes
  SYNC_HELPER_CHECK_UPDATE_FREQ_DAYS: 2,

  // Notification IDs
  NOTIFY_BACKUP_REMIND_FIRSTRUN_ID: "ae-clippings-notify-backup-reminder-firstrun",
  NOTIFY_BACKUP_REMIND_ID: "ae-clippings-notify-backup-reminder",
  NOTIFY_SYNC_ERROR_ID: "ae-clippings-sync-error",
  NOTIFY_SYNC_HELPER_UPDATE: "ae-clippings-sync-helper-update",

  // Errors returned by the native messaging app
  SYNC_ERROR_UNKNOWN: "Error: undefined",
  SYNC_ERROR_CONXN_FAILED: "Error: Attempt to postMessage on disconnected port",

  DONATE_URL: "https://www.paypal.com/paypalme/aecreations88/11.99cad",
  L10N_URL: "https://crowdin.com/project/clippings"
};
