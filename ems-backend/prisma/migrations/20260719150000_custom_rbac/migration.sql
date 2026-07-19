-- Custom RBAC: AccessRole / Permission / RolePermission; migrate users.role enum → role_id

-- 1) New tables
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "group_name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

CREATE TABLE "access_roles" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "access_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_roles_slug_key" ON "access_roles"("slug");
CREATE UNIQUE INDEX "access_roles_name_key" ON "access_roles"("name");

CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "access_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Seed permission catalog (fixed UUIDs for deterministic backfill)
INSERT INTO "permissions" ("id", "key", "name", "description", "group_name") VALUES
  ('a1000001-0000-4000-8000-000000000001', 'employees:read:self', 'Read own employee profile', 'View the linked employee record', 'Employees'),
  ('a1000001-0000-4000-8000-000000000002', 'employees:read:all', 'Read all employees', 'List and view any employee', 'Employees'),
  ('a1000001-0000-4000-8000-000000000003', 'employees:create', 'Create employees', 'Create employee and linked user accounts', 'Employees'),
  ('a1000001-0000-4000-8000-000000000004', 'employees:update:self', 'Update own profile', 'Edit limited fields on own employee profile', 'Employees'),
  ('a1000001-0000-4000-8000-000000000005', 'employees:update:all', 'Update all employees', 'Edit employee records for others', 'Employees'),
  ('a1000001-0000-4000-8000-000000000006', 'employees:delete', 'Soft-delete employees', 'Soft-delete employees and disable their login', 'Employees'),
  ('a1000001-0000-4000-8000-000000000007', 'employees:restore', 'Restore employees', 'Restore soft-deleted employees', 'Employees'),
  ('a1000001-0000-4000-8000-000000000008', 'employees:import', 'Import employees CSV', 'Bulk-import employees from CSV', 'Employees'),
  ('a1000001-0000-4000-8000-000000000009', 'employees:assign_manager', 'Assign reporting managers', 'Change reportingManagerId', 'Employees'),
  ('a1000001-0000-4000-8000-00000000000a', 'dashboard:read', 'View dashboard', 'Access dashboard stats and charts', 'Analytics'),
  ('a1000001-0000-4000-8000-00000000000b', 'organization:read', 'View organization', 'Access organization tree and reportees', 'Analytics'),
  ('a1000001-0000-4000-8000-00000000000c', 'users:manage', 'Manage users', 'Assign roles and enable/disable login accounts', 'Administration'),
  ('a1000001-0000-4000-8000-00000000000d', 'roles:manage', 'Manage roles', 'Create and edit custom roles and their permissions', 'Administration');

-- 3) System roles
INSERT INTO "access_roles" ("id", "slug", "name", "description", "is_system", "updatedAt") VALUES
  ('b1000001-0000-4000-8000-000000000001', 'super-admin', 'Super Admin', 'Full system access', true, CURRENT_TIMESTAMP),
  ('b1000001-0000-4000-8000-000000000002', 'hr-manager', 'HR Manager', 'Manage employees without destructive admin controls', true, CURRENT_TIMESTAMP),
  ('b1000001-0000-4000-8000-000000000003', 'employee', 'Employee', 'Self-service employee access', true, CURRENT_TIMESTAMP);

-- Super Admin: all permissions
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT 'b1000001-0000-4000-8000-000000000001', "id" FROM "permissions";

-- HR Manager
INSERT INTO "role_permissions" ("role_id", "permission_id") VALUES
  ('b1000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000001'),
  ('b1000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000002'),
  ('b1000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000003'),
  ('b1000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000004'),
  ('b1000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000005'),
  ('b1000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000008'),
  ('b1000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000009'),
  ('b1000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-00000000000a'),
  ('b1000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-00000000000b');

-- Employee
INSERT INTO "role_permissions" ("role_id", "permission_id") VALUES
  ('b1000001-0000-4000-8000-000000000003', 'a1000001-0000-4000-8000-000000000001'),
  ('b1000001-0000-4000-8000-000000000003', 'a1000001-0000-4000-8000-000000000004'),
  ('b1000001-0000-4000-8000-000000000003', 'a1000001-0000-4000-8000-00000000000a'),
  ('b1000001-0000-4000-8000-000000000003', 'a1000001-0000-4000-8000-00000000000b');

-- 4) Add nullable role_id, backfill from enum, then enforce NOT NULL
ALTER TABLE "users" ADD COLUMN "role_id" UUID;

UPDATE "users"
SET "role_id" = CASE "role"::text
  WHEN 'SUPER_ADMIN' THEN 'b1000001-0000-4000-8000-000000000001'::uuid
  WHEN 'HR_MANAGER' THEN 'b1000001-0000-4000-8000-000000000002'::uuid
  ELSE 'b1000001-0000-4000-8000-000000000003'::uuid
END;

ALTER TABLE "users" ALTER COLUMN "role_id" SET NOT NULL;

CREATE INDEX "users_role_id_idx" ON "users"("role_id");

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "access_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) Drop old enum column and type
ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "Role";
