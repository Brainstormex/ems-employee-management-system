"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  Network,
  Shield,
  Users,
  UserCog,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { PERMISSIONS } from "@/types";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/organization", label: "Organization", icon: Network },
  { href: "/profile", label: "My Profile", icon: UserRound },
];

export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  const links = [
    ...baseLinks,
    ...(hasPermission(PERMISSIONS.USERS_MANAGE)
      ? [{ href: "/admin/users", label: "Admin Users", icon: UserCog }]
      : []),
    ...(hasPermission(PERMISSIONS.ROLES_MANAGE)
      ? [{ href: "/admin/roles", label: "Admin Roles", icon: Shield }]
      : []),
  ];

  return (
    <nav className="flex flex-col gap-1 p-3">
      <div className="mb-4 flex items-center gap-2 px-2 py-1">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">EMS</p>
          <p className="text-xs text-muted-foreground">People Ops</p>
        </div>
      </div>

      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
