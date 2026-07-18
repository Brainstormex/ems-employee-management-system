import bcrypt from "bcryptjs";
import { PrismaClient, Role, Status } from "@prisma/client";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function hash(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function main() {
  console.log("Seeding database...");

  // Clean existing data (order matters for FKs)
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();

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
    role: Role;
    password: string;
    managerCode?: string;
  };

  // Hierarchy (2–3 levels):
  //   Ava Chen (CEO / Super Admin)
  //   ├── Priya Sharma (HR Director)
  //   │   └── Marcus Webb (HR Manager)
  //   ├── Jordan Lee (VP Engineering)
  //   │   ├── Sam Patel (Eng Manager)
  //   │   │   ├── ...engineers
  //   │   └── Riley Kim (Eng Manager)
  //   │       └── ...engineers
  //   ├── Taylor Brooks (VP Sales)
  //   │   └── ...sales
  //   └── Casey Nguyen (CFO)
  //       └── ...finance

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
      role: Role.SUPER_ADMIN,
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
      role: Role.HR_MANAGER,
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
      role: Role.HR_MANAGER,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
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
      role: Role.EMPLOYEE,
      password: "Employee@123",
      managerCode: "EMP-0010",
    },
  ];

  // Create employees first (without managers), then wire hierarchy
  const createdByCode = new Map<string, string>();

  for (const seed of seeds) {
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
        role: seed.role,
        employeeId: employee.id,
        isActive: true,
      },
    });
  }

  // Assign reporting managers (second pass avoids FK order issues)
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
