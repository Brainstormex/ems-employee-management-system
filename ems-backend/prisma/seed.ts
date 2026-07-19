import bcrypt from "bcryptjs";
import { PrismaClient, Status } from "@prisma/client";
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
} from "../src/lib/permissions";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function hash(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function seedRolesAndPermissions() {
  for (const perm of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {
        name: perm.name,
        description: perm.description,
        groupName: perm.group,
      },
      create: {
        key: perm.key,
        name: perm.name,
        description: perm.description,
        groupName: perm.group,
      },
    });
  }

  const allPerms = await prisma.permission.findMany();
  const permByKey = new Map(allPerms.map((p) => [p.key, p.id]));

  const systemRoles: {
    slug: string;
    name: string;
    description: string;
  }[] = [
    {
      slug: SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
      name: "Super Admin",
      description: "Full system access",
    },
    {
      slug: SYSTEM_ROLE_SLUGS.HR_MANAGER,
      name: "HR Manager",
      description: "Manage employees without destructive admin controls",
    },
    {
      slug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      name: "Employee",
      description: "Self-service employee access",
    },
  ];

  const rolesBySlug = new Map<string, string>();

  for (const roleDef of systemRoles) {
    const role = await prisma.accessRole.upsert({
      where: { slug: roleDef.slug },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
      },
      create: {
        slug: roleDef.slug,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
      },
    });
    rolesBySlug.set(role.slug, role.id);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const keys =
      SYSTEM_ROLE_PERMISSIONS[roleDef.slug as keyof typeof SYSTEM_ROLE_PERMISSIONS];
    await prisma.rolePermission.createMany({
      data: keys.map((key) => ({
        roleId: role.id,
        permissionId: permByKey.get(key)!,
      })),
    });
  }

  return rolesBySlug;
}

