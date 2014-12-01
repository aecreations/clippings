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
 * Portions created by the Initial Developer are Copyright (C) 2005-2014
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

//
// Integration with host application
//

if (! ('aecreations' in window)) {
  window.aecreations = {};
}

if (! ('clippings' in window.aecreations)) {
  window.aecreations.clippings = {};
}
else {
  throw new Error("clippings object already defined");
}

window.aecreations.clippings = {
  dataSrcInitialized:     false,
  isClippingsInitialized: false,
  showDialog:             true,
  showPasteOpts:          false,
  clippingsSvc:           null,
  strBundle:              null,
  _clippingsListener:     null,
  _isErrMenuItemVisible:  false,
  _ds:                    null,


  // Method handleEvent() effectively makes the Clippings overlay object an
  // implementation of the EventListener interface; therefore it can be passed
  // as the listener argument to window.addEventListener() and
  // window.removeEventListener()
  handleEvent: function (aEvent)
  {
    // When this method is invoked, 'this' will not refer to the Clippings
    // overlay object.
    var that = window.aecreations.clippings;

    if (aEvent.type == "load") {
      that.initClippings();
    }
    else if (aEvent.type == "unload") {
      that.unload();
      window.removeEventListener("load", that, false);
      window.removeEventListener("unload", that, false);

      var hostAppCxtMenu = document.getElementById("msgComposeContext");
      hostAppCxtMenu.removeEventListener("popupshowing", 
					 that._initContextMenuItem,
					 false);
    }
  },


  //
  // Drag 'n drop event handlers for Clippings status bar icon
  //

  statusBarDrop: function (aEvent)
  {
    if (! this.dataSrcInitialized) {
      // The RDF data source has to be initialized if it has not already been
      // done so, otherwise RDF node creation will fail, and the new
      // Clippings entry will never be created.
      // This initialization is done in the code for the Clippings popup
      // menu's `onpopupshowing' event handler.
      this.initClippingsPopup(document.getElementById("ae-clippings-popup-1"),
                              document.getElementById("ae-clippings-menu-1"));
    }

    var text = aEvent.dataTransfer.getData("text/plain");
    var result = this.aeCreateClippingFromText(this.clippingsSvc, text, this.showDialog, window, null, false);

    if (result) {
      let that = window.aecreations.clippings;
      window.setTimeout(function () { that.saveClippings(); }, 100);
    }
  },


  //
  // Methods invoked by overlay code
  //

  alert: function (aMessage)
  {
    var title = this.strBundle.getString('appName');
    this.aeUtils.alertEx(title, aMessage);
  },


  newFromClipboard: function () 
  {
    if (! this.dataSrcInitialized) {
      // The RDF data source has to be initialized if it has not already been
      // done so, otherwise RDF node creation will fail, and the new Clippings
      // entry will never be created.
      // This initialization is done in the code for the Clippings popup menu's
      // `onpopupshowing' event handler.
      this.initClippingsPopup(document.getElementById("ae-clippings-popup-1"),
			      document.getElementById("ae-clippings-menu-1"));
    }

    var txt = this.aeUtils.getTextFromClipboard();
    if (! txt) {
      var clippingsBtn = document.getElementById("ae-clippings-icon");
      var panel = document.getElementById("ae-clippings-clipboard-alert");
      panel.openPopup(clippingsBtn, "after_pointer", 0, 0, false, false);
      return;
    }

    var result = this.aeCreateClippingFromText(this.clippingsSvc, txt, this.showDialog, window, null, false);
    if (result) {
      let that = this;
      window.setTimeout(function () { 
        that.saveClippings();
      }, 1);
    }
  },


  getSelectedText: function ()
  {
    var rv;
    var focusedWnd = document.commandDispatcher.focusedWindow;
    var focusedElt = document.commandDispatcher.focusedElement;

    this.aeUtils.log("gClippings.getSelectedText(): focusedElt = " + focusedElt);
    if (focusedElt instanceof HTMLInputElement) {
      // Subject line text box
      rv = focusedElt.value.substring(focusedElt.selectionStart, focusedElt.selectionEnd);
    }
    else {
      rv = focusedWnd.getSelection().toString();
    }

    return rv;
  },


  newFromSelection: function ()
  {
    if (! this.dataSrcInitialized) {
      this.initClippingsPopup(document.getElementById("ae-clippings-popup-1"),
			      document.getElementById("ae-clippings-menu-1"));
    }

    // Must explicitly close the message compose context menu - otherwise it
    // will reappear while the New Clipping dialog is open if the Clippings 
    // submenu needs to be rebuilt.
    var cxtMenu = document.getElementById("msgComposeContext");
    cxtMenu.hidePopup();

    var selection = this.getSelectedText();
    if (selection) {
      var result = this.aeCreateClippingFromText(this.clippingsSvc, selection, this.showDialog, window, null, false);
      if (result) {
        let that = this;
	window.setTimeout(function () { 
          that.saveClippings();
        }, 1);
      }
    }
    else {
      var strBundle = document.getElementById("ae-clippings-strings");
      this.alert(this.strBundle.getString('errorNoSelection'));
    }
  },


  openClippingsManager: function () 
  {
    var wnd = window.open("chrome://clippings/content/clippings.xul",
			  "ae_clippings_wndobj", "chrome,resizable");
    wnd.focus();
  },


  toggleShowPasteOptions: function ()
  {
    this.showPasteOpts = !this.showPasteOpts;
    document.getElementById("ae_clippings_show_paste_options").setAttribute("checked", this.showPasteOpts);
  },


  initClippingsPopup: function (aPopup, aMenu) 
  {
    var err = false;
    var dsURL = this.aeUtils.getDataSourcePathURL() + this.aeConstants.CLIPDAT_FILE_NAME;
    try {
      this._ds = this.clippingsSvc.getDataSource(dsURL);
    }
    catch (e if e.result == Components.results.NS_ERROR_OUT_OF_MEMORY) {
      err = this.strBundle.getString("errorOutOfMemory");
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_ACCESS_DENIED) {
      err = this.aeString.format("%s: %s",
			  this.strBundle.getString("errorAccessDenied"),
			  this.aeConstants.CLIPDAT_FILE_NAME);
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_IS_LOCKED) {
      err = this.aeString.format("%s: %s",
			  this.strBundle.getString("errorFileLocked"),
			  this.aeConstants.CLIPDAT_FILE_NAME);
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_TOO_BIG) {
      err = this.aeString.format("%s: %s",
			  this.strBundle.getString("errorFileTooBig"),
			  this.aeConstants.CLIPDAT_FILE_NAME);
    }
    catch (e) {
      // File is corrupt - open Clippings Manager and perform recovery.
      err = 888;
    }

    var errorMenuItem = document.getElementById("ae-clippings-error-menuitem");

    if (err) {
      // Append a new menu item that lets user see more details of error.
      if (errorMenuItem) {
	return;
      }

      var errorCmd = document.createElement("menuitem");
      errorCmd.id = "ae-clippings-error-menuitem";
      errorCmd.setAttribute("label", this.strBundle.getString("errorMenu"));
      errorCmd.style.fontWeight = "bold";

      var func;
      let that = this;
      if (err == 888) {
	func = function () { that.openClippingsManager() };
      }
      else {
	func = function () {
	  that.aeUtils.alertEx(that.strBundle.getString("appName"), err);
	};
      }
      errorCmd.addEventListener("command", func, false);
      aPopup.appendChild(errorCmd);
      this._isErrMenuItemVisible = true;
      return;
    }
    else {
      // Remove error menu item if error condition no longer exists
      if (errorMenuItem) {
	aPopup.removeChild(errorMenuItem);
	this._isErrMenuItemVisible = false;
      }
    }

    aMenu.database.AddDataSource(this._ds);
    aMenu.builder.rebuild();

    this.dataSrcInitialized = true;
    this.aeUtils.log("gClippings.initClippingsPopup(): Data source initialization completed.");
  },


  insertClippingText: function (aURI, aName, aText) 
  {
    // Must explicitly close the message compose context menu - otherwise it
    // may reappear while the paste options dialog is open.
    var cxtMenu = document.getElementById("msgComposeContext");
    cxtMenu.hidePopup();

    var parentFolderURI = this.clippingsSvc.getParent(aURI);
    var folderName = this.clippingsSvc.getName(parentFolderURI);
    var clippingInfo = this.aeClippingSubst.getClippingInfo(aURI, aName, aText, folderName);
    var clippingText = this.aeClippingSubst.processClippingText(clippingInfo, window);
    var pasteAsQuotation = false;
    var useClipboard = this.aeUtils.getPref("clippings.use_clipboard", 
						  false);
    if (! useClipboard) {
      // Paste clipping into subject line
      var focusedElt = document.commandDispatcher.focusedElement;
      if (focusedElt instanceof HTMLInputElement) {
	var pre, post, pos;
	var textbox = focusedElt;
	var text = textbox.value;

	if (textbox.selectionStart == textbox.selectionEnd) {
	  var point = textbox.selectionStart;
	  pre = text.substring(0, point);
	  post = text.substring(point, text.length);
	  pos = point + clippingText.length;
	}
	else {
	  var p1 = textbox.selectionStart;
	  var p2 = textbox.selectionEnd;
	  pre = text.substring(0, p1);
	  post = text.substring(p2, text.length);
	  pos = p1 + clippingText.length;
	}

	// "Paste" the clipping, then adjust cursor position so that it is placed
	// after the last character in the "pasted" clipping text
	textbox.value = pre + clippingText + post;
	textbox.selectionStart = pos;
	textbox.selectionEnd = pos;
	return;
      }

      // If "Show Options When Pasting" is enabled, ask the user if the
      // clipping should be pasted as normal or quoted text.
      if (this.showPasteOpts) {
	var dlgArgs = { userCancel: null };
	window.openDialog("chrome://clippings/content/pasteOptions.xul", "ae_clippings_pasteopt_dlg", "chrome,centerscreen,modal", dlgArgs);

	if (dlgArgs.userCancel) {
	  return;
	}

	pasteAsQuotation = dlgArgs.pasteOption == 1;
      }

      var contentFrame = document.getElementById("content-frame");
      var editor = contentFrame.getEditor(contentFrame.contentWindow);

      // Composing email in rich text (HTML)
      if (gMsgCompose.composeHTML) {
	var htmlEditor = editor.QueryInterface(Components.interfaces.nsIHTMLEditor);
	var hasHTMLTags = clippingText.search(/<[a-z1-6]+( [a-z]+(\="?.*"?)?)*>/i) != -1;
	var hasRestrictedHTMLTags = clippingText.search(/<\?|<%|<!DOCTYPE|(<\b(html|head|body|meta|script|applet|embed|object|i?frame|frameset)\b)/i) != -1;

	if (hasHTMLTags) {
	  var pasteAsRichText;
	  if (! hasRestrictedHTMLTags) {
	    var showHTMLPasteOpts = this.aeUtils.getPref("clippings.html_paste", 0);
	    if (showHTMLPasteOpts == this.aeConstants.HTMLPASTE_ASK_THE_USER) {
	      var dlgArgs = { userCancel: null, pasteAsRichText: null };
	      window.openDialog("chrome://clippings/content/htmlClipping.xul", "htmlClipping_dlg", "chrome,modal,centerscreen", dlgArgs);
	      
	      if (dlgArgs.userCancel) {
		return;
	      }
	      pasteAsRichText = dlgArgs.pasteAsRichText;
	    }
	    else {
	      pasteAsRichText = showHTMLPasteOpts == this.aeConstants.HTMLPASTE_AS_HTML;
	    }
	  }
	  var plainTextClipping = clippingText;
	  
	  if (!pasteAsRichText || hasRestrictedHTMLTags) {
	    clippingText = clippingText.replace(/&/g, "&amp;");
	    clippingText = clippingText.replace(/</g, "&lt;");
	    clippingText = clippingText.replace(/>/g, "&gt;");
	  }
	}
	else {
	  // Could be plain text but with angle brackets, e.g. for denoting URLs
	  // or email addresses, e.g. <joel_user@acme.com>, <http://www.acme.com>
	  var hasOpenAngleBrackets = clippingText.search(/</) != -1;
	  var hasCloseAngleBrackets = clippingText.search(/>/) != -1;

	  if (hasOpenAngleBrackets) {
	    clippingText = clippingText.replace(/</g, "&lt;");
	  }
	  if (hasCloseAngleBrackets) {
	    clippingText = clippingText.replace(/>/g, "&gt;");	  
	  }
	}

	var autoLineBreak = this.aeUtils.getPref("clippings.html_auto_line_break", true);
	var hasLineBreakTags = clippingText.search(/<br|<p/i) != -1;
	if (autoLineBreak && !hasLineBreakTags) {
	  clippingText = clippingText.replace(/\n/g, "<br>");
	}
      }
      else {
	// Composing email without formatting
	var plainTextEditor = editor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
      }

      if (pasteAsQuotation) {
	var mailEditor = editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
	if (gMsgCompose.composeHTML) {
	  mailEditor.insertAsCitedQuotation(clippingText, "", true);
	}
	else {
	  mailEditor.insertAsQuotation(clippingText);
	  mailEditor.rewrap(true);
	}
	return;
      }
      
      if (gMsgCompose.composeHTML) {
	htmlEditor.insertHTML(clippingText);
      }
      else {
	plainTextEditor.insertText(clippingText);
      }
      
      return;
    }

    this.aeUtils.copyTextToClipboard(clippingText);

    if (this.showPasteOpts) {
      var dlgArgs = { userCancel: null };
      window.openDialog("chrome://clippings/content/pasteOptions.xul", "ae_clippings_pasteopt_dlg", "chrome,centerscreen,modal", dlgArgs);

      if (dlgArgs.userCancel) {
	return;
      }

      if (dlgArgs.pasteOption == 1) {
	goDoCommand("cmd_pasteQuote");

	// gMsgCompose defined in <chrome://messenger/content/messengercompose/
	// MsgComposeCommands.js>.  It is an instance of nsIMsgCompose,
	// progid "@mozilla.org/messengercompose/compose;1"
	// Line rewrapping not necessary if composing in HTML format
	if (! gMsgCompose.composeHTML) {
	  goDoCommand("cmd_rewrap");
	}
	return;
      }
    }

    let that = this;
    window.setTimeout(function () { 
      that._pasteClipping(that);
    }, 8);
  },


  _pasteClipping: function (aClippings)
  {
    try {
      // Paste clipping.  The following function is defined in
      // "chrome://global/content/globalOverlay.js"
      goDoCommand('cmd_paste');
      // SIDE EFFECT: The clipping text will remain on the system clipboard.
    }
    catch (e) {
      // Exception thrown if command is disabled or not applicable
      aClippings.aeUtils.beep();
    }
  },


  keyboardInsertClipping: function (aEvent)
  {
    var clippingsMenu1 = document.getElementById("ae-clippings-menu-1");
    clippingsMenu1.builder.refresh();
    clippingsMenu1.builder.rebuild();

    var dlgArgs = { key: null };
    var dlg = window.openDialog("chrome://clippings/content/clippingKey.xul",
				"clipkey_dlg", "modal,centerscreen", dlgArgs);

    var keyDict = this.clippingsSvc.getShortcutKeyDict();

    if (dlgArgs.key && dlgArgs.key != this.aeConstants.KEY_F1) {
      var key = String.fromCharCode(dlgArgs.key);

      if (! keyDict.hasKey(key)) {
	this.aeUtils.beep();
	return;
      }

      try {
	var valueStr = keyDict.getValue(key);
      }
      catch (e) {}

      valueStr = valueStr.QueryInterface(Components.interfaces.nsISupportsString);
      var clippingURI = valueStr.data;
      this.insertClippingText(clippingURI,
			      this.clippingsSvc.getName(clippingURI),
			      this.clippingsSvc.getText(clippingURI));
    }

    if (dlgArgs.key && dlgArgs.key == this.aeConstants.KEY_F1) {
      var keys;
      var keyCount = {};
      keys = keyDict.getKeys(keyCount);
      keys = keys.sort();
      keyCount = keyCount.value;

      var keyMap = {};

      for (let i = 0; i < keyCount; i++) {
	try {
	  var valueStr = keyDict.getValue(keys[i]);
	}
	catch (e) {}
	valueStr = valueStr.QueryInterface(Components.interfaces.nsISupportsString);
	let clippingURI = valueStr.data;
	let clippingName = this.clippingsSvc.getName(clippingURI);

	keyMap[keys[i]] = {
	  name: clippingName,
	  uri:  clippingURI
	};
      }

      var dlgArgs = {
        printToExtBrowser: true,
        keyMap:   keyMap,
	keyCount: keyCount
      };

      var helpWnd = window.openDialog("chrome://clippings/content/shortcutHelp.xul", "clipkey_help", "centerscreen,resizable", dlgArgs);
      helpWnd.focus();
    }
  },


  saveClippings: function () 
  {
    var title = this.strBundle.getString('appName');
    try {
      this.clippingsSvc.flushDataSrc();
    }
    catch (e if e.result == Components.results.NS_ERROR_NOT_INITIALIZED) {
      this.aeUtils.alertEx(title, this.strBundle.getString("errorSaveFailedDSNotInitialized"));
      return;
	   }
    catch (e if e.result == Components.results.NS_ERROR_OUT_OF_MEMORY) {
      this.aeUtils.alertEx(title, this.strBundle.getString("errorOutOfMemory"));
      return;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_ACCESS_DENIED) {
      let msg = this.aeString.format("%s: %s",
			      this.strBundle.getString("errorAccessDenied"),
			      this.aeConstants.CLIPDAT_FILE_NAME);
      this.aeUtils.alertEx(title, msg);
      return;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_IS_LOCKED) {
      let msg = this.aeString.format("%s: %s",
			      this.strBundle.getString("errorFileLocked"),
			      this.aeConstants.CLIPDAT_FILE_NAME);
      this.aeUtils.alertEx(title, msg);
      return;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_TOO_BIG) {
      let msg = this.aeString.format("%s: %s",
			      this.strBundle.getString("errorFileTooBig"),
			      this.aeConstants.CLIPDAT_FILE_NAME);
      this.aeUtils.alertEx(title, msg);
      return;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_READ_ONLY) {
      let msg = this.aeString.format("%s: %s",
			      this.strBundle.getString('errorFileReadOnly'),
			      this.aeConstants.CLIPDAT_FILE_NAME);
      this.aeUtils.alertEx(title, msg);
      return;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_DISK_FULL) {
      let msg = this.aeString.format("%s: %s",
			      this.strBundle.getString('errorDiskFull'),
			      this.aeConstants.CLIPDAT_FILE_NAME);
      this.aeUtils.alertEx(title, msg);
      return;
    }
    catch (e) {
      this.aeUtils.alertEx(title, this.strBundle.getString("alertSaveFailed"));
      return;
    }
  },


  //
  // Browser window and Clippings menu initialization
  //

  initClippings: function ()
  {   
    // Workaround to this init function being called multiple times
    if (this.isClippingsInitialized) {
      return;
    }

    this.strBundle = document.getElementById("ae-clippings-strings");
    this.aeClippingSubst.init(this.strBundle, navigator.userAgent);

    try {
      this.clippingsSvc = Components.classes["clippings@mozdev.org/clippings;1"].getService(Components.interfaces.aeIClippingsService);
    }
    catch (e) {
      this.alert(e);
    }

    // String used for empty (null) clippings
    this.clippingsSvc.setEmptyClippingString(this.strBundle.getString('emptyClippingLabel'));

    // Migrate prefs from root to the "extensions." branch
    let prefsMigrated = this.aeUtils.getPref("clippings.migrated_prefs", false);
    if (! prefsMigrated) {
      this.aePrefMigrator.migratePrefs();
      this.aeUtils.setPref("clippings.migrated_prefs", true);
    }

    // First-run initialization
    if (this.aeUtils.getPref("clippings.first_run", true) == true) {
      // Starting with Clippings 4.0, the status bar in Clippings Manager will
      // be hidden by default for new users.  Users upgrading from earlier
      // versions of Clippings will continue to see the status bar.
      this.aeUtils.setPref("clippings.clipmgr.status_bar", false);
      
      this.aeUtils.setPref("clippings.first_run", false);
    }

    // Migration of deprecated common clippings pref (Clippings 4.0+)
    if (this.aeUtils.getPref("clippings.migrate_common_ds_pref", true) == true) {
      this.aeClippings3.migrateCommonDataSrcPref();
      this.aeUtils.setPref("clippings.migrate_common_ds_pref", false);
    }

    // First-run initialization after upgrade from 2.x -> 3.0+
    if (this.aeUtils.getPref("clippings.v3.first_run", true) == true) {
      this.aeClippings3.init(this.clippingsSvc, this.strBundle);
      var initFinished = this.aeClippings3.startInit();
      if (initFinished) {
	this.aeUtils.setPref("clippings.v3.first_run", false);
      }
    }

    let profilePath = this.aeUtils.getUserProfileDir().path;
    let dsPath = this.aeUtils.getPref("clippings.datasource.location", profilePath);
    
    if (this.aeUtils.PORTABLE_APP_BUILD && dsPath != profilePath) {
      this.aeUtils.log("Clippings: initClippings():\nResetting data source location on Portable " + Application.name);
      this.aeUtils.setPref("clippings.datasource.location", profilePath);
    }

    // Clippings backup
    var backupDirURL = this.aeUtils.getDataSourcePathURL() + this.aeConstants.BACKUP_DIR_NAME;
    this.clippingsSvc.setBackupDir(backupDirURL);
    this.clippingsSvc.setMaxBackupFiles(this.aeUtils.getPref("clippings.backup.maxfiles", 10));

    // Initializing data source on Clippings context menus
    var menu1 = document.getElementById("ae-clippings-menu-1");
    var popup1 = document.getElementById("ae-clippings-popup-1");
    this.initClippingsPopup(popup1, menu1);

    this.aeUtils.log(this.aeString.format("gClippings.initClippings(): Initializing Clippings integration with host app window: %s", window.location.href));

    // Add null clipping to root folder if there are no items
    if (this.aeUtils.getPref("clippings.datasource.process_root", true) == true) {
      this.clippingsSvc.processRootFolder();
      this.aeUtils.setPref("clippings.datasource.process_root", false);
    }

    // Attaching event handler to context menu 
    var hostAppContextMenu = document.getElementById("msgComposeContext");
    hostAppContextMenu.addEventListener("popupshowing", 
					this._initContextMenuItem, false);

    let (that = this) {
      this._clippingsListener = {
        origin:  that.clippingsSvc.ORIGIN_HOSTAPP,

        dataSrcLocationChanged: function (aDataSrcURL) {
	  var menu = document.getElementById("ae-clippings-menu-1");
	  var popup = document.getElementById("ae-clippings-popup-1");

	  // Reinitialize Clippings menu so that it points to the correct
	  // datasource.
	  menu.database.RemoveDataSource(that._ds);
	  that.initClippingsPopup(popup, menu);
	},

        newFolderCreated:    function (aFolderURI) {},
        newClippingCreated:  function (aClippingURI) {},
        importDone:          function (aNumItems) {}
      };
    }
    this.clippingsSvc.addListener(this._clippingsListener);

    // Set behaviour of "New Clipping" commands - prompt vs. silent operation
    this.showDialog = true;
    try {
      this.showDialog = !(this.aeUtils.getPref("clippings.entries.add_silently", false));
    }
    catch (e) {}

    // Initialize "New From Clipboard" command on status bar icon menu.
    var ellipsis = this.showDialog ? this.strBundle.getString("ellipsis") : "";
    var newFromClpbdCmd = document.getElementById("ae_new_clipping_from_clpbd");
    newFromClpbdCmd.setAttribute("label",
				 this.strBundle.getString("newFromClipbd")
				 + ellipsis);

    // Disable Clippings Manager window persistence via JavaScript if running
    // on Mac OS X, unless user has explicitly set it.
    if (this.aeUtils.getOS() == "Darwin") {
      if (! this.aeUtils.hasPref("clippings.clipmgr.disable_js_window_geometry_persistence")) {
	this.aeUtils.setPref("clippings.clipmgr.disable_js_window_geometry_persistence", true);
      }
    }

    // Enable/disable Clippings paste using the keyboard.
    let keyEnabled = this.aeUtils.getPref("clippings.enable_keyboard_paste", true);
    let keyElt = document.getElementById("key_ae_clippings");

    if (!keyEnabled && keyElt) {
      document.getElementById("tasksKeys").removeChild(keyElt);
    }

    this.isClippingsInitialized = true;
  },


  // To be invoked only by the `popupshowing' event handler on the host app
  // context menu.
  _initContextMenuItem: function (aEvent) {
    let that = window.aecreations.clippings;
    if (aEvent.target.id == "msgComposeContext") {
      that.initContextMenuItem.apply(that, arguments);
    }
  },


  initContextMenuItem: function (aEvent)
  {
    this.aeUtils.log("gClippings.initContextMenuItem(): Event target: " + aEvent.target + "; tag name: " + aEvent.target.tagName + "; id = `" + aEvent.target.id + "'");

    var clippingsMenu;

    if (aEvent.target.id == "msgComposeContext") {
      clippingsMenu = document.getElementById("ae-clippings-menu-1");
    }

    this._initCxtMenuItem(clippingsMenu);
  },


  _initCxtMenuItem: function (aMenupopup)
  {
    this.aeUtils.log("gClippings._initCxtMenuItem(): aMenupopup = " + aMenupopup + "; tag name: " + aMenupopup.tagName + "; id = `" + aMenupopup.id + "'");

    aMenupopup.builder.refresh();
    aMenupopup.builder.rebuild();

    var strBundle = document.getElementById("ae-clippings-strings");
    var ellipsis = this.showDialog ? this.strBundle.getString("ellipsis") : "";
    var addEntryCmd = document.getElementById("ae_new_clipping_from_selection");
    var selection;

    if (aMenupopup.id == "ae-clippings-menu-1") {
      selection = this.getSelectedText();
    }
  
    addEntryCmd.setAttribute("disabled", selection == "");
    addEntryCmd.setAttribute("label", strBundle.getString("newFromSelect")
			     + ellipsis);

    this._initAutoIncrementPlaceholderMenu();
  },


  initToolbarBtnCxtMenu: function (aEvent)
  {
    // No-op
  },


  _initAutoIncrementPlaceholderMenu: function ()
  {
    var resetAutoIncrVarsMenuseparator = document.getElementById("reset-auto-increment-vars-separator");
    var resetAutoIncrVarsMenu = document.getElementById("reset-auto-increment-vars");
    var autoIncrVarsMenuPopup = document.getElementById("reset-auto-increment-vars-menu-popup");

    // Refresh the menu of auto-increment placeholders.
    while (autoIncrVarsMenuPopup.firstChild) {
      autoIncrVarsMenuPopup.removeChild(autoIncrVarsMenuPopup.firstChild);
    }

    var autoIncrementVars = this.aeClippingSubst.getAutoIncrementVarNames();
    var numAutoIncrVars = autoIncrementVars.length;
    if (numAutoIncrVars == 0) {
      resetAutoIncrVarsMenuseparator.style.display = "none";
      resetAutoIncrVarsMenu.style.display = "none";
    }
    else {
      resetAutoIncrVarsMenuseparator.style.display = "-moz-box";
      resetAutoIncrVarsMenu.style.display = "-moz-box";
      for (let i = 0; i < numAutoIncrVars; i++) {
        var menuItem = document.createElement("menuitem");
        menuItem.setAttribute("label", "#[" + autoIncrementVars[i] + "]");
        menuItem.setAttribute("value", autoIncrementVars[i]);

        let that = this;
        menuItem.addEventListener("command", function (evt) { that.aeClippingSubst.resetAutoIncrementVar(evt.target.value); }, false);
        autoIncrVarsMenuPopup.appendChild(menuItem);
      }
    }
  },


  unload: function ()
  {
    this.clippingsSvc.removeListener(this._clippingsListener);
    this._clippingsListener = null;
  }
};

Components.utils.import("resource://clippings/modules/aeConstants.js",
			window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aeString.js",
                        window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aeUtils.js",
                        window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aeCreateClippingHelper.js",
			window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aeClippingSubst.js",
                        window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aeClippings3.js",
                        window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aePrefMigrator.js",
			window.aecreations.clippings);

//
// Event handler initialization
//

window.addEventListener("load",   window.aecreations.clippings, false);
window.addEventListener("unload", window.aecreations.clippings, false);

