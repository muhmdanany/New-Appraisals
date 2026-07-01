// Command seed populates reference data and demo accounts, mirroring the
// original Prisma seed script. It is idempotent: re-running upserts by natural
// keys and skips already-present rows.
package main

import (
        "context"
        "fmt"
        "log"
        "os"

        "github.com/jackc/pgx/v4/pgxpool"
        "github.com/lucsky/cuid"
)

type levelSeed struct {
        level                                                          int
        label                                                         string
        minScore, stayYears, secondary, diploma, bachelor, master, phd int
        competencies                                                  string
}

type gradeSeed struct {
        num    string
        name   string
        levels []levelSeed
}

func lv(level int, label string, minScore, stayYears, secondary, diploma, bachelor, master, phd int, competencies string) levelSeed {
        return levelSeed{level, label, minScore, stayYears, secondary, diploma, bachelor, master, phd, competencies}
}

var grades = []gradeSeed{
        {"1", "عامل", []levelSeed{lv(1, "عامل", 85, 2, 0, 0, 0, 0, 0, "مهارات تشغيلية، التزام تعليمات، تنفيذ تعليمات")}},
        {"2", "ممثل مبيعات", []levelSeed{
                lv(1, "ممثل مبيعات", 85, 2, 0, 0, 0, 2, 0, "تواصل، إقناع، مهارات بيع أساسية"),
                lv(2, "أخصائي مبيعات", 85, 4, 0, 0, 1, 3, 4, "تواصل، إقناع، مهارات بيع متقدمة"),
                lv(3, "استشاري مبيعات", 85, 9, 0, 2, 6, 7, 8, "تواصل، إقناع، مهارات بيع احترافية"),
        }},
        {"3", "منسق", []levelSeed{
                lv(1, "منسق", 85, 3, 0, 0, 0, 1, 2, "تنظيم، تنسيق، مهارات إدارية"),
                lv(2, "مدير معرض", 85, 6, 0, 1, 2, 2, 4, "إشراف، تواصل، تدريب، مهارات بيع احترافية"),
                lv(3, "مدير معرض أول", 85, 8, 0, 1, 3, 3, 8, "إشراف، تواصل، تدريب، مهارات بيع احترافية"),
        }},
        {"4", "أخصائي", []levelSeed{lv(1, "أخصائي", 85, 4, 0, 0, 1, 2, 3, "مهارات فنية متخصصة، إعداد تقارير إدارية")}},
        {"5", "أخصائي أول", []levelSeed{lv(1, "أخصائي أول", 85, 6, 0, 0, 2, 3, 5, "حل مشكلات، إعداد تقارير فنية")}},
        {"6", "أخصائي رئيسي", []levelSeed{lv(1, "أخصائي رئيسي", 85, 7, 0, 0, 3, 5, 6, "تحليل بيانات، تطوير إجراءات العمل")}},
        {"7", "مشرف", []levelSeed{
                lv(1, "مشرف معارض", 85, 7, 0, 2, 2, 3, 5, "إشراف مبدئي، متابعة وتحقيق مستهدفات البيع"),
                lv(2, "مشرف معارض أول", 85, 9, 0, 4, 4, 5, 9, "إشراف مبدئي، متابعة وتحقيق مستهدفات البيع"),
                lv(3, "مشرف معارض رئيسي", 85, 13, 0, 2, 8, 9, 11, "إشراف مبدئي، متابعة وتحقيق مستهدفات البيع"),
        }},
        {"8", "مشرف قسم", []levelSeed{lv(1, "مشرف قسم", 85, 8, 0, 1, 4, 6, 7, "قيادة فريق، رقابة وتوجيه")}},
        {"9", "مشرف قسم أول", []levelSeed{
                lv(1, "مشرف قسم أول", 85, 9, 0, 1, 5, 7, 8, "قيادة فريق، رقابة وتوجيه"),
                lv(2, "مدير منطقة", 85, 9, 0, 4, 3, 5, 7, "قيادة مشرفين ومعارض أكبر، تحقيق نتائج مستهدفات"),
                lv(3, "مدير منطقة أول", 85, 13, 0, 4, 7, 9, 11, "قيادة مشرفين ومعارض أكبر، تحقيق نتائج مستهدفات"),
                lv(4, "مدير منطقة رئيسي", 85, 17, 0, 2, 11, 13, 15, "قيادة مشرفين ومعارض أكبر، تحقيق نتائج مستهدفات"),
        }},
        {"10", "رئيس قسم", []levelSeed{
                lv(1, "رئيس قسم", 90, 10, 0, 2, 6, 8, 8, "تخطيط تشغيلي، قيادة أفراد القسم، تحقيق مستهدفات القسم"),
                lv(2, "مدير إقليم", 90, 9, 0, 4, 3, 5, 7, "إدارة إقليم ومعارض أكبر، اتخاذ قرارات استراتيجية"),
                lv(3, "مدير إقليم أول", 90, 13, 0, 4, 7, 9, 11, "إدارة إقليم ومعارض أكبر، اتخاذ قرارات استراتيجية"),
                lv(4, "مدير إقليم رئيسي", 90, 17, 0, 2, 11, 13, 15, "إدارة إقليم ومعارض أكبر، اتخاذ قرارات استراتيجية"),
        }},
        {"11", "رئيس قسم أول", []levelSeed{lv(1, "رئيس قسم أول", 90, 11, 0, 2, 8, 10, 10, "تخطيط تشغيلي، قيادة أفراد القسم، إدارة مستهدفات القسم")}},
        {"12", "مدير إدارة", []levelSeed{lv(1, "مدير إدارة", 90, 14, 0, 3, 10, 12, 12, "إدارة استراتيجية، اتخاذ قرارات إدارية، تحقيق مستهدفات")}},
        {"13", "مدير إدارة أول", []levelSeed{lv(1, "مدير إدارة أول", 90, 17, 0, 3, 13, 15, 15, "إدارة استراتيجية، تفكير تحليلي، تحقيق نتائج مستهدفات")}},
        {"14", "نائب رئيس تنفيذي", []levelSeed{lv(1, "نائب رئيس تنفيذي", 95, 19, 0, 3, 15, 17, 17, "تخطيط استراتيجي، تحكم كلي، إدارة مخاطر، تحقيق نتائج مستهدفات")}},
        {"15", "رئيس تنفيذي", []levelSeed{lv(1, "رئيس تنفيذي", 95, 22, 0, 3, 18, 20, 21, "رؤية اقتصادية، استدامة ونمو الشركة، تحقيق أرباح")}},
}

