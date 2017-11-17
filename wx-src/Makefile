# Makefile for Clippings/wx

EXT_VER=`./getver.pl`
DIST_FILE=clippings-$(EXT_VER).zip
DIST_DEST=/cygdrive/e/
EXCLUDE=*~ *\.pl *\.sh *\.devel *\.release Makefile *-chrome\.json


$(DIST_FILE):
	zip -r $(DIST_FILE) * -x $(EXCLUDE)

copy:
	cp -v $(DIST_FILE) $(DIST_DEST)

clean:
	rm -v *.zip

# END Makefile
