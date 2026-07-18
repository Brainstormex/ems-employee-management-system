import { Status } from "@/types";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant={status === Status.ACTIVE ? "default" : "secondary"}>
      {status === Status.ACTIVE ? "Active" : "Inactive"}
    </Badge>
  );
}