type sharedComp struct {
        key, name, typ, indicators string
}

var sharedCompetencies = []sharedComp{
        {"b1", "الالتزام المؤسسي والنزاهة", "BEHAVIORAL", "الحضور | الامتثال | الدقة"},
        {"b2", "التواصل والتأثير المهني", "BEHAVIORAL", "وضوح التقارير | جودة العروض"},
        {"b3", "العمل بروح الفريق", "BEHAVIORAL", "المشاركة | دعم الزملاء"},
        {"b4", "المبادرة والابتكار", "BEHAVIORAL", "المقترحات التحسينية | الاستباقية"},
        {"b5", "التطوير الذاتي", "BEHAVIORAL", "ساعات التدريب | تطبيق المكتسبات"},
        {"l1", "التخطيط وتحديد الأولويات", "LEADERSHIP", "خطة عمل موثقة | نسبة تحقيق الأهداف"},
        {"l2", "تنمية وتمكين الفريق", "LEADERSHIP", "جلسات الإرشاد | تحسّن أداء المرؤوسين"},
        {"l3", "صنع القرار وحل المشكلات", "LEADERSHIP", "سرعة البت | الاعتماد على البيانات"},
        {"l4", "إدارة الأداء والمتابعة", "LEADERSHIP", "انتظام الاجتماعات | جودة التغذية الراجعة"},
        {"l5", "قيادة التغيير والمرونة", "LEADERSHIP", "قيادة مبادرات التحول | الاستجابة"},
        {"t1", "الكفاءة التقنية والمعرفة الوظيفية", "TECHNICAL", "إتقان الأنظمة | مواكبة المستجدات"},
        {"t2", "جودة المخرجات ودقة العمل", "TECHNICAL", "نسبة الأخطاء | إعادة العمل"},
        {"t3", "إدارة الوقت وإنجاز المهام", "TECHNICAL", "نسبة الإنجاز في الموعد | الجودة تحت الضغط"},
        {"t4", "التفكير التحليلي", "TECHNICAL", "استخدام البيانات | دقة التحليلات"},
}

