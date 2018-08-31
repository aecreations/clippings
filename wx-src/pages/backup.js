/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let gClippings;


// Dialog initialization
$(() => {
  chrome.history.deleteUrl({ url: window.location.href });

  gClippings = chrome.extension.getBackgroundPage();

  if (! gClippings) {
    throw new Error("Clippings/wx::backup.js: Failed to retrieve parent browser window!");
  }

  $("#backup-now").click(aEvent => {
    gClippings.openClippingsManager(true);
  });
  
  $("#btn-close").click(aEvent => { closeDlg() });

  browser.storage.local.get().then(aPrefs => {
    $("#backup-reminder-freq").val(aPrefs.backupRemFrequency).change(aEvent => {
      browser.storage.local.set({
        backupRemFrequency: Number(aEvent.target.value),
        backupRemFirstRun: false,
        lastBackupRemDate: new Date().toString(),

      }).then(() => {
	gClippings.clearBackupNotificationInterval();
	if (aEvent.target.value != aeConst.BACKUP_REMIND_NEVER) {
          gClippings.setBackupNotificationInterval();
	}
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
