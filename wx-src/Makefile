# Makefile for Clippings/wx

EXT_VER=`./getver.pl`
DIST_FILE=clippings-$(EXT_VER).zip
SRC_FILE=clippings-$(EXT_VER)-src.zip
EXCLUDE=*~ *\.pl *\.sh *\.devel *\.release *\.src\.js *\.src\.css Makefile *-chrome\.json


$(DIST_FILE):
	zip -r $(DIST_FILE) * -x $(EXCLUDE)

source:
	zip -r $(SRC_FILE) * -x *~ manifest-chrome\.json

clean:
	rm -v *.zip

# END Makefile
