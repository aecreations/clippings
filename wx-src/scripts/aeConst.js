/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const aeConst = Object.freeze({
  DEBUG: false,
  DEV_BUILD: true,

  // Native messaging helper app
  SYNC_CLIPPINGS_APP_NAME: "syncClippings",

  // Browser action
  BRWSACT_OPEN_CLIPPINGS_MGR: 1,
  BRWSACT_OPEN_SIDEBAR: 2,

  // Constants for HTML paste options
  HTMLPASTE_ASK_THE_USER: 0,
  HTMLPASTE_AS_FORMATTED: 1,
  HTMLPASTE_AS_IS:        2,

  // Copy clipping text
  COPY_AS_HTML: 1,
  COPY_AS_PLAIN_HTML: 2,
  COPY_AS_PLAIN: 3,

  // Keyboard pasting mode
  PASTEACTION_SHORTCUT_KEY:   1,
  PASTEACTION_SEARCH_CLIPPING: 2,

  // Display of assigned shortcut key in Clippings menu
  SHCTKEY_DISPLAY_PARENS: 0,
  SHCTKEY_DISPLAY_SQ_BRKT: 1,

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

  // Post-upgrade notifications
  POST_UPGRADE_NOTIFCN_DELAY_MS: 60000, // 1 minute
  POST_UPGRADE_NOTIFCN_INTERVAL_MS: 86400000, // 24 hours
  MAX_NUM_POST_UPGRADE_NOTIFICNS: 2,

  // Errors returned by the native messaging app
  SYNC_ERROR_UNKNOWN: "Error: undefined",
  SYNC_ERROR_CONXN_FAILED: "Error: Attempt to postMessage on disconnected port",
  SYNC_ERROR_NAT_APP_NOT_FOUND: "Error: No such native application syncClippings",
  SYNC_ERROR_UNEXPECTED: "Error: An unexpected error occurred",

  QUICKSTART_URL: "https://aecreations.io/clippings/quickstart.php",
  WHATSNEW_URL: "https://aecreations.io/clippings/whatsnew.php",
  DONATE_URL: "https://aecreations.io/clippings/donate.php",
  L10N_URL: "https://crowdin.com/project/clippings",
  BLOG_URL: "https://aecreations.blogspot.com/",
  FORUM_URL: "https://aecreations.io/forums",
  AMO_URL: "https://addons.mozilla.org/firefox/addon/clippings/",
  CONTRIB_URL: "https://aecreations.io/clippings/contribute.php",
  HELP_URL: "https://aecreations.io/clippings/help.php",
  SYNC_CLIPPINGS_HELP_URL: "https://aecreations.io/clippings/sync.php",
  SYNC_CLIPPINGS_DWNLD_URL: "https://aecreations.io/clippings/sync-clippings-helper.php",
});