async function main() {
  console.log("Seeding database...");

  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  // Keep permissions/roles; re-sync them
  await prisma.rolePermission.deleteMany();
  await prisma.accessRole.deleteMany({ where: { isSystem: false } });
  // System roles kept and updated below; recreate if missing
  const rolesBySlug = await seedRolesAndPermissions();

  const departments = await Promise.all([
    prisma.department.create({
      data: {
        name: "Engineering",
        description: "Software development and infrastructure",
      },
    }),
    prisma.department.create({
      data: {
        name: "Human Resources",
        description: "People operations and talent",
      },
    }),
    prisma.department.create({
      data: {
        name: "Sales",
        description: "Revenue and customer acquisition",
      },
    }),
    prisma.department.create({
      data: {
        name: "Finance",
        description: "Accounting, payroll, and budgeting",
      },
    }),
  ]);

  const [engineering, hr, sales, finance] = departments;

  type EmpSeed = {
    code: string;
    fullName: string;
    email: string;
    phone: string;
    departmentId: string;
    designation: string;
    salary: number;
    joiningDate: string;
    status?: Status;
    roleSlug: string;
    password: string;
    managerCode?: string;
  };

  const seeds: EmpSeed[] = [
    {
      code: "EMP-0001",
      fullName: "Ava Chen",
      email: "admin@ems.local",
      phone: "+14155550001",
      departmentId: engineering.id,
      designation: "Chief Executive Officer",
      salary: 250000,
      joiningDate: "2018-01-15",
      roleSlug: SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
      password: "Admin@12345",
    },
    {
      code: "EMP-0002",
      fullName: "Priya Sharma",
      email: "hr1@ems.local",
      phone: "+14155550002",
      departmentId: hr.id,
      designation: "HR Director",
      salary: 140000,
      joiningDate: "2019-03-01",
      roleSlug: SYSTEM_ROLE_SLUGS.HR_MANAGER,
      password: "Hr@12345678",
      managerCode: "EMP-0001",
    },
    {
      code: "EMP-0003",
      fullName: "Marcus Webb",
      email: "hr2@ems.local",
      phone: "+14155550003",
      departmentId: hr.id,
      designation: "HR Manager",
      salary: 95000,
      joiningDate: "2020-06-15",
      roleSlug: SYSTEM_ROLE_SLUGS.HR_MANAGER,
      password: "Hr@12345678",
      managerCode: "EMP-0002",
    },
    {
      code: "EMP-0004",
      fullName: "Jordan Lee",
      email: "jordan.lee@ems.local",
      phone: "+14155550004",
      departmentId: engineering.id,
      designation: "VP of Engineering",
      salary: 180000,
      joiningDate: "2018-06-01",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0001",
    },
    {
      code: "EMP-0005",
      fullName: "Sam Patel",
      email: "sam.patel@ems.local",
      phone: "+14155550005",
      departmentId: engineering.id,
      designation: "Engineering Manager",
      salary: 145000,
      joiningDate: "2019-09-10",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0004",
    },
    {
      code: "EMP-0006",
      fullName: "Riley Kim",
      email: "riley.kim@ems.local",
      phone: "+14155550006",
      departmentId: engineering.id,
      designation: "Engineering Manager",
      salary: 142000,
      joiningDate: "2020-02-20",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0004",
    },
    {
      code: "EMP-0007",
      fullName: "Alex Rivera",
      email: "alex.rivera@ems.local",
      phone: "+14155550007",
      departmentId: engineering.id,
      designation: "Senior Software Engineer",
      salary: 125000,
      joiningDate: "2021-01-11",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0005",
    },
    {
      code: "EMP-0008",
      fullName: "Morgan Ellis",
      email: "morgan.ellis@ems.local",
      phone: "+14155550008",
      departmentId: engineering.id,
      designation: "Software Engineer",
      salary: 98000,
      joiningDate: "2022-04-04",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0005",
    },
    {
      code: "EMP-0009",
      fullName: "Jamie Torres",
      email: "jamie.torres@ems.local",
      phone: "+14155550009",
      departmentId: engineering.id,
      designation: "Software Engineer",
      salary: 95000,
      joiningDate: "2023-02-14",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0006",
    },
    {
      code: "EMP-0010",
      fullName: "Taylor Brooks",
      email: "taylor.brooks@ems.local",
      phone: "+14155550010",
      departmentId: sales.id,
      designation: "VP of Sales",
      salary: 165000,
      joiningDate: "2019-01-07",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0001",
    },
    {
      code: "EMP-0011",
      fullName: "Chris Donovan",
      email: "chris.donovan@ems.local",
      phone: "+14155550011",
      departmentId: sales.id,
      designation: "Account Executive",
      salary: 88000,
      joiningDate: "2021-08-23",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0010",
    },
    {
      code: "EMP-0012",
      fullName: "Pat Singh",
      email: "pat.singh@ems.local",
      phone: "+14155550012",
      departmentId: sales.id,
      designation: "Sales Development Rep",
      salary: 62000,
      joiningDate: "2023-05-01",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0010",
    },
    {
      code: "EMP-0013",
      fullName: "Casey Nguyen",
      email: "casey.nguyen@ems.local",
      phone: "+14155550013",
      departmentId: finance.id,
      designation: "Chief Financial Officer",
      salary: 190000,
      joiningDate: "2018-11-12",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0001",
    },
    {
      code: "EMP-0014",
      fullName: "Dana Foster",
      email: "dana.foster@ems.local",
      phone: "+14155550014",
      departmentId: finance.id,
      designation: "Senior Accountant",
      salary: 85000,
      joiningDate: "2020-10-05",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0013",
    },
    {
      code: "EMP-0015",
      fullName: "Quinn Harper",
      email: "quinn.harper@ems.local",
      phone: "+14155550015",
      departmentId: finance.id,
      designation: "Financial Analyst",
      salary: 72000,
      joiningDate: "2022-09-19",
      status: Status.INACTIVE,
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0013",
    },
    {
      code: "EMP-0016",
      fullName: "Blake Okonkwo",
      email: "blake.okonkwo@ems.local",
      phone: "+14155550016",
      departmentId: engineering.id,
      designation: "DevOps Engineer",
      salary: 115000,
      joiningDate: "2021-11-30",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0006",
    },
    {
      code: "EMP-0017",
      fullName: "Reese Alvarez",
      email: "reese.alvarez@ems.local",
      phone: "+14155550017",
      departmentId: hr.id,
      designation: "People Operations Specialist",
      salary: 68000,
      joiningDate: "2022-07-18",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0003",
    },
    {
      code: "EMP-0018",
      fullName: "Skyler Grant",
      email: "skyler.grant@ems.local",
      phone: "+14155550018",
      departmentId: sales.id,
      designation: "Customer Success Manager",
      salary: 78000,
      joiningDate: "2023-11-06",
      roleSlug: SYSTEM_ROLE_SLUGS.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0010",
    },
  ];

  const createdByCode = new Map<string, string>();

  for (const seed of seeds) {
    const roleId = rolesBySlug.get(seed.roleSlug);
    if (!roleId) throw new Error(`Missing role ${seed.roleSlug}`);

    const employee = await prisma.employee.create({
      data: {
        employeeCode: seed.code,
        fullName: seed.fullName,
        email: seed.email,
        phone: seed.phone,
        departmentId: seed.departmentId,
        designation: seed.designation,
        salary: seed.salary,
        joiningDate: new Date(seed.joiningDate),
        status: seed.status ?? Status.ACTIVE,
      },
    });

    createdByCode.set(seed.code, employee.id);

    await prisma.user.create({
      data: {
        email: seed.email,
        passwordHash: await hash(seed.password),
        roleId,
        employeeId: employee.id,
        isActive: true,
      },
    });
  }

  for (const seed of seeds) {
    if (!seed.managerCode) continue;
    const employeeId = createdByCode.get(seed.code);
    const managerId = createdByCode.get(seed.managerCode);
    if (!employeeId || !managerId) {
      throw new Error(`Missing manager link for ${seed.code}`);
    }
    await prisma.employee.update({
      where: { id: employeeId },
      data: { reportingManagerId: managerId },
    });
  }

  console.log(`Seeded ${departments.length} departments, ${seeds.length} employees + users.`);
  console.log("Login credentials:");
  console.log("  Super Admin : admin@ems.local / Admin@12345");
  console.log("  HR Manager  : hr1@ems.local / Hr@12345678");
  console.log("  HR Manager  : hr2@ems.local / Hr@12345678");
  console.log("  Employee    : alex.rivera@ems.local / Employee@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
