import assert from "node:assert/strict";
import test from "node:test";

import { shareInFlightRequest } from "./inFlightRequests.js";

test("shares overlapping requests and refreshes after the request settles", async () => {
  let calls = 0;
  let resolveRequest;
  const pending = new Promise((resolve) => { resolveRequest = resolve; });
  const first = shareInFlightRequest("same-scope", () => {
    calls += 1;
    return pending;
  });
  const second = shareInFlightRequest("same-scope", () => {
    calls += 1;
    return Promise.resolve("unexpected duplicate");
  });

  assert.strictEqual(first, second);
  assert.equal(calls, 0);
  resolveRequest("fresh response");
  assert.deepEqual(await Promise.all([first, second]), ["fresh response", "fresh response"]);

  const next = await shareInFlightRequest("same-scope", () => {
    calls += 1;
    return Promise.resolve("refreshed response");
  });
  assert.equal(next, "refreshed response");
  assert.equal(calls, 2);
});