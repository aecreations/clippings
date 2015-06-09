/* -*- mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Clippings.
 *
 * The Initial Developer of the Original Code is 
 * Alex Eng <ateng@users.sourceforge.net>.
 * Portions created by the Initial Developer are Copyright (C) 2015
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

const EXPORTED_SYMBOLS = ["aeInsertTextIntoTextbox"];


/*
 * Insert the given text into the textbox.
 * 
 * @param aTextboxElt    A DOM object representing a textbox element
 * @param aInsertedText  The text to insert into the text inside the textbox
 */
function aeInsertTextIntoTextbox(aTextboxElt, aInsertedText)
{
  var text, pre, post, pos;
  text = aTextboxElt.value;

  if (aTextboxElt.selectionStart == aTextboxElt.selectionEnd) {
    var point = aTextboxElt.selectionStart;
    pre = text.substring(0, point);
    post = text.substring(point, text.length);
    pos = point + aInsertedText.length;
  }
  else {
    var p1 = aTextboxElt.selectionStart;
    var p2 = aTextboxElt.selectionEnd;
    pre = text.substring(0, p1);
    post = text.substring(p2, text.length);
    pos = p1 + aInsertedText.length;
  }

  aTextboxElt.value = pre + aInsertedText + post;
  aTextboxElt.selectionStart = pos;
  aTextboxElt.selectionEnd = pos;
}
