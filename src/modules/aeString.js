/* -*- mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * stringUtils.js - AE Creations string utilities
 * Copyright (C) 2005 - 2010, Alex Eng <ateng@users.sourceforge.net>
 * 
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 * 
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 * 
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */

const EXPORTED_SYMBOLS = ["aeString"];


var aeString = {

  // Exceptions thrown by method format()
  E_NUMARGS: "Less args than there are format specifiers",

  format: function (fmt/*, args...*/) 
  {
    if (! fmt) {
      return fmt;
    }

    var args = [];
    for (var k = 0; k < arguments.length; k++) {
      if (arguments[k] === null) {
	args[k] = "null";
      }
      else if (arguments[k] === undefined) {
	args[k] = "undefined";
      }
      else {
	args[k] = arguments[k];
      }
    }

    const DEFAULT_PRECISION = 0;
    var re = /%(\d*)([%bcCdefioOsSxX])/g;
    var acc = "";
    var str = args.shift();
    var i = 0;
    var match;

    while ((match = re.exec(str)) != null) {
      var substr = str.substring(i, match.index);
      var precision = match[1] ? match[1] : DEFAULT_PRECISION;
      var fmtspec = "%" + match[2];

      var arg = args.shift();

      if (arg === undefined) {
	if (fmtspec.search(/%[bcCdefioOsSxX]/) != -1) {
	  throw aeString.E_NUMARGS;
	}
      }

      // Special handling of null and undefined arguments
      if (arg == "null" || arg == "undefined") {
	if (fmtspec == "%%") {
	  args.unshift(arg);
	  acc += substr + "%";
	}
	else if (fmtspec.search(/%[bcCdefioOsSxX]/) != -1) {
	  acc += substr + arg;
	}
	else {
	  args.unshift(arg);
	  acc += substr + fmtspec;
	}
      }
      // Handle all other arguments
      else {
	if (fmtspec == "%%") {
	  args.unshift(arg);
	  acc += substr + "%";
	}
	else if (fmtspec == "%c" || fmtspec == "%C") {
	  acc += substr + (fmtspec == "%C" ? ("'" + String.fromCharCode(arg) + "'") : String.fromCharCode(arg));
	}
	else if (fmtspec == "%s" || fmtspec == "%S") {
	  acc += substr + (fmtspec == "%S" ? ("\"" + String(arg) + "\"") : String(arg));
	}
	else if (fmtspec == "%d" || fmtspec == "%i" 
		 || fmtspec == "%o" || fmtspec == "%x" 
		 || fmtspec == "%O" || fmtspec == "%X") {
	  var radix, prefix = "";
	  if (fmtspec == "%d" || fmtspec == "%i") {
	    radix = 10;
	  }
	  else if (fmtspec == "%o" || fmtspec == "%O") {
	    radix = 8;
	    if (fmtspec == "%O" && arg != 0) prefix = "0";
	  }
	  else if (fmtspec == "%x" || fmtspec == "%X") {
	    radix = 16;
	    if (fmtspec == "%X" && arg != 0) prefix = "0x";
	  }
	  else if (fmtspec == "%b") {
	    radix = 2;
	  }
	  acc += substr + prefix + arg.toString(radix);
	}
	else if (fmtspec == "%e" || fmtspec == "%f") {
	  if (fmtspec == "%e") arg = arg.toExponential(precision);
	  if (fmtspec == "%f") arg = arg.toFixed(precision);
	  acc += substr + arg;
	}
	else if (fmtspec == "%b") {
	  acc += substr + Boolean(arg);
	}
	else {
	  args.unshift(arg);
	  acc += substr + fmtspec;
	}
      }

      i = re.lastIndex;
    }

    // Get the rest of the string (or get the whole string if there were args
    // but no format spec's)
    if (i < str.length) {
      acc += str.substring(i, str.length);
    }

    return acc;
  },

  trim: function (str) 
  {
    const SPACE_CODE = 32;

    if (! str) {
      return str;
    }

    var len = str.length;

    if (str.charCodeAt(0) > SPACE_CODE 
	&& str.charCodeAt(len - 1) > SPACE_CODE) {
      return str;
    }

    var k = -1;
    while (k < len && str.charCodeAt(++k) <= SPACE_CODE);
    if (k == len) {
      return "";
    }

    var m = len;
    while (m > 0 && str.charCodeAt(--m) <= SPACE_CODE);
    return str.substring(k, m + 1);
  }
};
