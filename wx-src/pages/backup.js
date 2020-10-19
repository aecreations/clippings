/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let gClippings;


// Dialog initialization
$(() => {
  browser.history.deleteUrl({ url: window.location.href });

  gClippings = chrome.extension.getBackgroundPage();

  if (! gClippings) {
    throw new Error("Clippings/wx::backup.js: Failed to retrieve parent browser window!");
  }

  // Reset backup notification interval timer so that it fires 24 hours after
  // displaying this first-time backup dialog.
  gClippings.clearBackupNotificationInterval();
  gClippings.setBackupNotificationInterval();

  let lang = browser.i18n.getUILanguage();
  if (lang == "fr") {
    $("#backup-hint").css({ letterSpacing: "-0.3px" });
  }

  $("#backup-now").click(aEvent => {
    gClippings.openClippingsManager(true);
  });
  
  $("#btn-close").click(aEvent => { closeDlg() });

  browser.storage.local.get().then(aPrefs => {
    $("#backup-reminder").prop("checked", (aPrefs.backupRemFrequency != aeConst.BACKUP_REMIND_NEVER)).click(aEvent => {
      let setPref;
      
      if (aEvent.target.checked) {
        $("#backup-reminder-freq").prop("disabled", false);
        setPref = browser.storage.local.set({
          backupRemFrequency: Number($("#backup-reminder-freq").val()),
          backupRemFirstRun: false,
          lastBackupRemDate: new Date().toString(),
        });
      }
      else {
        $("#backup-reminder-freq").prop("disabled", true);
        setPref = browser.storage.local.set({
	  backupRemFrequency: aeConst.BACKUP_REMIND_NEVER,
	});
      }

      setPref.then(() => {
	gClippings.clearBackupNotificationInterval();
	if (aEvent.target.checked) {
	  gClippings.setBackupNotificationInterval();
	}
      });
    });

    if (aPrefs.backupRemFrequency == aeConst.BACKUP_REMIND_NEVER) {
      // Set to default interval.
      $("#backup-reminder-freq").val(aeConst.BACKUP_REMIND_WEEKLY).prop("disabled", true);
    }
    else {
      $("#backup-reminder-freq").val(aPrefs.backupRemFrequency);
    }

    $("#backup-reminder-freq").change(aEvent => {
      browser.storage.local.set({
        backupRemFrequency: Number(aEvent.target.value),
        backupRemFirstRun: false,
        lastBackupRemDate: new Date().toString(),

      }).then(() => {
	gClippings.clearBackupNotificationInterval();
        gClippings.setBackupNotificationInterval();
      });
    });

    // Fix for Fx57 bug where bundled page loaded using
    // browser.windows.create won't show contents unless resized.
    // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
    browser.windows.getCurrent(aWnd => {
      browser.windows.update(aWnd.id, {
	width: aWnd.width + 1,
	focused: true,
      });
    });
  });
});


function closeDlg()
{
  chrome.windows.remove(chrome.windows.WINDOW_ID_CURRENT);
}


$(window).on("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.tagName != "TEXTAREA") {
    aEvent.preventDefault();
  }
});


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
