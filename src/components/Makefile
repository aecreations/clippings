# Makefile for compiling Clippings XPCOM type libraries

XPIDL_INC=c:/xulrunner-sdk/idl
XPIDL=xpidl.exe

all: aeIClippingsService.xpt aeIDictionary.xpt

aeIClippingsService.xpt: aeIClippingsService.idl aeClippingsService.js 
	$(XPIDL) -m typelib -w -v -I $(XPIDL_INC) -o aeIClippingsService aeIClippingsService.idl

aeIDictionary.xpt: aeIDictionary.idl aeDictionary.js
	$(XPIDL) -m typelib -w -v -I $(XPIDL_INC) -o aeIDictionary aeIDictionary.idl

clean:
	rm *.xpt

# End Makefile
