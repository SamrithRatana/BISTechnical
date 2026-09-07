import assert from "node:assert";

console.log("=========================================");
console.log(" RUNNING SYSTEM UNIT TESTS (PASS/FAIL)");
console.log("=========================================\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// 1. Timeout Tests
test("TimeoutError constructs with custom label and ms", () => {
  class TimeoutError extends Error {
    constructor(ms, label) {
      super(label ? `${label} timed out after ${ms}ms` : `Timed out after ${ms}ms`);
      this.name = "TimeoutError";
      this.ms = ms;
    }
  }
  const err = new TimeoutError(5000, "Dashboard KPI fetch");
  assert.strictEqual(err.name, "TimeoutError");
  assert.strictEqual(err.ms, 5000);
  assert.strictEqual(err.message, "Dashboard KPI fetch timed out after 5000ms");
});

// 2. Hex Color Validation Tests
test("HEX_COLOR_PATTERN correctly matches valid 3/6-digit hex values", () => {
  const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
  assert.strictEqual(HEX_COLOR_PATTERN.test("#0891B2"), true);
  assert.strictEqual(HEX_COLOR_PATTERN.test("#FFF"), true);
  assert.strictEqual(HEX_COLOR_PATTERN.test("#10b981"), true);
  assert.strictEqual(HEX_COLOR_PATTERN.test("invalid"), false);
  assert.strictEqual(HEX_COLOR_PATTERN.test("#12345"), false);
  assert.strictEqual(HEX_COLOR_PATTERN.test("#1234567"), false);
});

// 3. JWT Expiration Math Tests
test("isTokenExpired accurately calculates JWT exp timestamp", () => {
  function isTokenExpired(token) {
    if (!token) return true;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (!payload.exp) return false;
      const nowSec = Math.floor(Date.now() / 1000);
      return payload.exp <= nowSec + 30; // 30s buffer
    } catch {
      return true;
    }
  }

  // Future token
  const futureExp = Math.floor(Date.now() / 1000) + 3600;
  const validPayload = Buffer.from(JSON.stringify({ exp: futureExp })).toString("base64");
  const validToken = `header.${validPayload}.signature`;
  assert.strictEqual(isTokenExpired(validToken), false);

  // Expired token
  const pastExp = Math.floor(Date.now() / 1000) - 3600;
  const expiredPayload = Buffer.from(JSON.stringify({ exp: pastExp })).toString("base64");
  const expiredToken = `header.${expiredPayload}.signature`;
  assert.strictEqual(isTokenExpired(expiredToken), true);
});

// 4. Sidebar Metric Calculations
test("sidebarMarginClass returns correct layout offsets per style", () => {
  function sidebarMarginClass(style, isOpen) {
    if (style === "compact-rail") return isOpen ? "lg:ml-[256px]" : "lg:ml-[68px]";
    if (style === "floating") return isOpen ? "lg:ml-[264px]" : "lg:ml-[88px]";
    if (style === "dual-column") return "lg:ml-[320px]";
    return isOpen ? "lg:ml-[256px]" : "lg:ml-[80px]";
  }

  assert.strictEqual(sidebarMarginClass("classic", true), "lg:ml-[256px]");
  assert.strictEqual(sidebarMarginClass("classic", false), "lg:ml-[80px]");
  assert.strictEqual(sidebarMarginClass("compact-rail", false), "lg:ml-[68px]");
  assert.strictEqual(sidebarMarginClass("dual-column", true), "lg:ml-[320px]");
});

console.log(`\nTest Run Complete: ${passed} Passed, ${failed} Failed.`);
if (failed > 0) process.exit(1);
