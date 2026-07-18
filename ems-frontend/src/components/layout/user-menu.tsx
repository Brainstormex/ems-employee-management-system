"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { roleLabel } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function initials(name?: string | null, email?: string) {
  if (name) {
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (email?.[0] || "?").toUpperCase();
}

export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const displayName = user.employee?.fullName || user.fullName || user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-auto gap-2 px-2 py-1.5"
        )}
      >
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">
            {initials(displayName, user.email)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-none">
            {displayName}
          </span>
          <span className="text-xs text-muted-foreground">
            {roleLabel(user.role)}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="space-y-1 font-normal">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <Badge variant="secondary" className="mt-1">
              {roleLabel(user.role)}
            </Badge>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
