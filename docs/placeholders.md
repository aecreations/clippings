---
layout: page
title: Placeholders in Clippings
---

Placeholders are special text in a clipping that will be substituted with computed values (such as today’s date) or with text that you will be prompted to fill in when the clipping is pasted.

### Predefined Placeholders

There are six predefined placeholders you can use in your clippings. These predefined placeholders will be automatically substituted with their expected values, as described below, when you paste the clipping.

*    $[NAME] - the name of the clipping
*    $[FOLDER] - the name of the folder the clipping belongs to
*    $[DATE] - the current date, expressed in the format defined in your system's locale settings
*    $[TIME] - the current time, expressed in the format defined in your system's locale settings
*    $[HOSTAPP] - the name and version number of the host application you're pasting the clipping in
*    $[UA] - the user agent string of the host application 

### Custom Placeholders

You can define custom placeholders inside a clipping that you will be prompted to fill in when you paste the clipping.

Placeholders are essentially variables that appear in the clipping text in the format *$[placeholder_name]*. Valid placeholder names can contain letters (lowercase or uppercase), digits (0-9) and underscores. Example clipping with placeholders:

```
Hello, $[YourName], I'm glad you're coming to the meeting at $[meeting_time].
See you $[whenever]!
```

When you paste a clipping with placeholders, you will be prompted to fill in the value for each placeholder in the clipping. If you want the placeholders in the clipping pasted exactly as they are, with no prompting and substitution, the clipping name should be prefixed with `[NOSUBST]`.

### Default Values

You can optionally specifiy a default value for your placeholder. A placeholder can have a single or multiple default values.

*    Placeholder with a single default value. Example: `$[placeholderName{defaultValue}]`. When pasting a clipping with such a placeholder, the dialog prompt will supply a default value which you can accept or change.
*    Placeholder with multiple selectable values. Example: `$[placeholderName{value1|value2|value3|...}]`. When pasting a clipping with such a placeholder, the dialog prompt will display a drop-down menu where you can select from the available values.

Commonly-used special characters are allowed in default values of placeholders, such as the question mark, parentheses, quotation marks, asterisk, common currency symbols, etc. Note that the pipe symbol (\|), curly braces ({}) and square brackets([]) cannot be used.

### Numeric Placeholders

Numeric placeholders (also known as _auto-incrementing placeholders_) are special placeholders that pastes a numeric value that is increased by 1 every time the clipping it belongs to is pasted. Numeric placeholder names are in the format *#[placeholder_name]*. Valid placeholder names can contain letters (lowercase or uppercase), digits (0-9) and underscores.

**Specifying a starting initial value:** The default starting value is **0 (zero)**. To change it, go to the extension preferences page to set the starting value for all numeric placeholders.

**Resetting an numeric placeholder:** This will cause the numeric placeholder counter to start over at its initial value. To reset an numeric placeholder:

*    _Clippings for Firefox_ - Right-click on the Clippings toolbar button and select **Reset Auto-incrementing Placeholders**, then click on the name of the numeric placeholder.
*    _Clippings for Thunderbird_ - The **Reset Auto-incrementing Placeholders** menu is located in the Clippings context menu.

### The Placeholder Toolbar in Clippings Manager

Use the Placeholder Toolbar in Clippings Manager to guide you through adding placeholders to your clippings. To show the Placeholder Toolbar, click on the Tools menu in Clippings Manager, then select Show/Hide → Placeholder Toolbar.

![Screen shot of Clippings Manager](https://aecreations.sourceforge.io/clippings/img/plchldrTbar.png)
*The Placeholder Toolbar in Clippings Manager, with the Presets menu open.*

