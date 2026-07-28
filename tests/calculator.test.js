const assert = require("node:assert/strict");
require("../calculator.js");

const birth = LifeClock.parseLocalDate("2000-02-29");
assert.equal(birth.getFullYear(), 2000);
assert.equal(birth.getMonth(), 1);
assert.equal(birth.getDate(), 29);
assert.equal(LifeClock.parseLocalDate("2023-02-29"), null);
assert.equal(LifeClock.formatClock(0), "00:00");
assert.equal(LifeClock.formatClock(12.5), "12:30");
assert.equal(LifeClock.formatClock(24), "23:59");

const midpoint = LifeClock.calculate(new Date(2000, 0, 1), 80, new Date(2040, 0, 1));
assert.ok(midpoint.hourDecimal > 11.99 && midpoint.hourDecimal < 12.02);
assert.equal(midpoint.overflow, false);

const overflow = LifeClock.calculate(new Date(1900, 0, 1), 80, new Date(2000, 0, 1));
assert.equal(overflow.overflow, true);
assert.equal(overflow.boundedRatio, 1);

console.log("calculator tests passed");
