export const collectionWorkflowRunsUrl =
  "https://api.github.com/repos/orik007/sliby-chyby/actions/workflows/collect-evidence.yml/runs?status=success&per_page=1";

export function getLatestSuccessfulCollectionTime(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("workflow_runs" in payload)) return null;
  const workflowRuns = (payload as { workflow_runs?: unknown }).workflow_runs;
  if (!Array.isArray(workflowRuns) || workflowRuns.length === 0) return null;
  const updatedAt = (workflowRuns[0] as { updated_at?: unknown } | undefined)?.updated_at;
  if (typeof updatedAt !== "string" || Number.isNaN(Date.parse(updatedAt))) return null;
  return updatedAt;
}
