---
layout: page
title: Frequently Asked Questions
---

Read this first before posting your question to the forums or filing a bug – it may already be answered here.


#### I just installed Clippings. How do I use it?

Read the [Quick Start Guide](https://aecreations.sourceforge.io/clippings/quickstart.php). The Quick Start Guide is a short tutorial aimed at first-time users, and describes how to perform basic tasks in Clippings.

#### When installing Clippings for Firefox, I am asked to confirm several add-on permissions. Why does Clippings need all these permissions?

See the [Add-on Permissions](permissions.md) page for an explanation of the add-on permissions requested by Clippings.

#### I installed Clippings, but it doesn't work in Thunderbird. Why?

You must download and install Clippings in both Firefox and Thunderbird if you want to use Clippings in both programs. Installing Clippings in one program will not install it in the other.

Download links for Firefox and Thunderbird can be found in the [Install](https://aecreations.sourceforge.io/clippings/install.php) page.

#### Where is my Clippings data stored?

This depends on whether you are using Clippings 6 (for Firefox or Thunderbird), or Clippings for Thunderbird 5.6/5.7.

* **Clippings 6** - Your clippings are stored in a database file in your Firefox or Thunderbird user profile. Use [Sync Clippings](https://aecreations.sourceforge.io/clippings/sync.php) to sync your clippings across your other devices.

* **Clippings for Thunderbird 5.6/5.7** - You can look this up from Clippings Manager by clicking Tools → Data Source Settings, then looking at Data Source Location in the Clippings preferences dialog (Data Source tab). The default data source location is your Firefox or Thunderbird profile location; however, this can be changed from the extension preferences dialog (Data Source tab).

#### Does Clippings perform automatic backups?

This depends on whether you are using Clippings 6 (for Firefox or Thunderbird), or Clippings for Thunderbird 5.6/5.7.

* **Clippings 6** - Because Clippings 6 is a WebExtension, it is unable to save backups automatically. It is highly recommended that you backup your clippings from Clippings Manager on a regular basis. Turn on backup reminders from Clippings preferences so that you get a recurring reminder notification; you can choose how often you want to be reminded (every day, or every 2, 3, 5, 7, 14 or 30 days).

* **Clippings for Thunderbird 5.6/5.7** - Automatic backups are supported, and are turned on by default. Backup settings can be changed in the extension preferences dialog. To backup your clippings manually, open Clippings Manager and then click Tools → Backup.

#### Clippings has suddenly stopped working in Firefox. I get an error saying that it doesn't work in Private Browsing mode, but I didn't change my privacy settings.

If you didn't recently change the privacy settings in Firefox, then it is likely that the database used by Clippings for storing its data has become corrupted. To resolve this issue, [Refresh Firefox](https://support.mozilla.org/en-US/kb/refresh-firefox-reset-add-ons-and-settings), then reinstall Clippings.

#### Does Clippings work in Private Browsing mode?

Yes it does, but you'll need to change the "Run in Private Windows" setting from Add-ons Manager. From a Firefox browser window, click the Firefox menu , select Add-ons and Themes, click on the entry for Clippings in the list of installed extensions, scroll down the page and change the Run in Private Windows setting to Allow. Then restart Firefox to apply this change.

#### Does Clippings work if Firefox is set to "Never remember history"?

No. Setting this Firefox privacy setting to the most restrictive selection will disable Clippings. To enable Clippings, open the Firefox options page, click Privacy and Security, and change the history setting to Remember history or Use custom settings for history.

#### If I uninstall Clippings, will I lose my Clippings data?

Yes, if you are using Clippings 6. If you plan on reinstalling Clippings in the future, back up your data before uninstalling. This can be done from Clippings Manager.

#### How do I transfer my clippings to a different computer?

Follow these steps:

1.    Use the Export command in Clippings Manager (Tools → Export) to export your clippings data to a file. Select Clippings in the list of available export formats.
2.    On the computer where you want to transfer your clippings data, install Clippings in the desired host application (Firefox and/or Thunderbird).
3.    Copy the file exported in step 1 and note the location where you copied the file to.
4.    Start the host application, then open Clippings Manager, select Tools → Import, and locate the exported file.

#### I upgraded Firefox or Thunderbird, and Clippings doesn't work anymore!

You may have an older version of Clippings that wasn't updated. Click the Firefox or Thunderbird menu , then click Add-ons and Themes, select Clippings in the list of installed extensions, and right-click and select Find Updates. If that doesn't work, download a fresh copy from the [install page](https://aecreations.sourceforge.io/clippings/install.php).

Please note that nightly builds and alpha releases of Firefox and Thunderbird are not supported. Beta releases may be supported once Clippings has been tested on them and is confirmed to be working without significant regressions.

#### The Clippings Manager window is gone! How do I bring it back?

This may happen if there was a recent change to the display settings on your system (for example, the primary and secondary displays were swapped) and the option to save the Clippings Manager window size and position is turned on. To bring back Clippings Manager, the window size and position needs to be reset from Clippings preferences:

1.    First, make sure that Clippings Manager is closed before proceeding. To do this, click the Clippings button (this will open Clippings Manager, but the window may be hidden or partially off-screen), then press CTRL+W (or Command+W on macOS) to close the hidden window.
2.    Open Add-ons Manager (from the Firefox menu , select Add-ons and Themes)
3.    Locate Clippings in the list of installed extensions, then click the ... button on the right-hand side and then select Options to open the extension preferences page
4.    In the General Options section, click Windows and Dialogs
5.    In the Windows and Dialogs settings dialog, click Reset, and then click OK.

#### I don't like the default keyboard shortcut for invoking Clippings keyboard paste mode. Can I change it?

If you're using Clippings for Firefox, yes you can! The keyboard paste key can be changed from Clippings preferences.
