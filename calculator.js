(function (root) {
  "use strict";

  var MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

  function ageInYears(birth, now) {
    return (now.getTime() - birth.getTime()) / MS_PER_YEAR;
  }

  function calculate(birth, expectancy, now) {
    var age = ageInYears(birth, now);
    var ratio = age / expectancy;
    var boundedRatio = Math.max(0, Math.min(1, ratio));
    var hourDecimal = boundedRatio * 24;
    return { age: age, ratio: ratio, boundedRatio: boundedRatio, hourDecimal: hourDecimal, overflow: ratio >= 1 };
  }

  function formatClock(hourDecimal) {
    var totalMinutes = Math.min(1439, Math.max(0, Math.floor(hourDecimal * 60)));
    var hour = Math.floor(totalMinutes / 60);
    var minute = totalMinutes % 60;
    return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
  }

  function parseLocalDate(value) {
    var parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some(function (part) { return !Number.isFinite(part); })) return null;
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) return null;
    return date;
  }

  root.LifeClock = { ageInYears: ageInYears, calculate: calculate, formatClock: formatClock, parseLocalDate: parseLocalDate };
})(typeof window !== "undefined" ? window : globalThis);
