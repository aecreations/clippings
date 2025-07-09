#!/usr/bin/env python3

# This helper build script reads the specially-formatted MV3 version number
# in the extension manifest and converts it to the traditional Mozilla version
# numbering scheme used to denote pre-release builds.
# For details on the version numbering scheme used in MV3 extensions, see the
# source code comments in the aeMozVersion library.

import sys
import json
import time

RELEASETYPE_PRE_MAJOR = "pre-major"
RELEASETYPE_PRE_MINOR = "pre-minor"
RELEASETYPE_PRE_REVISION = "pre-revision"
RELEASETYPE_STABLE = "stable"

def get_moz_version(version):
    rv = ''
    parsed_ver = parse_version(version)
    if parsed_ver['releaseType'] == RELEASETYPE_STABLE:
        rv = version
    else:
        dev_build_sfx = ''
        if is_dev_build():
            dev_build_sfx = "+"
        moz_major = 0
        moz_minor = 0
        moz_ver_sfx = ''
        if parsed_ver['releaseType'] == RELEASETYPE_PRE_MAJOR:
            moz_major = int(parsed_ver['major']) + 1
            moz_minor = 0
            moz_ver_sfx = get_moz_version_suffix(parsed_ver['minor'], parsed_ver['revision'])
            rv = f"{moz_major}.{moz_minor}{moz_ver_sfx}{dev_build_sfx}"
        elif parsed_ver['releaseType'] == RELEASETYPE_PRE_MINOR:
            moz_major = parsed_ver['major']
            moz_minor = int(parsed_ver['minor']) + 1
            moz_ver_sfx = get_moz_version_suffix(parsed_ver['revision'], parsed_ver['patch'])
            rv = f"{moz_major}.{moz_minor}{moz_ver_sfx}{dev_build_sfx}"
        elif parsed_ver['releaseType'] == RELEASETYPE_PRE_REVISION:
            moz_major = parsed_ver['major']
            moz_minor = parsed_ver['minor']
            moz_rev = int(parsed_ver['revision']) + 1
            moz_ver_sfx = get_moz_version_suffix(parsed_ver['patch'], 1)
            rv = f"{moz_major}.{moz_minor}.{moz_rev}{moz_ver_sfx}{dev_build_sfx}"
    return rv

def is_dev_build():
    rv = False
    with open("scripts/aeConst.js", "r") as js_file:
        for line in js_file:
            if "DEV_BUILD: true" in line:
                rv = True
                break;
    return rv

def parse_version(version):
    rv = {}
    # Split the version and pad with empty strings to ensure 4 parts
    major, minor, revision, patch = (version.split(".") + ["", "", "", ""])[:4]
    rv['major'] = major
    rv['minor'] = minor
    rv['revision'] = revision
    rv['patch'] = patch
    pre_major_values = [98, 99, 998, 999]
    pre_revision_values = [97, 98, 99, 998, 999]
    try:
        if int(minor) in pre_major_values:
            rv['releaseType'] = RELEASETYPE_PRE_MAJOR
        elif revision != '' and int(revision) in pre_major_values:
            rv['releaseType'] = RELEASETYPE_PRE_MINOR
        elif patch != '' and int(patch) in pre_revision_values:
            rv['releaseType'] = RELEASETYPE_PRE_REVISION
        else:
            rv['releaseType'] = RELEASETYPE_STABLE
    except ValueError:
        sys.stderr.write(f"Error: Invalid MV3 version number: {version}")
    return rv

def get_moz_version_suffix(subversion, pre_release_version=1):
    rv = ''
    subversion = int(subversion)
    if pre_release_version == '':
        pre_release_version = 1
    pre_release_version = int(pre_release_version)
    if subversion == 97:  # pre-alpha
        rv = "a0"
    elif subversion == 98:  # alpha
        rv = f"a{pre_release_version}"
    elif subversion == 99:  # beta
        rv = f"b{pre_release_version}"
    elif subversion == 998:  # technical preview
        rv = f"pre{pre_release_version}"
    elif subversion == 999:  # release candidate
        rv = f"rc{pre_release_version}"
    return rv


with open("manifest.json", "r") as fh:
    manifest_json = fh.read()
manifest = json.loads(manifest_json)
ver = manifest.get("version", '')
moz_ver = get_moz_version(ver)
if moz_ver.endswith("+"):
    # Development build for testing
    moz_ver += "." + time.strftime("%Y%m%d", time.localtime())
sys.stdout.write(moz_ver)
