import { OrgTree } from "@/components/organization/org-tree";
import { MyTeam } from "@/components/organization/my-team";

export default function OrganizationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
        <p className="text-sm text-muted-foreground">
          Explore reporting lines and your direct reports.
        </p>
      </div>

      <MyTeam />
      <OrgTree />
    </div>
  );
}
