const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
assert.equal(createHash("sha256").update(fs.readFileSync(
  path.join(__dirname, "../vendor/sprintf-js/test/test.js"))).digest("hex"),
  "6494260db1acd5d551b201559c3b2f50b06dedd01d05532fe82ef41614939400");
const oldDescribe = global.describe;
const oldIt = global.it;
try {
  global.describe = describe;
  global.it = it;
  require("../vendor/sprintf-js/test/test.js");
} finally {
  if (oldDescribe === undefined) delete global.describe;
  else global.describe = oldDescribe;
  if (oldIt === undefined) delete global.it;
  else global.it = oldIt;
}
