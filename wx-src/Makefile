# Makefile for Clippings

EXT_VER=`./getver.py`
DIST_FILE=clippings-$(EXT_VER).zip
EXCLUDE=*~ *\.py *\.sh *\.src\.js *\.src\.css Makefile *-chrome\.json


$(DIST_FILE):
	zip -r $(DIST_FILE) * -x $(EXCLUDE)

clean:
	rm -v *.zip

# END Makefile
