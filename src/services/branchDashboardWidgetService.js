import { request, impersonateBranchId } from "./apiClient";
import { shareInFlightRequest } from "../lib/inFlightRequests";

export function getBranchDashboardWidgets() {
  const branchScope = String(impersonateBranchId || "");
  return shareInFlightRequest("branch-dashboard-widgets:" + branchScope, async () => {
    const response = await request("/dashboard/branch/widgets", {
      ...(branchScope ? { impersonateBranchId: branchScope } : {}),
    });
    return response?.data ?? response ?? [];
  });
}

export async function saveBranchDashboardWidgets(widgets) {
  const response = await request("/dashboard/branch/widgets", { method: "PUT", body: JSON.stringify({ widgets }) });
  return response?.data ?? response ?? [];
}

export async function resetBranchDashboardWidgets() {
  const response = await request("/dashboard/branch/widgets/reset", { method: "POST" });
  return response?.data ?? response ?? [];
}