/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */

class aeDateDiff
{
  constructor(aDate1, aDate2)
  {
    this.days = null;
    this.hours = null;
    this.minutes = null;
    this.seconds = null;
    this.date1 = aDate1;
    this.date2 = aDate2;

    this._init();
  }

  _init()
  {
    let data = new aeDateMeasure(this.date1 - this.date2);
    this.days = data.days;
    this.hours = data.hours;
    this.minutes = data.minutes;
    this.seconds = data.seconds;   
  }
}


class aeDateMeasure
{
  constructor(aTimeMS)
  {
    let d, h, m, s;
    s = Math.floor(aTimeMS / 1000);
    m = Math.floor(s / 60);
    s = s % 60;
    h = Math.floor(m / 60);
    m = m % 60;
    d = Math.floor(h / 24);
    h = h % 24;
    
    this.days = d;
    this.hours = h;
    this.minutes = m;
    this.seconds = s;   
  }
}
