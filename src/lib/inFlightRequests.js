import { STORAGE_KEY } from "../data/authData.js";

const inFlightRequests = new Map();

function getSessionScope() {
  if (typeof window === "undefined" || !window.sessionStorage) return "server";
  try {
    const session = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null");
    return String(
      session?.user?.id
      || session?.userId
      || session?.user?.email
      || session?.email
      || session?.token
      || "anonymous",
    );
  } catch {
    return "anonymous";
  }
}

export function shareInFlightRequest(key, loader) {
  const requestKey = getSessionScope() + ":" + String(key || "");
  const current = inFlightRequests.get(requestKey);
  if (current) return current;

  const requestPromise = Promise.resolve()
    .then(loader)
    .finally(() => {
      if (inFlightRequests.get(requestKey) === requestPromise) {
        inFlightRequests.delete(requestKey);
      }
    });

  inFlightRequests.set(requestKey, requestPromise);
  return requestPromise;
}