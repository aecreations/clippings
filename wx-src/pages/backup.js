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

  let lang = browser.i18n.getUILanguage();
  document.body.dataset.locale = lang;

  // Reset backup notification interval timer so that it fires 24 hours after
  // displaying this first-time backup dialog.
  await browser.runtime.sendMessage({msgID: "clear-backup-notifcn-intv"});
  browser.runtime.sendMessage({msgID: "set-backup-notifcn-intv"});
  
  $("#backup-now").click(aEvent => { backupNow() });
  $("#btn-close").click(aEvent => { closeDlg() });

  let backupRemFreq = await aePrefs.getPref("backupRemFrequency");
  $("#backup-reminder").prop("checked", (backupRemFreq != aeConst.BACKUP_REMIND_NEVER)).click(aEvent => {
    let setPref;
    
    if (aEvent.target.checked) {
      $("#backup-reminder-freq").prop("disabled", false);
      setPref = aePrefs.setPrefs({
        backupRemFrequency: Number($("#backup-reminder-freq").val()),
        backupRemFirstRun: false,
        lastBackupRemDate: new Date().toString(),
      });
    }
    else {
      $("#backup-reminder-freq").prop("disabled", true);
      setPref = aePrefs.setPrefs({
	backupRemFrequency: aeConst.BACKUP_REMIND_NEVER,
      });
    }

    setPref.then(() => {
      return browser.runtime.sendMessage({msgID: "clear-backup-notifcn-intv"});

    }).then(() => {
      if (aEvent.target.checked) {
	browser.runtime.sendMessage({msgID: "set-backup-notifcn-intv"});
      }
    });
  });

  if (backupRemFreq == aeConst.BACKUP_REMIND_NEVER) {
    // Set to default interval.
    $("#backup-reminder-freq").val(aeConst.BACKUP_REMIND_WEEKLY).prop("disabled", true);
  }
  else {
    $("#backup-reminder-freq").val(backupRemFreq);
  }

  $("#backup-reminder-freq").change(async (aEvent) => {
    await aePrefs.setPrefs({
      backupRemFrequency: Number(aEvent.target.value),
      backupRemFirstRun: false,
      lastBackupRemDate: new Date().toString(),
    });

    await browser.runtime.sendMessage({msgID: "clear-backup-notifcn-intv"});
    browser.runtime.sendMessage({msgID: "set-backup-notifcn-intv"});
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
