"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardStatsResponse } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_COLORS = {
  ACTIVE: "var(--chart-1)",
  INACTIVE: "var(--chart-3)",
};

type Props = {
  stats: DashboardStatsResponse;
};

export function DashboardCharts({ stats }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const axisColor = isDark ? "#a1a1aa" : "#71717a";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  const deptData = useMemo(
    () =>
      stats.charts.employeesPerDepartment.map((d) => ({
        name: d.departmentName,
        count: d.count,
      })),
    [stats.charts.employeesPerDepartment]
  );

  const statusData = useMemo(
    () =>
      stats.charts.employeesByStatus.map((s) => ({
        name: s.status === "ACTIVE" ? "Active" : "Inactive",
        value: s.count,
        key: s.status,
      })),
    [stats.charts.employeesByStatus]
  );

  const hiresData = useMemo(
    () =>
      stats.charts.hiresPerMonth.map((h) => ({
        month: formatMonthLabel(h.month),
        hires: h.count,
      })),
    [stats.charts.hiresPerMonth]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Employees by department</CardTitle>
          <CardDescription>Active headcount per department</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: axisColor, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: axisColor, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#18181b" : "#fff",
                  border: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`,
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="count" name="Employees" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active vs inactive</CardTitle>
          <CardDescription>Workforce status split</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {statusData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={
                      entry.key === "ACTIVE"
                        ? STATUS_COLORS.ACTIVE
                        : STATUS_COLORS.INACTIVE
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: isDark ? "#18181b" : "#fff",
                  border: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`,
                  borderRadius: 8,
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hires per month</CardTitle>
          <CardDescription>Last 12 months</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hiresData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: axisColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: axisColor, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#18181b" : "#fff",
                  border: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`,
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="hires"
                name="Hires"
                stroke="var(--chart-4)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}
