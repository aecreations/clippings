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
 * Portions created by the Initial Developer are Copyright (C) 2013
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

//
// Extension Preferences Migrator Module
//  - Migrates existing, user-set extension prefs from the root branch to the
//    "extensions.aecreations" branch.
//

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://clippings/modules/aeUtils.js");


const EXPORTED_SYMBOLS = ["aePrefMigrator"];

const PREFNAME_PREFIX = "extensions.aecreations.";

const Cc = Components.classes;
const Ci = Components.interfaces;


var aePrefMigrator = {

  migratePrefs: function () 
  {
    this._migratePref("clippings.entries.add_silently", false);
    this._migratePref("clippings.backup.maxfiles", 10);
    this._migratePref("clippings.first_run", true);
    this._migratePref("clippings.v3.first_run", true);
    this._migratePref("clippings.migrate_common_ds_pref", true);
    this._migratePref("clippings.export.html.title", "Clippings");
    this._migratePref("clippings.datasource.location", "");
    this._migratePref("clippings.datasource.process_root", true);
    this._migratePref("clippings.clipmgr.quickedit.update_interval", 1000);
    this._migratePref("clippings.clipmgr.first_run", true);
    this._migratePref("clippings.clipmgr.max_commit_attempts", 5);
    this._migratePref("clippings.clipmgr.wnd_position", "48,96");
    this._migratePref("clippings.clipmgr.wnd_size", "670,410");
    this._migratePref("clippings.clipmgr.is_maximized", false);
    this._migratePref("clippings.clipmgr.show_tree_lines", false);
    this._migratePref("clippings.clipmgr.select_text_on_click", false);
    this._migratePref("clippings.clipmgr.status_bar", true);
    this._migratePref("clippings.warn_paste_failure", true);
    this._migratePref("clippings.use_clipboard", false);
    this._migratePref("clippings.html_paste", 0);
    this._migratePref("clippings.html_auto_line_break", true);
    this._migratePref("clippings.check_spelling", true);
    this._migratePref("clippings.enable_keyboard_paste", true);
    this._migratePref("clippings.beep_on_error", true);
    this._migratePref("clippings.tab_modal_placeholder_prompt", false);
  },


  _migratePref: function (aPrefName, aDefaultValue)
  {
    let prefs = Services.prefs;

    if (! prefs.prefHasUserValue(aPrefName)) {
      return;
    }

    let prefValue = this._getPref(aPrefName, aDefaultValue);
    let newPrefName = PREFNAME_PREFIX + aPrefName;
    this._setPref(newPrefName, prefValue, prefs.getPrefType(aPrefName));

    aeUtils.log('aePrefMigrator: Migrated pref: "' + aPrefName + '"');

    try {
      prefs.clearUserPref(aPrefName);
    }
    catch (e) {
      aeUtils.log("aePrefMigrator: " + e);
    }
  },


  _getPref: function (aPrefName, aDefaultValue)
  {
    let prefs = Services.prefs;
    let prefType = prefs.getPrefType(aPrefName);
    let rv = undefined;

    if (prefType == prefs.PREF_STRING) {
      rv = prefs.getCharPref(aPrefName);
    }
    else if (prefType == prefs.PREF_INT) {
      rv = prefs.getIntPref(aPrefName);
    }
    else if (prefType == prefs.PREF_BOOL) {
      rv = prefs.getBoolPref(aPrefName);
    }
    else {
      // Pref doesn't exist if prefType == prefs.PREF_INVALID.
      rv = aDefaultValue;
    }

    return rv;
  },


  _setPref: function (aPrefName, aPrefValue, aPrefType)
  {
    let prefs = Services.prefs;

    if (aPrefType == prefs.PREF_INT) {
      prefs.setIntPref(aPrefName, aPrefValue);
    }
    else if (aPrefType == prefs.PREF_BOOL) {
      prefs.setBoolPref(aPrefName, aPrefValue);
    }
    else if (aPrefType == prefs.PREF_STRING) {
      prefs.setCharPref(aPrefName, aPrefValue);
    }
  }
};
