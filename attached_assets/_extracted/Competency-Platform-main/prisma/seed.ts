/**
 * Seed script — populates reference data and demo accounts.
 *
 * Run with: npm run db:seed
 *
 * Seeds:
 *  - 15 job grades with their levels (from the prototype).
 *  - The 14 shared competencies (behavioral / leadership / technical).
 *  - A department tree (sector -> division -> department).
 *  - One demo user per role, with a reporting hierarchy.
 *  - A sample career path with stages.
 *  - A default bell-curve policy.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── Grades ───────────────────────────────────────────────
type LevelSeed = {
  level: number;
  label: string;
  minScore: number;
  stayYears: number;
  secondary: number;
  diploma: number;
  bachelor: number;
  master: number;
  phd: number;
  competencies: string;
};
type GradeSeed = { num: string; name: string; levels: LevelSeed[] };

const lv = (
  level: number,
  label: string,
  minScore: number,
  stayYears: number,
  secondary: number,
  diploma: number,
  bachelor: number,
  master: number,
  phd: number,
  competencies: string,
): LevelSeed => ({
  level,
  label,
  minScore,
  stayYears,
  secondary,
  diploma,
  bachelor,
  master,
  phd,
  competencies,
});

const GRADES: GradeSeed[] = [
  { num: "1", name: "عامل", levels: [lv(1, "عامل", 85, 2, 0, 0, 0, 0, 0, "مهارات تشغيلية، التزام تعليمات، تنفيذ تعليمات")] },
  {
    num: "2",
    name: "ممثل مبيعات",
    levels: [
      lv(1, "ممثل مبيعات", 85, 2, 0, 0, 0, 2, 0, "تواصل، إقناع، مهارات بيع أساسية"),
      lv(2, "أخصائي مبيعات", 85, 4, 0, 0, 1, 3, 4, "تواصل، إقناع، مهارات بيع متقدمة"),
      lv(3, "استشاري مبيعات", 85, 9, 0, 2, 6, 7, 8, "تواصل، إقناع، مهارات بيع احترافية"),
    ],
  },
  {
    num: "3",
    name: "منسق",
    levels: [
      lv(1, "منسق", 85, 3, 0, 0, 0, 1, 2, "تنظيم، تنسيق، مهارات إدارية"),
      lv(2, "مدير معرض", 85, 6, 0, 1, 2, 2, 4, "إشراف، تواصل، تدريب، مهارات بيع احترافية"),
      lv(3, "مدير معرض أول", 85, 8, 0, 1, 3, 3, 8, "إشراف، تواصل، تدريب، مهارات بيع احترافية"),
    ],
  },
  { num: "4", name: "أخصائي", levels: [lv(1, "أخصائي", 85, 4, 0, 0, 1, 2, 3, "مهارات فنية متخصصة، إعداد تقارير إدارية")] },
  { num: "5", name: "أخصائي أول", levels: [lv(1, "أخصائي أول", 85, 6, 0, 0, 2, 3, 5, "حل مشكلات، إعداد تقارير فنية")] },
  { num: "6", name: "أخصائي رئيسي", levels: [lv(1, "أخصائي رئيسي", 85, 7, 0, 0, 3, 5, 6, "تحليل بيانات، تطوير إجراءات العمل")] },
  {
    num: "7",
    name: "مشرف",
    levels: [
      lv(1, "مشرف معارض", 85, 7, 0, 2, 2, 3, 5, "إشراف مبدئي، متابعة وتحقيق مستهدفات البيع"),
      lv(2, "مشرف معارض أول", 85, 9, 0, 4, 4, 5, 9, "إشراف مبدئي، متابعة وتحقيق مستهدفات البيع"),
      lv(3, "مشرف معارض رئيسي", 85, 13, 0, 2, 8, 9, 11, "إشراف مبدئي، متابعة وتحقيق مستهدفات البيع"),
    ],
  },
  { num: "8", name: "مشرف قسم", levels: [lv(1, "مشرف قسم", 85, 8, 0, 1, 4, 6, 7, "قيادة فريق، رقابة وتوجيه")] },
  {
    num: "9",
    name: "مشرف قسم أول",
    levels: [
      lv(1, "مشرف قسم أول", 85, 9, 0, 1, 5, 7, 8, "قيادة فريق، رقابة وتوجيه"),
      lv(2, "مدير منطقة", 85, 9, 0, 4, 3, 5, 7, "قيادة مشرفين ومعارض أكبر، تحقيق نتائج مستهدفات"),
      lv(3, "مدير منطقة أول", 85, 13, 0, 4, 7, 9, 11, "قيادة مشرفين ومعارض أكبر، تحقيق نتائج مستهدفات"),
      lv(4, "مدير منطقة رئيسي", 85, 17, 0, 2, 11, 13, 15, "قيادة مشرفين ومعارض أكبر، تحقيق نتائج مستهدفات"),
    ],
  },
  {
    num: "10",
    name: "رئيس قسم",
    levels: [
      lv(1, "رئيس قسم", 90, 10, 0, 2, 6, 8, 8, "تخطيط تشغيلي، قيادة أفراد القسم، تحقيق مستهدفات القسم"),
      lv(2, "مدير إقليم", 90, 9, 0, 4, 3, 5, 7, "إدارة إقليم ومعارض أكبر، اتخاذ قرارات استراتيجية"),
      lv(3, "مدير إقليم أول", 90, 13, 0, 4, 7, 9, 11, "إدارة إقليم ومعارض أكبر، اتخاذ قرارات استراتيجية"),
      lv(4, "مدير إقليم رئيسي", 90, 17, 0, 2, 11, 13, 15, "إدارة إقليم ومعارض أكبر، اتخاذ قرارات استراتيجية"),
    ],
  },
  { num: "11", name: "رئيس قسم أول", levels: [lv(1, "رئيس قسم أول", 90, 11, 0, 2, 8, 10, 10, "تخطيط تشغيلي، قيادة أفراد القسم، إدارة مستهدفات القسم")] },
  { num: "12", name: "مدير إدارة", levels: [lv(1, "مدير إدارة", 90, 14, 0, 3, 10, 12, 12, "إدارة استراتيجية، اتخاذ قرارات إدارية، تحقيق مستهدفات")] },
  { num: "13", name: "مدير إدارة أول", levels: [lv(1, "مدير إدارة أول", 90, 17, 0, 3, 13, 15, 15, "إدارة استراتيجية، تفكير تحليلي، تحقيق نتائج مستهدفات")] },
  { num: "14", name: "نائب رئيس تنفيذي", levels: [lv(1, "نائب رئيس تنفيذي", 95, 19, 0, 3, 15, 17, 17, "تخطيط استراتيجي، تحكم كلي، إدارة مخاطر، تحقيق نتائج مستهدفات")] },
  { num: "15", name: "رئيس تنفيذي", levels: [lv(1, "رئيس تنفيذي", 95, 22, 0, 3, 18, 20, 21, "رؤية اقتصادية، استدامة ونمو الشركة، تحقيق أرباح")] },
];

// ── Shared competencies (behavioral / leadership / technical) ──
const SHARED_COMPETENCIES: {
  sharedKey: string;
  name: string;
  type: "BEHAVIORAL" | "LEADERSHIP" | "TECHNICAL";
  indicators: string;
}[] = [
  { sharedKey: "b1", name: "الالتزام المؤسسي والنزاهة", type: "BEHAVIORAL", indicators: "الحضور | الامتثال | الدقة" },
  { sharedKey: "b2", name: "التواصل والتأثير المهني", type: "BEHAVIORAL", indicators: "وضوح التقارير | جودة العروض" },
  { sharedKey: "b3", name: "العمل بروح الفريق", type: "BEHAVIORAL", indicators: "المشاركة | دعم الزملاء" },
  { sharedKey: "b4", name: "المبادرة والابتكار", type: "BEHAVIORAL", indicators: "المقترحات التحسينية | الاستباقية" },
  { sharedKey: "b5", name: "التطوير الذاتي", type: "BEHAVIORAL", indicators: "ساعات التدريب | تطبيق المكتسبات" },
  { sharedKey: "l1", name: "التخطيط وتحديد الأولويات", type: "LEADERSHIP", indicators: "خطة عمل موثقة | نسبة تحقيق الأهداف" },
  { sharedKey: "l2", name: "تنمية وتمكين الفريق", type: "LEADERSHIP", indicators: "جلسات الإرشاد | تحسّن أداء المرؤوسين" },
  { sharedKey: "l3", name: "صنع القرار وحل المشكلات", type: "LEADERSHIP", indicators: "سرعة البت | الاعتماد على البيانات" },
  { sharedKey: "l4", name: "إدارة الأداء والمتابعة", type: "LEADERSHIP", indicators: "انتظام الاجتماعات | جودة التغذية الراجعة" },
  { sharedKey: "l5", name: "قيادة التغيير والمرونة", type: "LEADERSHIP", indicators: "قيادة مبادرات التحول | الاستجابة" },
  { sharedKey: "t1", name: "الكفاءة التقنية والمعرفة الوظيفية", type: "TECHNICAL", indicators: "إتقان الأنظمة | مواكبة المستجدات" },
  { sharedKey: "t2", name: "جودة المخرجات ودقة العمل", type: "TECHNICAL", indicators: "نسبة الأخطاء | إعادة العمل" },
  { sharedKey: "t3", name: "إدارة الوقت وإنجاز المهام", type: "TECHNICAL", indicators: "نسبة الإنجاز في الموعد | الجودة تحت الضغط" },
  { sharedKey: "t4", name: "التفكير التحليلي", type: "TECHNICAL", indicators: "استخدام البيانات | دقة التحليلات" },
];

async function main() {
  console.log("🌱 Seeding database…");

  // Grades + levels
  for (const g of GRADES) {
    await prisma.grade.upsert({
      where: { num: g.num },
      update: {},
      create: {
        num: g.num,
        name: g.name,
        classification: g.name,
        leaveDays: 21,
        levels: {
          create: g.levels.map((l) => ({
            level: l.level,
            label: l.label,
            minScore: l.minScore,
            stayYears: l.stayYears,
            minYrsSecondary: l.secondary,
            minYrsDiploma: l.diploma,
            minYrsBachelor: l.bachelor,
            minYrsMaster: l.master,
            minYrsPhd: l.phd,
            competencies: l.competencies,
          })),
        },
      },
    });
  }
  console.log(`  ✓ ${GRADES.length} grades`);

  // Shared competencies
  for (const c of SHARED_COMPETENCIES) {
    await prisma.competency.upsert({
      where: { sharedKey: c.sharedKey },
      update: {},
      create: {
        sharedKey: c.sharedKey,
        name: c.name,
        type: c.type,
        level: "BASIC",
        isShared: true,
        indicators: c.indicators,
      },
    });
  }
  console.log(`  ✓ ${SHARED_COMPETENCIES.length} shared competencies`);

  // Department tree: sector -> division -> department
  const sector = await prisma.department.upsert({
    where: { id: "seed-sector-sales" },
    update: {},
    create: { id: "seed-sector-sales", name: "قطاع المبيعات", level: "SECTOR" },
  });
  const division = await prisma.department.upsert({
    where: { id: "seed-division-retail" },
    update: {},
    create: { id: "seed-division-retail", name: "إدارة التجزئة", level: "DIVISION", parentId: sector.id },
  });
  const department = await prisma.department.upsert({
    where: { id: "seed-dept-showrooms" },
    update: {},
    create: { id: "seed-dept-showrooms", name: "قسم المعارض", level: "DEPARTMENT", parentId: division.id },
  });
  console.log("  ✓ department tree");

  const grade7 = await prisma.grade.findUnique({ where: { num: "7" } });
  const grade3 = await prisma.grade.findUnique({ where: { num: "3" } });
  const grade2 = await prisma.grade.findUnique({ where: { num: "2" } });

  // Reporting hierarchy: second-level mgr -> first-level mgr -> employee
  const secondMgrEmp = await prisma.employee.upsert({
    where: { employeeNumber: "E-1000" },
    update: {},
    create: {
      employeeNumber: "E-1000",
      name: "سعد القحطاني",
      departmentId: division.id,
      gradeId: grade7?.id ?? null,
    },
  });
  const firstMgrEmp = await prisma.employee.upsert({
    where: { employeeNumber: "E-1001" },
    update: { managerId: secondMgrEmp.id },
    create: {
      employeeNumber: "E-1001",
      name: "نورة العتيبي",
      departmentId: department.id,
      gradeId: grade3?.id ?? null,
      managerId: secondMgrEmp.id,
    },
  });
  const staffEmp = await prisma.employee.upsert({
    where: { employeeNumber: "E-1002" },
    update: { managerId: firstMgrEmp.id },
    create: {
      employeeNumber: "E-1002",
      name: "خالد الدوسري",
      departmentId: department.id,
      gradeId: grade2?.id ?? null,
      managerId: firstMgrEmp.id,
    },
  });
  console.log("  ✓ employee hierarchy");

  // Demo users (one per role). Shared password for convenience in dev.
  const password = await bcrypt.hash("Password123!", 12);
  const users: { email: string; name: string; role: Prisma.UserCreateInput["role"]; employeeId?: string }[] = [
    { email: "admin@hr.local", name: "مدير النظام", role: "ADMIN" },
    { email: "hr@hr.local", name: "مدير الموارد البشرية", role: "HR_MANAGER" },
    { email: "mgr2@hr.local", name: secondMgrEmp.name, role: "SECOND_LEVEL_MANAGER", employeeId: secondMgrEmp.id },
    { email: "mgr1@hr.local", name: firstMgrEmp.name, role: "FIRST_LEVEL_MANAGER", employeeId: firstMgrEmp.id },
    { email: "emp@hr.local", name: staffEmp.name, role: "EMPLOYEE", employeeId: staffEmp.id },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, name: u.name, employeeId: u.employeeId ?? null },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        hashedPassword: password,
        employeeId: u.employeeId ?? null,
      },
    });
  }
  console.log(`  ✓ ${users.length} demo users (password: Password123!)`);

  // Sample career path
  const existingPath = await prisma.careerPath.findFirst({ where: { name: "مسار الموارد البشرية" } });
  if (!existingPath) {
    await prisma.careerPath.create({
      data: {
        name: "مسار الموارد البشرية",
        field: "الموارد البشرية",
        duration: "10-14 سنة",
        description: "المسار المهني لتخصص الموارد البشرية من المستوى المبتدئ حتى القيادة",
        stages: {
          create: [
            { order: 1, title: "مساعد موارد بشرية", level: "ENTRY", gradeNum: "1", durationInRole: "1-2 سنة", description: "التعرف على العمليات الأساسية لإدارة الموارد البشرية", requiredCompetencies: ["التواصل المهني", "الالتزام المؤسسي", "العمل بروح الفريق"], promotionCriteria: ["إتقان أنظمة الموارد البشرية", "استيفاء مهام الدعم الإداري بكفاءة"] },
            { order: 2, title: "أخصائي موارد بشرية", level: "MID", gradeNum: "3", durationInRole: "2-3 سنوات", description: "تنفيذ عمليات التوظيف والتدريب ومتابعة شؤون الموظفين", requiredCompetencies: ["التوظيف والاختيار", "تقييم الأداء", "إدارة الوقت"], promotionCriteria: ["قيادة دورة توظيف كاملة بنجاح", "الحصول على شهادة مهنية معتمدة"] },
            { order: 3, title: "مشرف موارد بشرية", level: "SENIOR", gradeNum: "7", durationInRole: "2-3 سنوات", description: "الإشراف على فريق الموارد البشرية وضمان جودة الخدمات", requiredCompetencies: ["الإشراف والقيادة", "تنمية الفريق", "حل النزاعات"], promotionCriteria: ["قيادة فريق لمدة سنتين", "تحقيق مؤشرات أداء الإدارة"] },
            { order: 4, title: "مدير إدارة الموارد البشرية", level: "LEAD", gradeNum: "12", durationInRole: "3-5 سنوات", description: "الإشراف على إدارة الموارد البشرية وتوجيه الاستراتيجية", requiredCompetencies: ["الاستراتيجية", "القيادة التحويلية", "إدارة التغيير"], promotionCriteria: ["قيادة تحول مؤسسي كبير", "تطوير استراتيجية موارد بشرية متكاملة"] },
          ],
        },
      },
    });
    console.log("  ✓ sample career path");
  }

  // Default bell-curve policy
  const existingPolicy = await prisma.bellCurvePolicy.findFirst({ where: { name: "السياسة الافتراضية" } });
  if (!existingPolicy) {
    await prisma.bellCurvePolicy.create({
      data: {
        name: "السياسة الافتراضية",
        isActive: true,
        distribution: {
          labels: ["غير مرضي", "دون المتوقع", "حسب المتوقع", "فوق المتوقع", "استثنائي"],
          above: [0, 0, 35, 50, 15],
          achieved: [5, 5, 40, 40, 10],
          below: [10, 10, 35, 40, 5],
        },
      },
    });
    console.log("  ✓ bell-curve policy");
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
