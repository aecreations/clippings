# Makefile for compiling Clippings XPCOM type libraries

XPIDL_INC=c:/xulrunner-sdk/idl
XPIDL=xpidl.exe

all: nsIClippingsService.xpt nsIClippingsExtension.xpt nsIDictionary.xpt

nsIClippingsService.xpt: nsIClippingsService.idl nsClippingsService.js 
	$(XPIDL) -m typelib -w -v -I $(XPIDL_INC) -o nsIClippingsService nsIClippingsService.idl

nsIClippingsExtension.xpt: nsIClippingsExtension.idl nsClippingsExtension.js
	$(XPIDL) -m typelib -w -v -I $(XPIDL_INC) -o nsIClippingsExtension nsIClippingsExtension.idl

nsIDictionary.xpt: nsIDictionary.idl nsDictionary.js
	$(XPIDL) -m typelib -w -v -I $(XPIDL_INC) -o nsIDictionary nsIDictionary.idl

clean:
	rm *.xpt

# End Makefile
