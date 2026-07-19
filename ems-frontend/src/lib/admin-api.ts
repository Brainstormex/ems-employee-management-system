import { apiFetch } from "@/lib/api";
import {
  AccessRole,
  AdminUser,
  PaginatedResponse,
  PermissionCatalogItem,
} from "@/types";

export type AdminUserListParams = {
  search?: string;
  roleId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
};

export async function listAdminUsers(
  params: AdminUserListParams = {}
): Promise<PaginatedResponse<AdminUser>> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.roleId) qs.set("roleId", params.roleId);
  if (params.isActive !== undefined) qs.set("isActive", String(params.isActive));
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));

  const query = qs.toString();
  return apiFetch(`/api/admin/users${query ? `?${query}` : ""}`);
}

export async function updateAdminUser(
  id: string,
  body: { roleId?: string; isActive?: boolean }
): Promise<{ data: AdminUser }> {
  return apiFetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    body,
  });
}

export async function listRoles(): Promise<{ data: AccessRole[] }> {
  return apiFetch("/api/admin/roles");
}

export async function createRole(body: {
  name: string;
  description?: string | null;
  permissionKeys: string[];
}): Promise<{ data: AccessRole }> {
  return apiFetch("/api/admin/roles", {
    method: "POST",
    body,
  });
}

export async function updateRole(
  id: string,
  body: {
    name?: string;
    description?: string | null;
    permissionKeys?: string[];
  }
): Promise<{ data: AccessRole }> {
  return apiFetch(`/api/admin/roles/${id}`, {
    method: "PUT",
    body,
  });
}

export async function deleteRole(id: string): Promise<{ message: string }> {
  return apiFetch(`/api/admin/roles/${id}`, {
    method: "DELETE",
  });
}

export async function listPermissions(): Promise<{
  data: PermissionCatalogItem[];
}> {
  return apiFetch("/api/admin/permissions");
}
