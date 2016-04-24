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
 * Portions created by the Initial Developer are Copyright (C) 2005-2016
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
  _clippingsListener:     null,
  _isErrMenuItemVisible:  false,
  _ds:                    null,
  _triggerNode:           null,
  _popupNode:             null,
  
  dataSrcInitialized:     false,
  isClippingsInitialized: false,
  showDialog:             true,
  clippingsSvc:           null,
  strBundle:              null,


  // Method handleEvent() effectively makes the Clippings overlay object an 
  // implementation of the EventListener interface; therefore it can be passed 
  // as the listener argument to window.addEventListener() and 
  // window.removeEventListener()
  handleEvent: function (aEvent)
  {
    // When this method is invoked, 'this' will not refer to the Clippings
    // overlay object.
    let that = window.aecreations.clippings;

    if (aEvent.type == "load") {
      that.initClippings();
    }
    else if (aEvent.type == "unload") {
      that.unload();
      window.removeEventListener("load", that, false);
      window.removeEventListener("unload", that, false);

      var hostAppCxtMenu = document.getElementById("contentAreaContextMenu");
      hostAppCxtMenu.removeEventListener("popupshowing", 
					 that._initContextMenuItem,
					 false);
      hostAppCxtMenu.removeEventListener("popuphiding",
					 that._hideContextMenuItem,
					 false);
    }
  },


  //
  // Drag 'n drop event handlers for Clippings toolbar icon
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
    var srcURL = this._getCurrentBrowserURL();
    var result = this.aeCreateClippingFromText(this.clippingsSvc, text, srcURL, this.showDialog, window, null, false);

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

    let txt = this.aeUtils.getTextFromClipboard();
    if (! txt) {
      let clippingsBtn = document.getElementById("ae-clippings-icon");
      let panel = document.getElementById("ae-clippings-clipboard-alert");
      panel.openPopup(clippingsBtn, "after_pointer", 0, 0, false, false);
      return;
    }

    let that = this;
    let result = this.aeCreateClippingFromText(this.clippingsSvc, txt, null, this.showDialog, window, null, false);

    if (result) {
      window.setTimeout(function () { 
        that.saveClippings(); 
      }, 1);
    }
  },


  newFromTextbox: function ()
  {
    if (! this.dataSrcInitialized) {
      this.initClippingsPopup(document.getElementById("ae-clippings-popup-1"),
			      document.getElementById("ae-clippings-menu-1"));
    }

    var cxtMenu = document.getElementById("contentAreaContextMenu");

    if (gContextMenu.onTextInput) {
      // Must explicitly close the browser content area context menu -
      // otherwise it will reappear while the New Clipping dialog is open if
      // the Clippings submenu needs to be rebuilt.
      cxtMenu.hidePopup();
      
      // Send message to frame script to retrieve the selected web page textbox
      // text, or all text in the textbox if nothing selected.
      let msgArgs = {};
      let browserMM = gBrowser.selectedBrowser.messageManager;

      this.aeUtils.log("newFromTextbox(): Sending message to frame script: " + this.aeConstants.MSG_REQ_NEW_CLIPPING_FROM_TEXTBOX);
      browserMM.sendAsyncMessage(this.aeConstants.MSG_REQ_NEW_CLIPPING_FROM_TEXTBOX, msgArgs);

      // The triggerNode cache was initialized in initContextMenuItem().
      // Reset triggerNode cache for next context menu command invocation.
      this._triggerNode = null;
      this._popupNode = null;
    }
  },


  handleResponseNewClippingFromTextbox: function (aMessage)
  {
    let that = window.aecreations.clippings;
    let respArgs = aMessage.data;

    that.aeUtils.log("handleResponseNewClippingFromTextbox(): Handling message: " + that.aeConstants.MSG_RESP_NEW_CLIPPING_FROM_TEXTBOX);

    let srcURL = that._getCurrentBrowserURL();

    let result = that.aeCreateClippingFromText(that.clippingsSvc, respArgs.text, srcURL, that.showDialog, window, null, false);

    if (result) {
      window.setTimeout(function() {
        that.saveClippings();
      }, 1);
    }
  },


  newFromSelection: function ()
  {
    if (! this.dataSrcInitialized) {
      this.initClippingsPopup(document.getElementById("ae-clippings-popup-1"),
			      document.getElementById("ae-clippings-menu-1"));
    }

    // Send message to frame script to retrieve the selected web page text.
    let msgArgs = {};
    let browserMM = gBrowser.selectedBrowser.messageManager;

    this.aeUtils.log("newFromSelection(): Sending message to frame script: " + this.aeConstants.MSG_REQ_NEW_CLIPPING_FROM_SELECTION);
    browserMM.sendAsyncMessage(this.aeConstants.MSG_REQ_NEW_CLIPPING_FROM_SELECTION, msgArgs);
  },


  handleResponseNewFromSelection: function (aMessage)
  {
    let that = window.aecreations.clippings;
    let respArgs = aMessage.data;

    that.aeUtils.log("handleResponseNewFromSelection(): Handling message: " + that.aeConstants.MSG_RESP_NEW_CLIPPING_FROM_SELECTION);

    let selectedText = respArgs.selectedText;
    let srcURL = that._getCurrentBrowserURL();
    
    if (selectedText) {
      let result = that.aeCreateClippingFromText(that.clippingsSvc, selectedText, srcURL, that.showDialog, window, null, false);
      if (result) {
        if (that.clippingsSvc.isClipping(result)) {
          that.aeUtils.log(that.aeString.format("New clipping created from selected text\nName: %s\nSource URL (if saved): %s", that.clippingsSvc.getName(result), srcURL));
        }

	window.setTimeout(function () { that.saveClippings(); }, 1);
      }
    }
    else {
      that.alert(that.strBundle.getString("errorNoSelection"));
    }
  },


  _getCurrentBrowserURL: function ()
  {
    var tabbrowser = document.getElementById("content");
    var rv = tabbrowser.currentURI.spec;

    return rv;
  },


  openClippingsManager: function () 
  {
    var wnd = window.open("chrome://clippings/content/clippingsMgr.xul",
			  "clippings_wndobj", "chrome,resizable");
    wnd.focus();
  },


  initClippingsPopup: function (aPopup, aMenu) 
  {
    var err = false;
    var dsURL = this.aeUtils.getDataSourcePathURL() + this.aeConstants.CLIPDAT_FILE_NAME;
    try {
      var ds = this.clippingsSvc.getDataSource(dsURL);
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
	  that.aeUtils.alertEx(that.strBundle.getString('appName'), err);
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

    aMenu.database.AddDataSource(ds);
    aMenu.builder.rebuild();

    this._ds = ds;
    this.dataSrcInitialized = true;
  },


  insertClippingText: function (aURI, aName, aText) 
  {
    var parentFolderURI = this.clippingsSvc.getParent(aURI);
    var folderName = this.clippingsSvc.getName(parentFolderURI);
    var clippingInfo = this.aeClippingSubst.getClippingInfo(aURI, aName, aText, folderName);

    // The 'contentWindow' property of the browser would be null if on e10s.
    // If so, then use the ChromeWindow object instead, but placeholder prompts
    // will always appear in modal dialogs, even if tab-modal prompts were
    // enabled.
    var wnd = gBrowser.contentWindow ? gBrowser.contentWindow : window;
    var overrideTabModalPromptSetting = gBrowser.contentWindow == null;

    var clippingText = this.aeClippingSubst.processClippingText(clippingInfo, wnd, overrideTabModalPromptSetting);

    var useClipboard = this.aeUtils.getPref("clippings.use_clipboard", false);

    if (useClipboard) {
      this.aeUtils.copyTextToClipboard(clippingText);
      let that = this;
      window.setTimeout(function () { that._pasteClipping(that); }, 8);
      return;
    }

    // Send a message to the frame script to insert the clipping text.
    let msgArgs = { clippingText: clippingText };

    this.aeUtils.log("insertClippingText(): Sending message to frame script: " + this.aeConstants.MSG_REQ_INSERT_CLIPPING);
    let browserMM = gBrowser.selectedBrowser.messageManager;
    browserMM.sendAsyncMessage(this.aeConstants.MSG_REQ_INSERT_CLIPPING, msgArgs);
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
      var showFailMsg = aClippings.aeUtils.getPref("clippings.warn_paste_failure", true);
      if (showFailMsg) {
	aClippings.alert("Clippings paste failure:\n\n" + e);
      }
    }
  },


  keyboardInsertClipping: function (aEvent)
  {
    this.aeUtils.log("keyboardInsertClipping(): Sending message to frame script: " + this.aeConstants.MSG_REQ_IS_READY_FOR_SHORTCUT_MODE);
    let browserMM = gBrowser.selectedBrowser.messageManager;
    browserMM.sendAsyncMessage(this.aeConstants.MSG_REQ_IS_READY_FOR_SHORTCUT_MODE, {}); 
  },


  handleResponseIsReadyForShortcutMode: function (aMessage)
  {
    let that = window.aecreations.clippings;

    that.aeUtils.log("handleResponseIsReadyForShortcutMode(): Handling message: " + that.aeConstants.MSG_RESP_IS_READY_FOR_SHORTCUT_MODE);

    let respArgs = aMessage.data;

    if (respArgs.isTextboxFocused) {
      that.aeUtils.log("handleResponseIsReadyForShortcutMode(): Detected that a textbox or rich text editor in the web page has the focus!");
      that._keyboardInsertClipping.apply(that, arguments);
    }
    else {
      that.aeUtils.beep();
    }
  },


  _keyboardInsertClipping: function ()
  {
    var clippingsMenu1 = document.getElementById("ae-clippings-menu-1");
    clippingsMenu1.builder.refresh();
    clippingsMenu1.builder.rebuild();

    var dlgArgs = {
      SHORTCUT_KEY_HELP: 0,
      ACTION_SHORTCUT_KEY: 1,
      ACTION_SEARCH_CLIPPING: 2,
      action: null,
      switchModes: null,
      clippingURI: null,
      userCancel: null
    };

    // Remember the last mode (shortcut key or search clipping by name).
    dlgArgs.action = this.aeUtils.getPref("clippings.paste_shortcut_mode", dlgArgs.ACTION_SHORTCUT_KEY);

    do {
      if (dlgArgs.action == dlgArgs.SHORTCUT_KEY_HELP) {
        var keyDict = this.clippingsSvc.getShortcutKeyDict();
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

        let dlgArgs = {
          printToExtBrowser: false,
          keyMap:   keyMap,
	  keyCount: keyCount,
          showInsertClippingCmd: true
        };

        let dlg = window.openDialog("chrome://clippings/content/shortcutHelp.xul", "clipkey_help", "centerscreen,resizable", dlgArgs);

        return;
      }
      else if (dlgArgs.action == dlgArgs.ACTION_SHORTCUT_KEY) {
        let dlg = window.openDialog("chrome://clippings/content/clippingKey.xul",
                                    "clipkey_dlg", "modal,centerscreen", dlgArgs);
      }
      else if (dlgArgs.action == dlgArgs.ACTION_SEARCH_CLIPPING) {
        let dlg = window.openDialog("chrome://clippings/content/searchClipping.xul",
                                    "clipsrch_dlg", "modal,centerscreen", dlgArgs);
      }
    } while (dlgArgs.switchModes && !dlgArgs.userCancel);

    if (dlgArgs.userCancel) {
      return;
    }

    if (dlgArgs.clippingURI) {
      this.insertClippingText(dlgArgs.clippingURI,
                              this.clippingsSvc.getName(dlgArgs.clippingURI),
                              this.clippingsSvc.getText(dlgArgs.clippingURI));
    }
  },


  _isContentAreaTextBoxFocused: function ()
  {
    var rv = false;

    // TO DO: This will break in e10s
    var focusedElt = document.commandDispatcher.focusedElement;

    if (focusedElt instanceof HTMLInputElement || focusedElt instanceof HTMLTextAreaElement) {
      // <input type="text"> or <textarea>
      rv = true;
    }
    else {
      // Rich edit box - an <iframe> with designMode == "on"
      // TO DO: This will break in e10s
      var doc = document.commandDispatcher.focusedWindow.document;
      rv = doc.designMode == "on";
    }

    return rv;
  },


  saveClippings: function () 
  {
    var title = this.strBundle.getString('appName');
    try {
      this.clippingsSvc.flushDataSrc(true);
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

    // First-run initialization - import from Clippings 1.x if necessary.
    if (this.aeUtils.getPref("clippings.first_run", true) == true) {
      this._firstRunInit();
      this.aeUtils.setPref("clippings.first_run", false);
    }

    // Migration of deprecated common clippings pref (Clippings 4.0+)
    if (this.aeUtils.getPref("clippings.migrate_common_ds_pref", true) == true) {
      this.aeClippings3.migrateCommonDataSrcPref();
      this.aeUtils.setPref("clippings.migrate_common_ds_pref", false);
    }

    // First-run initialization after upgrade from 1.x/2.x -> 3.0+
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
      this.aeUtils.log("Clippings: initClippings():\nResetting data source location on Portable " + this.aeUtils.getHostAppName());
      this.aeUtils.setPref("clippings.datasource.location", profilePath);
    }

    // Set up Clippings backup.
    var dataSrcPathURL = this.aeUtils.getDataSourcePathURL();
    var backupDirURL = dataSrcPathURL + this.aeConstants.BACKUP_DIR_NAME;
    this.clippingsSvc.setBackupDir(backupDirURL);
    this.clippingsSvc.setMaxBackupFiles(this.aeUtils.getPref("clippings.backup.maxfiles", 10));

    // Initializing data source on Clippings context menu
    var menu = document.getElementById("ae-clippings-menu-1");
    var popup = document.getElementById("ae-clippings-popup-1");
    this.initClippingsPopup(popup, menu);

    this.aeUtils.log(this.aeString.format("Clippings: initClippings():\nInitializing Clippings integration with host app window.\nHost app: %s (version %s); OS: %s; Australis UI: %b.\nDatasource location: %s", this.aeUtils.getHostAppName(), this.aeUtils.getHostAppVersion(), this.aeUtils.getOS(), this.isAustralisUI(), dataSrcPathURL));

    // Add null clipping to root folder if there are no items
    if (this.aeUtils.getPref("clippings.datasource.process_root", true) == true) {
      this.clippingsSvc.processRootFolder();
      this.aeUtils.setPref("clippings.datasource.process_root", false);
    }

    // Attaching event handlers to browser context menu 
    var hostAppContextMenu = document.getElementById("contentAreaContextMenu");
    hostAppContextMenu.addEventListener("popupshowing", 
					this._initContextMenuItem, 
					false);
    hostAppContextMenu.addEventListener("popuphiding",
					this._hideContextMenuItem,
					false);

    let that = this;

    this._clippingsListener = {
      origin:  that.clippingsSvc.ORIGIN_HOSTAPP,

      newFolderCreated: function (aFolderURI) {
        this._rebuildMenu();
      },

      newClippingCreated: function (aClippingURI) {},

      importDone: function (aNumItems) {
        this._rebuildMenu();
      },

      dataSrcLocationChanged: function (aDataSrcURL) {
        var menu = document.getElementById("ae-clippings-menu-1");
        var popup = document.getElementById("ae-clippings-popup-1");

        // Reinitialize Clippings menu so that it points to the correct
        // datasource.
        menu.database.RemoveDataSource(that._ds);
        that.initClippingsPopup(popup, menu);
      },

      _rebuildMenu: function () {
        that.aeUtils.log("clippingsListener (browser window): Rebuilding Clippings submenu");
        var menu = document.getElementById("ae-clippings-menu-1");
        menu.builder.rebuild();
      }
    };

    this.clippingsSvc.addListener(this._clippingsListener);

    // Set behaviour of "New Clipping" commands - prompt vs. silent operation
    this.showDialog = true;
    try {
      this.showDialog = !(this.aeUtils.getPref("clippings.entries.add_silently", false));
    }
    catch (e) {}

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
      document.getElementById("mainKeyset").removeChild(keyElt);
    }

    // Initialize support for multi-process tabs.
    // TO DO: Should I check if frame script has already been loaded by another
    // browser window??
    this.aeUtils.log("Initializing support for multi-process browser tabs.");
    let globalMM = Components.classes["@mozilla.org/globalmessagemanager;1"].getService(Components.interfaces.nsIMessageListenerManager);
    globalMM.loadFrameScript("chrome://clippings/content/fxBrowserFrame.js", true);

    let windowMM = window.messageManager;
    windowMM.addMessageListener(this.aeConstants.MSG_RESP_IS_READY_FOR_SHORTCUT_MODE, this.handleResponseIsReadyForShortcutMode);
    windowMM.addMessageListener(this.aeConstants.MSG_RESP_NEW_CLIPPING_FROM_TEXTBOX, this.handleResponseNewClippingFromTextbox);
    windowMM.addMessageListener(this.aeConstants.MSG_RESP_NEW_CLIPPING_FROM_SELECTION, this.handleResponseNewFromSelection);

    this.isClippingsInitialized = true;
  },

  // Next two methods are event handlers for the Clippings popup menu; they are
  // to be invoked by the event handling code only.
  _initContextMenuItem: function (aEvent) {
    var that = window.aecreations.clippings;
    that.initContextMenuItem.apply(that, arguments);
  },

  _hideContextMenuItem: function (aEvent) {
    var that = window.aecreations.clippings;
    that.hideContextMenuItem.apply(that, arguments);
  },


  _firstRunInit: function ()
  {
    if (this.isAustralisUI()) {
      CustomizableUI.addWidgetToArea("ae-clippings-icon", "nav-bar");
    }
    else {
      // Add the Clippings icon to the Add-on Bar.
      var addonBar = document.getElementById("addon-bar");
      var clippingsBtn = document.getElementById("ae-clippings-icon");
    
      if (addonBar && !clippingsBtn) {
        // The following Add-on Bar item would exist if the user has installed
        // the Status-4-Evar extension.
        var grippyElt = document.getElementById("status4evar-window-gripper");

        addonBar.insertItem("ae-clippings-icon", grippyElt);
        addonBar.setAttribute("currentset", addonBar.currentSet);
        document.persist("addon-bar", "currentset");

        // Make the Add-on Bar appear if it was hidden.
        var isAddonBarCollapsed = addonBar.getAttribute("collapsed");
        if (isAddonBarCollapsed) {
          addonBar.setAttribute("collapsed", "false");
        }
      }
    }

    // Starting with Clippings 4.0, the status bar in Clippings Manager will
    // be hidden by default for new users.  Users upgrading from earlier
    // versions of Clippings will continue to see the status bar.
    this.aeUtils.setPref("clippings.clipmgr.status_bar", false);

    // Migrate Clippings 1.x datasource, if it exists.
    var oldClipdatFile, clipdat2File;  // nsIFile objects
    oldClipdatFile = this.aeUtils.getUserProfileDir();
    clipdat2File = this.aeUtils.getUserProfileDir();
    clipdat2File.append(this.aeConstants.CLIPDAT_FILE_NAME);
    oldClipdatFile.append(this.aeConstants.CLIPDAT_1X_FILE_NAME);
    
    if (!oldClipdatFile.exists() || !oldClipdatFile.isFile()) {
      this.aeUtils.log("It appears that Clippings 1.x was never installed previously.  Welcome!");
      return;
    }
    if (clipdat2File.exists() && clipdat2File.isFile()) {
      this.aeUtils.log("Clippings data source file already exists.  Skipping first-run initialization.");
      return;
    }

    this.initClippingsPopup(document.getElementById("ae-clippings-popup-1"),
			    document.getElementById("ae-clippings-menu-1"));
    var numImported = -1;
    var oldClipdatURL = this.aeUtils.getDataSourcePathURL() + this.aeConstants.CLIPDAT_1X_FILE_NAME;
    try {
      numImported = this.clippingsSvc.importFromFile(oldClipdatURL, true, false, {});
    }
    catch (e) {
      this.aeUtils.alertEx(this.strBundle.getString("appName"),
			    this.strBundle.getString("errorImportFailed"));
      this.aeUtils.log(e);
    }

    if (numImported != -1) {
      this.aeUtils.log("Your Clippings 1.x data was imported successfully.");

      try {
	this.clippingsSvc.flushDataSrc(true);
	this.aeUtils.log("Flushed imported data to disk.");
      }
      catch (e) {
	this.alert(this.strBundle.getString("alertSaveFailed") + "\n" + e);
      }
    }
  },


  isAustralisUI: function ()
  {
    return document.getElementById("PanelUI-menu-button") != null;
  },


  initContextMenuItem: function (aEvent)
  {
    // This method performs initialization of menu items of the Clippings
    // popup menus - the one that appears in a text box or rich text box
    // (id='ae-clippings-popup-1') and the one for the browser content area
    // (id='ae-clippings-popop-2').

    if (! this.dataSrcInitialized) {
      throw "clippings.initContextMenuItem(): Data source not initialized!";
    }

    if (aEvent.target.id != "contentAreaContextMenu") {
      this.aeUtils.log("clippings.initContextMenuItem(): event.target.id is not 'contentAreaContextMenu'; returning");
      return;
    }

    if (! gContextMenu) {
      this.aeUtils.log("clippings.initContextMenuItem(): method invoked by unknown caller; gContextMenu object is null; returning");
      return;
    }

    var clippingsMenu1 = document.getElementById("ae-clippings-menu-1");
    var popup = document.getElementById("ae-clippings-popup-1");

    this.aeUtils.log("Clippings submenu object: " + (clippingsMenu1 || "??"));

    // Reattach the Clippings datasource to the Clippings menu if it is lost.
    // This is known to occur on Firefox 3 if the Menu Editor extension is
    // installed and its datasource is loaded (menuedit.rdf).
    var dataSrcs = clippingsMenu1.database.GetDataSources();
    var dataSrcFound = false;
    var re = new RegExp(this.aeConstants.CLIPDAT_FILE_NAME + "$");   

    while (!dataSrcFound && dataSrcs.hasMoreElements()) {
      var dataSrc = dataSrcs.getNext();
      dataSrc = dataSrc.QueryInterface(Components.interfaces.nsIRDFDataSource);
      if (re.test(dataSrc.URI)) {
	dataSrcFound = true;
      }
    }

    if (! dataSrcFound) {
      this.aeUtils.log("clippings.initContextMenuItem(): Clippings datasource is missing from the Clippings menu's datasources\nInvoking clippings.initClippingsPopup() to reattach it.");
      this.initClippingsPopup(popup, clippingsMenu1);
    }

    this.aeUtils.log("clippings.initContextMenuItem(): Refreshing/rebuilding menu");
    clippingsMenu1.builder.refresh();
    clippingsMenu1.builder.rebuild();

    var strBundle = document.getElementById("ae-clippings-strings");
    var ellipsis = this.showDialog ? this.strBundle.getString("ellipsis") : "";
    var clippingsMenu2 = document.getElementById("ae-clippings-menu-2");

    var addEntryCmd = document.getElementById("ae_new_clipping_from_textbox");
    var cxtMenu = aEvent.target;

    this.aeUtils.log(this.aeString.format("clippings.initContextMenuItem(): Properties of browser context menu (instance of nsContextMenu object): onTextInput: %b, onEditableArea: %b,isDesignMode: %b, textSelected: %b, isTextSelected: %b", gContextMenu.onTextInput, gContextMenu.onEditableArea, gContextMenu.isDesignMode, gContextMenu.textSelected, gContextMenu.isTextSelected));

    // TEMPORARY
    // What are the properties of gContextMenuContentData?
    let propStr = "";
    for (let p in gContextMenuContentData) {
      propStr += p + ", ";
    }
    this.aeUtils.log("Properties of gContextMenuContentData: " + propStr);
    this.aeUtils.log(this.aeString.format("gContextMenuContentData.event: %s, popupNode: %s, editFlags: %s", gContextMenuContentData.event, gContextMenuContentData.popupNode, gContextMenuContentData.editFlags));

    // What are the properties of gContextMenuContentData.selectionInfo?
    let selInfoObj = gContextMenuContentData.selectionInfo;
    propStr = "";
    for (let p in selInfoObj) {
      propStr += p + ", ";
    }
    this.aeUtils.log("Properties of gContextMenuContentData.selectionInfo: " + propStr);
    this.aeUtils.log(this.aeString.format("gContextMenuContentData.selectionInfo.text: %s", gContextMenuContentData.selectionInfo.text));
    // END TEMPORARY

    if (gContextMenu.onTextInput) {
      // TO DO: Avoid relying on gContextMenu.target, as use of its properties
      // will cause "unsafe CPOW usage" warnings.
      this._triggerNode = gContextMenu.target;
      this._popupNode = gContextMenuContentData.popupNode;

      if (gContextMenu.isDesignMode) {  // Rich text editor
        if (gContextMenuContentData.selectionInfo.text) {
          this.aeUtils.log("clippings.initContextMenuItem(): Selected text inside a rich edit box");
          clippingsMenu1.hidden = false;
          clippingsMenu2.hidden = true;
	  
          addEntryCmd.setAttribute("disabled", "false");
          addEntryCmd.setAttribute("label", this.strBundle.getString("newFromSelect") + ellipsis);
        }
        else {
          this.aeUtils.log("clippings.initContextMenuItem(): Inside a rich text edit box; no selected text");

          // Works for now on e10s - but uses an unsafe CPOW!
          var doc = gContextMenu.target.ownerDocument;
          this.aeUtils.log(this.aeString.format("gContextMenu.target.ownerDocument: %s", doc));

          // Check for empty document
          var range = doc.createRange();
          range.setStart(doc.body.firstChild, 0);
          range.setEnd(doc.body.lastChild, 0);
          addEntryCmd.setAttribute("disabled", range == "");

          clippingsMenu1.hidden = false;
          clippingsMenu2.hidden = true;
          addEntryCmd.setAttribute("label", this.strBundle.getString("new") + ellipsis);
        }
      }
      else {  // Normal HTML textbox or textarea
	if (gContextMenuContentData.selectionInfo.text) {
	  // "New From Selection..." command.
	  addEntryCmd.setAttribute("label",
				   this.strBundle.getString("newFromSelect") 
				   + ellipsis);
	  addEntryCmd.setAttribute("disabled", "false");
	}
	else {
	  // Enable "New..." command
	  addEntryCmd.setAttribute("label",
				   this.strBundle.getString("new") + ellipsis);

          // Works for now on e10s, but uses an unsafe CPOW!
          let textbox = this._triggerNode;
	  addEntryCmd.setAttribute("disabled", textbox.value == "");
          /***
	  addEntryCmd.setAttribute("disabled", "false");
          ***/
	}
      }
      
      this._initAutoIncrementPlaceholderMenu(1);
      clippingsMenu1.hidden = false;
      clippingsMenu2.hidden = true;
    }

    // Selected text in browser content area
    else if (gContextMenuContentData.selectionInfo.text) {
      this._initAutoIncrementPlaceholderMenu(2);
      clippingsMenu1.hidden = true;
      clippingsMenu2.hidden = false;

      addEntryCmd = document.getElementById("ae_new_clipping_from_selection");
      addEntryCmd.setAttribute("label",
			       this.strBundle.getString("newFromSelect") 
			       + ellipsis);
    }
  },


  hideContextMenuItem: function (aEvent)
  {
    var popup = document.getElementById("ae-clippings-popup-1");
    var clippingsMenu1 = document.getElementById("ae-clippings-menu-1");
    var clippingsMenu2 = document.getElementById("ae-clippings-menu-2");

    if (aEvent.target.id == "contentAreaContextMenu") {
      clippingsMenu1.hidden = true;
      clippingsMenu2.hidden = true;
    }
  },


  _initAutoIncrementPlaceholderMenu: function (aWhich)
  {
    var resetAutoIncrVarsMenu = document.getElementById("reset-auto-increment-vars-" + aWhich);
    var resetAutoIncrVarsMenuseparator = document.getElementById("reset-auto-increment-vars-separator-" + aWhich);
    var autoIncrVarsMenuPopup = document.getElementById("reset-auto-increment-vars-menu-popup-" + aWhich);

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
Components.utils.import("resource://clippings/modules/aeUtils.js",
			window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aeString.js",
                        window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aeCreateClippingHelper.js",
			window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aeClippingSubst.js",
                        window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aeClippings3.js",
                        window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aePrefMigrator.js",
			window.aecreations.clippings);
Components.utils.import("resource://clippings/modules/aeInsertTextIntoTextbox.js", window.aecreations.clippings);


//
// Event handler initialization
//

window.addEventListener("load",   window.aecreations.clippings, false);
window.addEventListener("unload", window.aecreations.clippings, false);
