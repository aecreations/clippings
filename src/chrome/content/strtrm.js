/*
 * strtrm.js - Implementation of String method trim()
 * Copyright (C) 2005 - 2006, Alex Eng <ateng@users.sourceforge.net>
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

// The trim() method being added to the String object is an implementation of
// the trim() method of the java.lang.String class in Java.
// See documentation in strtrm.html.

if (! String.prototype.trim) {
  String.prototype.trim = function () {

    const SPACE_CODE = 32;

    if (! this) {
      return this;
    }

    var len = this.length;

    if (this.charCodeAt(0) > SPACE_CODE 
	&& this.charCodeAt(len - 1) > SPACE_CODE) {
      return this;
    }

    var k = -1;
    while (k < len && this.charCodeAt(++k) <= SPACE_CODE);
    if (k == len) {
      return "";
    }

    var m = len;
    while (m > 0 && this.charCodeAt(--m) <= SPACE_CODE);
    return this.substring(k, m + 1);
  };
} 
