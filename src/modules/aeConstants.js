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
 * Portions created by the Initial Developer are Copyright (C) 2005-2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

const EXPORTED_SYMBOLS = ["aeConstants"];


var aeConstants = {
  // Host app GUIDs
  HOSTAPP_FX_GUID: "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
  HOSTAPP_TB_GUID: "{3550f703-e582-4d05-9a08-453d09bdfdc6}",

  // Clippings datasource files
  CLIPDAT_FILE_NAME: "clipdat2.rdf",
  CLIPDAT_1X_FILE_NAME: "clipdat.rdf",
  BACKUP_DIR_NAME:   ".clipbak",

  // Constants for HTML paste options
  HTMLPASTE_ASK_THE_USER: 0,
  HTMLPASTE_AS_HTML:      1,
  HTMLPASTE_AS_IS:        2,

  // Key codes
  KEY_ESCAPE: 27,
  KEY_F1:     112,

  // Shortcut help HTML document
  SHORTCUT_HELP_FILENAME: "clipkeys.html",
  SHORTCUT_HELP_PRINT_FILENAME: "clipKeysPrn.html"
};