func main() {
        url := os.Getenv("DATABASE_URL")
        if url == "" {
                log.Fatal("DATABASE_URL is required")
        }
        ctx := context.Background()
        pool, err := pgxpool.Connect(ctx, url)
        if err != nil {
                log.Fatalf("connect: %v", err)
        }
        defer pool.Close()

        fmt.Println("🌱 Seeding database…")

        // Grades + levels.
        for _, g := range grades {
                var gradeID string
                err := pool.QueryRow(ctx, `SELECT id FROM "Grade" WHERE num=$1`, g.num).Scan(&gradeID)
                if err != nil {
                        gradeID = cuid.New()
                        if _, err := pool.Exec(ctx, `
                                INSERT INTO "Grade" (id, num, name, classification, "leaveDays", "createdAt", "updatedAt")
                                VALUES ($1,$2,$3,$4,21, now(), now())`, gradeID, g.num, g.name, g.name); err != nil {
                                log.Fatalf("grade %s: %v", g.num, err)
                        }
                        for _, l := range g.levels {
                                if _, err := pool.Exec(ctx, `
                                        INSERT INTO "GradeLevel" (id, "gradeId", level, label, "minScore", "stayYears",
                                                "minYrsSecondary", "minYrsDiploma", "minYrsBachelor", "minYrsMaster", "minYrsPhd", competencies)
                                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                                        cuid.New(), gradeID, l.level, l.label, l.minScore, l.stayYears,
                                        l.secondary, l.diploma, l.bachelor, l.master, l.phd, l.competencies); err != nil {
                                        log.Fatalf("grade level %s/%d: %v", g.num, l.level, err)
                                }
                        }
                }
        }
        fmt.Printf("  ✓ %d grades\n", len(grades))

        // Shared competencies.
        for _, c := range sharedCompetencies {
                if _, err := pool.Exec(ctx, `
                        INSERT INTO "Competency" (id, name, type, level, "isShared", "sharedKey", indicators, "createdAt", "updatedAt")
                        VALUES ($1,$2,$3,'BASIC',true,$4,$5, now(), now())
                        ON CONFLICT ("sharedKey") DO NOTHING`,
                        cuid.New(), c.name, c.typ, c.key, c.indicators); err != nil {
                        log.Fatalf("competency %s: %v", c.key, err)
                }
        }
        fmt.Printf("  ✓ %d shared competencies\n", len(sharedCompetencies))

        // Department tree (fixed ids for idempotency).
        depts := []struct{ id, name, level, parent string }{
                {"seed-sector-sales", "قطاع المبيعات", "SECTOR", ""},
                {"seed-division-retail", "إدارة التجزئة", "DIVISION", "seed-sector-sales"},
                {"seed-dept-showrooms", "قسم المعارض", "DEPARTMENT", "seed-division-retail"},
        }
        for _, d := range depts {
                var parent *string
                if d.parent != "" {
                        p := d.parent
                        parent = &p
                }
                if _, err := pool.Exec(ctx, `
                        INSERT INTO "Department" (id, name, level, "parentId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4, now(), now())
                        ON CONFLICT (id) DO NOTHING`, d.id, d.name, d.level, parent); err != nil {
                        log.Fatalf("department %s: %v", d.id, err)
                }
        }
        fmt.Println("  ✓ department tree")

        gradeID := func(num string) *string {
                var id string
                if err := pool.QueryRow(ctx, `SELECT id FROM "Grade" WHERE num=$1`, num).Scan(&id); err != nil {
                        return nil
                }
                return &id
        }

        // Employee reporting hierarchy.
        upsertEmployee := func(number, name, deptID string, grade *string, manager *string) string {
                var id string
                err := pool.QueryRow(ctx, `SELECT id FROM "Employee" WHERE "employeeNumber"=$1`, number).Scan(&id)
                if err == nil {
                        pool.Exec(ctx, `UPDATE "Employee" SET "managerId"=$2, "updatedAt"=now() WHERE id=$1`, id, manager)
                        return id
                }
                id = cuid.New()
                if _, err := pool.Exec(ctx, `
                        INSERT INTO "Employee" (id, "employeeNumber", name, "departmentId", "gradeId", "managerId", "createdAt", "updatedAt")
                        VALUES ($1,$2,$3,$4,$5,$6, now(), now())`, id, number, name, deptID, grade, manager); err != nil {
                        log.Fatalf("employee %s: %v", number, err)
                }
                return id
        }
        secondMgr := upsertEmployee("E-1000", "سعد القحطاني", "seed-division-retail", gradeID("7"), nil)
        firstMgr := upsertEmployee("E-1001", "نورة العتيبي", "seed-dept-showrooms", gradeID("3"), &secondMgr)
        staff := upsertEmployee("E-1002", "خالد الدوسري", "seed-dept-showrooms", gradeID("2"), &firstMgr)
        fmt.Println("  ✓ employee hierarchy")

        // Demo users (one per role). The system has no login, so these carry no
        // password; they exist only to satisfy actor foreign keys on records.
        users := []struct {
                email, name, role string
                employeeID        *string
        }{
                {"admin@hr.local", "مدير النظام", "ADMIN", nil},
                {"hr@hr.local", "مدير الموارد البشرية", "HR_MANAGER", nil},
                {"mgr2@hr.local", "سعد القحطاني", "SECOND_LEVEL_MANAGER", &secondMgr},
                {"mgr1@hr.local", "نورة العتيبي", "FIRST_LEVEL_MANAGER", &firstMgr},
                {"emp@hr.local", "خالد الدوسري", "EMPLOYEE", &staff},
        }
        for _, u := range users {
                if _, err := pool.Exec(ctx, `
                        INSERT INTO "User" (id, email, name, role, "hashedPassword", "employeeId", "isActive", "createdAt", "updatedAt")
                        VALUES ($1,$2,$3,$4,$5,$6,true, now(), now())
                        ON CONFLICT (email) DO UPDATE SET role=EXCLUDED.role, name=EXCLUDED.name, "employeeId"=EXCLUDED."employeeId", "updatedAt"=now()`,
                        cuid.New(), u.email, u.name, u.role, nil, u.employeeID); err != nil {
                        log.Fatalf("user %s: %v", u.email, err)
                }
        }
        fmt.Printf("  ✓ %d system users (no login)\n", len(users))

        // Sample career path.
        var cpExists string
        if err := pool.QueryRow(ctx, `SELECT id FROM "CareerPath" WHERE name=$1`, "مسار الموارد البشرية").Scan(&cpExists); err != nil {
                cpID := cuid.New()
                if _, err := pool.Exec(ctx, `
                        INSERT INTO "CareerPath" (id, name, field, duration, description, "isAiGenerated", "createdAt", "updatedAt")
                        VALUES ($1,$2,$3,$4,$5,false, now(), now())`,
                        cpID, "مسار الموارد البشرية", "الموارد البشرية", "10-14 سنة",
                        "المسار المهني لتخصص الموارد البشرية من المستوى المبتدئ حتى القيادة"); err != nil {
                        log.Fatalf("career path: %v", err)
                }
                stages := []struct {
                        order                int
                        title, level, grade  string
                        duration, desc       string
                        required, promotion  []string
                }{
                        {1, "مساعد موارد بشرية", "ENTRY", "1", "1-2 سنة", "التعرف على العمليات الأساسية لإدارة الموارد البشرية",
                                []string{"التواصل المهني", "الالتزام المؤسسي", "العمل بروح الفريق"},
                                []string{"إتقان أنظمة الموارد البشرية", "استيفاء مهام الدعم الإداري بكفاءة"}},
                        {2, "أخصائي موارد بشرية", "MID", "3", "2-3 سنوات", "تنفيذ عمليات التوظيف والتدريب ومتابعة شؤون الموظفين",
                                []string{"التوظيف والاختيار", "تقييم الأداء", "إدارة الوقت"},
                                []string{"قيادة دورة توظيف كاملة بنجاح", "الحصول على شهادة مهنية معتمدة"}},
                        {3, "مشرف موارد بشرية", "SENIOR", "7", "2-3 سنوات", "الإشراف على فريق الموارد البشرية وضمان جودة الخدمات",
                                []string{"الإشراف والقيادة", "تنمية الفريق", "حل النزاعات"},
                                []string{"قيادة فريق لمدة سنتين", "تحقيق مؤشرات أداء الإدارة"}},
                        {4, "مدير إدارة الموارد البشرية", "LEAD", "12", "3-5 سنوات", "الإشراف على إدارة الموارد البشرية وتوجيه الاستراتيجية",
                                []string{"الاستراتيجية", "القيادة التحويلية", "إدارة التغيير"},
                                []string{"قيادة تحول مؤسسي كبير", "تطوير استراتيجية موارد بشرية متكاملة"}},
                }
                for _, st := range stages {
                        if _, err := pool.Exec(ctx, `
                                INSERT INTO "CareerPathStage" (id, "careerPathId", "order", title, level, "gradeNum", "durationInRole", description, "requiredCompetencies", "promotionCriteria")
                                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                                cuid.New(), cpID, st.order, st.title, st.level, st.grade, st.duration, st.desc, st.required, st.promotion); err != nil {
                                log.Fatalf("career stage %d: %v", st.order, err)
                        }
                }
                fmt.Println("  ✓ sample career path")
        }

        // Default bell-curve policy.
        var bcExists string
        if err := pool.QueryRow(ctx, `SELECT id FROM "BellCurvePolicy" WHERE name=$1`, "السياسة الافتراضية").Scan(&bcExists); err != nil {
                dist := `{"labels":["غير مرضي","دون المتوقع","حسب المتوقع","فوق المتوقع","استثنائي"],"above":[0,0,35,50,15],"achieved":[5,5,40,40,10],"below":[10,10,35,40,5]}`
                if _, err := pool.Exec(ctx, `
                        INSERT INTO "BellCurvePolicy" (id, name, "isActive", distribution, "createdAt", "updatedAt")
                        VALUES ($1,$2,true,$3, now(), now())`,
                        cuid.New(), "السياسة الافتراضية", dist); err != nil {
                        log.Fatalf("bell curve policy: %v", err)
                }
                fmt.Println("  ✓ bell-curve policy")
        }

        fmt.Println("✅ Seed complete.")
}
