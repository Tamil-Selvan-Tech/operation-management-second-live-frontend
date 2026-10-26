import { request } from "./apiClient";
import { shareInFlightRequest } from "../lib/inFlightRequests";

const STUDENT_IDS_PER_REQUEST = 100;

export async function getBranchStudentReportCompletionSummaries(studentIds = [], branchId = "") {
  const ids = [...new Set(
    (Array.isArray(studentIds) ? studentIds : [])
      .map((studentId) => String(studentId || "").trim())
      .filter(Boolean),
  )].sort();
  if (!ids.length) return [];

  const normalizedBranchId = String(branchId || "").trim();
  const summaries = [];
  for (let offset = 0; offset < ids.length; offset += STUDENT_IDS_PER_REQUEST) {
    const batchIds = ids.slice(offset, offset + STUDENT_IDS_PER_REQUEST);
    const summaryRows = await shareInFlightRequest(
      "branch-student-report-summary:" + normalizedBranchId + ":" + batchIds.join(","),
      async () => {
        const response = await request("/branch-students/report-completion-summary", {
          method: "POST",
          body: JSON.stringify({ studentIds: batchIds }),
          ...(normalizedBranchId ? { impersonateBranchId: normalizedBranchId } : {}),
        });
        return Array.isArray(response?.data) ? response.data : [];
      },
    );
    summaries.push(...summaryRows);
  }
  return summaries;
}