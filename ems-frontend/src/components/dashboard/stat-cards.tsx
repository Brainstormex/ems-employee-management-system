import { DashboardStats } from "@/types";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const cards: {
  key: keyof DashboardStats;
  label: string;
}[] = [
  { key: "totalEmployees", label: "Total employees" },
  { key: "activeEmployees", label: "Active" },
  { key: "inactiveEmployees", label: "Inactive" },
  { key: "departmentCount", label: "Departments" },
];

export function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ key, label }) => (
        <Card key={key}>
          <CardHeader className="pb-2">
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {stats[key].toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
