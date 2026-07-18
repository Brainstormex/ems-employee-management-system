import { apiFetch } from "@/lib/api";
import { DashboardStatsResponse } from "@/types";

export async function getDashboardStats(): Promise<{
  data: DashboardStatsResponse;
}> {
  return apiFetch("/api/dashboard/stats");
}
