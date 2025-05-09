/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Dialog initialization
$(async () => {
  let lang = browser.i18n.getUILanguage();
  document.body.dataset.locale = lang;

  let platform = await browser.runtime.getPlatformInfo();
  document.body.dataset.os = platform.os;
  aeInterxn.init(platform.os);

  // Reset backup notification interval timer so that it fires 24 hours after
  // displaying this first-time backup dialog.
  await browser.runtime.sendMessage({msgID: "clear-backup-notifcn-intv"});
  browser.runtime.sendMessage({msgID: "set-backup-notifcn-intv"});
  
  $("#backup-now").on("click", aEvent => { backupNow() });
  $("#btn-close").on("click", aEvent => { closeDlg() });

  let backupRemFreq = await aePrefs.getPref("backupRemFrequency");
  $("#backup-reminder").prop("checked", (backupRemFreq != aeConst.BACKUP_REMIND_NEVER)).on("click", aEvent => {
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
  browser.runtime.sendMessage({ msgID: "backup-clippings" });
}


function closeDlg()
{
  browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
}


$(window).keydown(aEvent => {
  if (aEvent.key == "Enter") {
    // Avoid duplicate invocation due to pressing ENTER while the Backup Now
    // button is focused.
    if (aEvent.target.id != "backup-now") {
      backupNow();
    }
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
