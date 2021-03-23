/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let gClippings;


// Dialog initialization
$(async () => {
  browser.history.deleteUrl({ url: window.location.href });

  gClippings = browser.extension.getBackgroundPage();

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

  $("#backup-now").click(aEvent => { backupNow() });
  $("#btn-close").click(aEvent => { closeDlg() });

  let prefs = await browser.storage.local.get("backupRemFrequency");
  $("#backup-reminder").prop("checked", (prefs.backupRemFrequency != aeConst.BACKUP_REMIND_NEVER)).click(aEvent => {
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

  if (prefs.backupRemFrequency == aeConst.BACKUP_REMIND_NEVER) {
    // Set to default interval.
    $("#backup-reminder-freq").val(aeConst.BACKUP_REMIND_WEEKLY).prop("disabled", true);
  }
  else {
    $("#backup-reminder-freq").val(prefs.backupRemFrequency);
  }

  $("#backup-reminder-freq").change(async (aEvent) => {
    await browser.storage.local.set({
      backupRemFrequency: Number(aEvent.target.value),
      backupRemFirstRun: false,
      lastBackupRemDate: new Date().toString(),
    });
    gClippings.clearBackupNotificationInterval();
    gClippings.setBackupNotificationInterval();
  });

  // Fix for Fx57 bug where bundled page loaded using
  // browser.windows.create won't show contents unless resized.
  // See <https://bugzilla.mozilla.org/show_bug.cgi?id=1402110>
  let wnd = await browser.windows.getCurrent();
  browser.windows.update(wnd.id, {
    width: wnd.width + 1,
    focused: true,
  });
});


function backupNow()
{
  gClippings.openClippingsManager(true);
}


function closeDlg()
{
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}


$(window).keydown(aEvent => {
  if (aEvent.key == "Enter") {
    backupNow();
  }
  else if (aEvent.key == "Escape") {
    closeDlg();
  }
  else {
    aeInterxn.suppressBrowserShortcuts(aEvent);
  }
});


$(window).on("contextmenu", aEvent => {
  aEvent.preventDefault();
});


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
