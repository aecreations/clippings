#!bash

if [ -f manifest-firefox.json ] ; then
    mv -v manifest.json manifest-chrome.json
    mv -v manifest-firefox.json manifest.json
elif [ -f manifest-chrome.json ] ; then
    mv -v manifest.json manifest-firefox.json
    mv -v manifest-chrome.json manifest.json
fi
