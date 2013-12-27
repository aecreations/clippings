# Makefile

EXT_VER=`./getver.pl`
DIST_FILE=clippings-$(EXT_VER).xpi
CHROME = ./chrome
COMPONENTS = ./components
COMP_FILES = $(COMPONENTS)/nsIClippingsService.xpt                            \
$(COMPONENTS)/nsClippingsService.js                                           \
$(COMPONENTS)/nsIDictionary.xpt $(COMPONENTS)/nsDictionary.js                 \
$(COMPONENTS)/nsIClippingsExtension.xpt $(COMPONENTS)/nsClippingsExtension.js
MODULES = ./modules
MODULE_FILES = $(MODULES)/aeClippings3.js $(MODULES)/aeClippingSubst.js       \
$(MODULES)/aeConstants.js $(MODULES)/aeUtils.js $(MODULES)/aeString.js        \
$(MODULES)/aeCreateClippingHelper.js $(MODULES)/aePackagedClippings.js        \
$(MODULES)/aeMozApplication.js $(MODULES)/aePrefMigrator.js
DEFAULTS_PREFS = ./defaults/preferences
EXCLUDE = \*.html \*~ \*.psp \*.bak


$(DIST_FILE): $(CHROME)/clippings.jar install.rdf $(DEFAULTS_PREFS)/prefs.js $(COMP_FILES)
	[ ! -f chrome.manifest.devel ] && mv -v chrome.manifest chrome.manifest.devel && cp -v chrome.manifest.release chrome.manifest
	zip $(DIST_FILE) $(CHROME)/clippings.jar install.rdf chrome.manifest  \
$(DEFAULTS_PREFS)/prefs.js $(COMP_FILES) $(MODULE_FILES)

$(CHROME)/clippings.jar: 
	cd $(CHROME); zip -r clippings.jar * -x $(EXCLUDE); zip -d clippings.jar content/strfmt.js content/strtrm.js

$(COMP_FILES):
	@cd $(COMPONENTS); make

clean:
	rm -f ./$(DIST_FILE) $(CHROME)/clippings.jar
	[ -f chrome.manifest.devel ] && rm -v chrome.manifest && mv -v chrome.manifest.devel chrome.manifest

clean-all:
	rm -f ./$(DIST_FILE) $(CHROME)/clippings.jar
	@cd $(COMPONENTS); make clean
	[ -f chrome.manifest.devel ] && rm -v chrome.manifest && mv -v chrome.manifest.devel chrome.manifest

# End of Makefile
