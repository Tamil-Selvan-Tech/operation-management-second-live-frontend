import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProgressComparisonNotification,
  syncProgressComparisonNotifications,
} from "./progressComparisonNotification.js";

test("suppresses only matched 0% and 100% endpoint notifications", () => {
  assert.equal(buildProgressComparisonNotification({ courseProgress: 0, paidProgress: 0 }), null);
  assert.equal(buildProgressComparisonNotification({ courseProgress: 100, paidProgress: 100 }), null);
  assert.equal(buildProgressComparisonNotification({ courseProgress: 0, paidProgress: 100 }), null);

  const middleMatch = buildProgressComparisonNotification({
    studentId: "STU-MIDDLE",
    courseProgress: 50,
    paidProgress: 50,
  });
  const otherMatch = buildProgressComparisonNotification({
    studentId: "STU-OTHER",
    courseProgress: 75,
    paidProgress: 75,
  });
  assert.equal(middleMatch?.statusKey, "matched");
  assert.equal(otherMatch?.statusKey, "matched");
});

test("removes previously stored endpoint matches and keeps other progress alerts", () => {
  const originalWindow = globalThis.window;
  const storageKey = "cispro.super-admin.notifications";
  let stored = [
    { id: "old-100", kind: "branch-progress-status", studentId: "STU-100", courseProgress: "100", paidProgress: "100", statusKey: "matched" },
    { id: "keep-50", kind: "faculty-progress-status", studentId: "STU-50", courseProgress: "50", paidProgress: "50", statusKey: "matched" },
  ];
  globalThis.window = {
    localStorage: {
      getItem(key) { return key === storageKey ? JSON.stringify(stored) : null; },
      setItem(key, value) { if (key === storageKey) stored = JSON.parse(value); },
    },
    dispatchEvent() {},
  };

  try {
    syncProgressComparisonNotifications([
      { studentId: "STU-100", courseProgress: 100, paidProgress: 100 },
      { studentId: "STU-50", courseProgress: 50, paidProgress: 50 },
    ], "branch");

    assert.equal(stored.some((notification) => notification.id === "old-100"), false);
    assert.equal(stored.some((notification) => notification.id === "keep-50"), true);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});