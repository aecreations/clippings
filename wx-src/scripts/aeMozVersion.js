/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Converts MV3-compatible extension version numbers to legacy Mozilla
// version format. Examples:
//
// MV3         Mozilla
// =========   =========
// 4.98.0      5.0a0
// 4.98.6      5.0a6
// 4.99.3      5.0b3
// 4.998.1     5.0pre1
// 4.999.2     5.0rc2
// 5.0         5.0
// 5.0.98.0    5.1a0
// 5.0.98.4    5.1a4
// 5.0.99.2    5.1b2
// 5.0.999.1   5.1rc1
// 5.1         5.1
//
// Pre-release version numbers of minor revisions only allow for 1 alpha, beta,
// etc. in this numbering scheme; e.g.:
// 5.1.0.98    5.1.1a1
// 5.1.0.99    5.1.1b1
// 5.1.0.999   5.1.1rc1
// 5.1.1       5.1.1
//
// For pre-alpha version of a minor revision:
// 5.1.0.97    5.1.1a0
//
// If the last digit is omitted, the value "1" is used; e.g.:
// 4.99        5.0b1
// 5.0.999     5.1rc1
//
// For development builds (e.g. 5.0b1+), set `aeConst.DEV_BUILD` to `true`.
// Mozilla version numbers such as 5.0+ or 5.0.1+ are not supported.
//
let aeMozVersion = {
  RELEASETYPE_STABLE: 0,
  RELEASETYPE_PRE_MAJOR: 1,
  RELEASETYPE_PRE_MINOR: 2,
  RELEASETYPE_PRE_REVISION: 3,
  
  getMozVersion(aVersion)
  {
    let rv = "";
    
    if (typeof aVersion != "string") {
      throw new TypeError("aVersion not a String");
    }

    if (aVersion.indexOf(".") == -1) {
      throw new TypeError("aVersion not a valid version string");
    }

    let parsedVer = this._parse(aVersion);
    if (parsedVer.releaseType == this.RELEASETYPE_STABLE) {
      rv = aVersion;
    }
    else {
      let devBuildSfx = "";
      if (aeConst?.DEV_BUILD) {
        devBuildSfx = "+";
      }

      let mozMajor, mozMinor;
      let mozVerSfx = "";
      if (parsedVer.releaseType == this.RELEASETYPE_PRE_MAJOR) {
	mozMajor = Number(parsedVer.major) + 1;
	mozMinor = 0;
	mozVerSfx = this._getMozVersionSuffix(parsedVer.minor, parsedVer.revision);
	rv = `${mozMajor}.${mozMinor}${mozVerSfx}${devBuildSfx}`;
      }
      else if (parsedVer.releaseType == this.RELEASETYPE_PRE_MINOR) {
	mozMajor = parsedVer.major;
	mozMinor = Number(parsedVer.minor) + 1;
	mozVerSfx = this._getMozVersionSuffix(parsedVer.revision, parsedVer.patch);
	rv = `${mozMajor}.${mozMinor}${mozVerSfx}${devBuildSfx}`;
      }
      else if (parsedVer.releaseType == this.RELEASETYPE_PRE_REVISION) {
	mozMajor = parsedVer.major;
	mozMinor = parsedVer.minor;
	let mozRev = Number(parsedVer.revision) + 1;
	mozVerSfx = this._getMozVersionSuffix(parsedVer.patch, 1);
	rv = `${mozMajor}.${mozMinor}.${mozRev}${mozVerSfx}${devBuildSfx}`;
      }
    }

    return rv;
  },

  
  getExtendedVersion(aVersion)
  {
    let rv = "";

    if (typeof aVersion != "string") {
      throw new TypeError("aVersion not a String");
    }

    if (aVersion.indexOf(".") == -1) {
      throw new TypeError("aVersion not a valid version string");
    }

    let parsedVer = this._parse(aVersion);
    if (parsedVer.releaseType == this.RELEASETYPE_STABLE) {
      rv = aVersion;
    }
    else {
      let mozVer = this.getMozVersion(aVersion);
      rv = `${mozVer} (${aVersion})`;
    }
    
    return rv;
  },

  
  // Helpers
  _parse(aVersion)
  {
    let rv;
    let major, minor, revision, patch;
    revision = patch = "";
    [major, minor, revision, patch] = aVersion.split(".");
    rv = {major, minor, revision, patch};

    if ([98, 99, 998, 999].includes(Number(minor))) {
      rv.releaseType = this.RELEASETYPE_PRE_MAJOR;
    }
    else if ([98, 99, 998, 999].includes(Number(revision))) {
      rv.releaseType = this.RELEASETYPE_PRE_MINOR;
    }
    else if ([97, 98, 99, 998, 999].includes(Number(patch))) {
      rv.releaseType = this.RELEASETYPE_PRE_REVISION;
    }
    else {
      rv.releaseType = this.RELEASETYPE_STABLE;
    }

    return rv;
  },

  
  _getMozVersionSuffix(aSubversion, aPreReleaseVer=1)
  {
    let rv = "";

    if (aSubversion == 97) {  // pre-alpha
      rv = "a0";
    }
    else if (aSubversion == 98) {  // alpha
      rv = `a${aPreReleaseVer}`;
    }
    else if (aSubversion == 99) {  // beta
      rv = `b${aPreReleaseVer}`;
    }
    else if (aSubversion == 998) {  // technical preview
      rv = `pre${aPreReleaseVer}`;
    }
    else if (aSubversion == 999) {  // release candidate
      rv = `rc${aPreReleaseVer}`;
    }

    return rv;
  },
};
