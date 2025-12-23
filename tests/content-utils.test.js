const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseToolkitHash,
  flexiblePromptDetection,
  b64EncodeUnicode,
} = require("../scripts/content-utils.js");

test("parseToolkitHash: phind-style encoding decodes to expected prompt", () => {
  const hash = "autoSubmit=false&prompt=I%2BB+%3D+C%26D";
  const result = parseToolkitHash(hash, "?home=true");

  assert.equal(result.prompt, "I+B = C&D");
  assert.equal(result.autoSubmit, false);
  assert.equal(result.pasteImage, false);
  assert.equal(result.tool, "");
});

test("parseToolkitHash: encodeURI reserved-char fix when location.search is empty", () => {
  // This matches the comment test case in scripts/content.js:
  // https://claude.ai/#autoSubmit=true&prompt=I+B%20=%20C&D
  const hash = "autoSubmit=true&prompt=I+B%20=%20C&D";
  const result = parseToolkitHash(hash, "");

  assert.equal(result.prompt, "I+B = C&D");
  assert.equal(result.autoSubmit, true);
});

test("flexiblePromptDetection: normalizes CR and collapses excessive newlines", () => {
  const hash = "autoSubmit=1&prompt=%20%20hi%0D%0A%0A%0Athere";
  const prompt = flexiblePromptDetection(hash, "?q=1");
  assert.equal(prompt, "hi\n\nthere");
});

test("parseToolkitHash: decodes Base64Unicode prompt after URI decoding", () => {
  // `isBase64Unicode` in the extension only considers strings with length >= 32.
  const original = "Hello 世界! ".repeat(10).trim();
  const base64 = b64EncodeUnicode(original);
  const hash = `autoSubmit=1&prompt=${encodeURIComponent(base64)}`;

  const result = parseToolkitHash(hash, "?x=1");
  assert.equal(result.prompt, original);
  assert.equal(result.autoSubmit, true);
});

