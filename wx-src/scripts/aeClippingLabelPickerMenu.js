/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class aeClippingLabelPickerMenu
{
  constructor(aID)
  {
    this._labelPickerID = aID;
  }


  init(aMenuItemElt)
  {
    $(`<span id="${this._labelPickerID}">${browser.i18n.getMessage("labelLabel")}
      <ul role="group">
        <li class="label-none" title="${browser.i18n.getMessage("none")}" role="menuitemradio" aria-checked="false" data-label="">None</li>
        <li class="label-red" title="${browser.i18n.getMessage("labelRed")}" role="menuitemradio" aria-checked="false" data-label="red">Red</li>
        <li class="label-orange" title="${browser.i18n.getMessage("labelOrange")}" role="menuitemradio" aria-checked="false" data-label="orange">Orange</li>
        <li class="label-yellow" title="${browser.i18n.getMessage("labelYellow")}" role="menuitemradio" aria-checked="false" data-label="yellow">Yellow</li>
        <li class="label-green" title="${browser.i18n.getMessage("labelGreen")}" role="menuitemradio" aria-checked="false" data-label="green">Green</li>
        <li class="label-blue" title="${browser.i18n.getMessage("labelBlue")}" role="menuitemradio" aria-checked="false" data-label="blue">Blue</li>
        <li class="label-purple" title="${browser.i18n.getMessage("labelPurple")}" role="menuitemradio" aria-checked="false" data-label="purple">Purple</li>
        <li class="label-grey" title="${browser.i18n.getMessage("labelGrey")}" role="menuitemradio" aria-checked="false" data-label="grey">Gray</li>
      </ul>
    </span>`).appendTo(aMenuItemElt);
    aMenuItemElt.addClass("ae-clipping-label-picker-mnu");
  }


  onActivated(aLabel)
  {
    this._setLabel(aLabel);
  }


  onHide()
  {
    $(`#${this._labelPickerID} > ul > li`).removeClass("selected");
  }


  onClick(aEvent)
  {
    $(`#${this._labelPickerID} > ul > li[aria-checked="true"]`).attr("aria-checked", "false");
    aEvent.target.ariaChecked = true;
  }


  _setLabel(aLabel)
  {
    let label = aLabel || "none";
    let labelMnuItem = $(`#${this._labelPickerID} > ul > li.label-${label}`);
    labelMnuItem.addClass("selected");
    labelMnuItem[0].ariaChecked = true;
  }


  isDisabled()
  {
    let labelPickerMnuItem = $(`#${this._labelPickerID}`).parent();
    let rv = labelPickerMnuItem.hasClass("context-menu-disabled");

    return rv;
  }
}
