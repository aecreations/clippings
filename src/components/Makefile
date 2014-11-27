# Makefile for compiling Clippings XPCOM type libraries

XPIDL_INC=c:/xulrunner-sdk/idl
XPIDL=xpidl.exe

all: nsIClippingsService.xpt aeIDictionary.xpt

nsIClippingsService.xpt: nsIClippingsService.idl nsClippingsService.js 
	$(XPIDL) -m typelib -w -v -I $(XPIDL_INC) -o nsIClippingsService nsIClippingsService.idl

aeIDictionary.xpt: aeIDictionary.idl aeDictionary.js
	$(XPIDL) -m typelib -w -v -I $(XPIDL_INC) -o aeIDictionary aeIDictionary.idl

clean:
	rm *.xpt

# End Makefile
