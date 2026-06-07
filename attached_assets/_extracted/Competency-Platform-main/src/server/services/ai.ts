import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { aiKpiResultSchema, type AiKpiResult } from "@/lib/validators/kpi";
import { aiCompetencyResultSchema, type AiCompetencyResult } from "@/lib/validators/competency";
import { aiCareerPathSchema, type AiCareerPath } from "@/lib/validators/career-path";
import { COMPETENCY_TYPES, COMPETENCY_LEVELS, CAREER_STAGE_LEVELS } from "@/lib/enums";

/**
 * AI integration via OpenRouter (https://openrouter.ai) — an OpenAI-compatible
 * gateway to many models, including free ones. Server-side only; the API key
 * never leaves the server. We ask for JSON-only output and validate with Zod.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen3.6-plus:free";

export function isAiEnabled(): boolean {
  return process.env.AI_ENABLED === "true" && Boolean(process.env.OPENROUTER_API_KEY);
}

function requireAi(): { key: string; models: string[] } {
  if (!isAiEnabled()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "ميزة الذكاء الاصطناعي غير مفعّلة. أضف مفتاح OpenRouter في إعدادات الخادم.",
    });
  }
  const primary = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  // Optional comma-separated fallbacks; OpenRouter routes to the first available
  // model, so a saturated free pool transparently falls through to the next.
  const fallbacks = (process.env.OPENROUTER_FALLBACKS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  // OpenRouter allows at most 3 models in the routing array.
  const models = [primary, ...fallbacks].filter((m, i, a) => a.indexOf(m) === i).slice(0, 3);
  return { key: process.env.OPENROUTER_API_KEY as string, models };
}

/** Extract a JSON object from a model response that may wrap it in prose/code fences. */
function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) t = fence[1].trim();
  if (!t.startsWith("{")) {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
  }
  return t;
}

/** Call an OpenRouter chat model and validate its JSON output against a Zod schema. */
async function callModelJson<S extends z.ZodTypeAny>(
  prompt: string,
  validator: S,
): Promise<z.infer<S>> {
  const { key, models } = requireAi();

  // OpenRouter fallback routing: a single model → `model`; multiple → `models[]`.
  const routing = models.length > 1 ? { models } : { model: models[0] };

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        // Optional attribution headers used by OpenRouter for ranking.
        "HTTP-Referer": process.env.AUTH_URL || "http://localhost:3000",
        "X-Title": "Competency Platform",
      },
      body: JSON.stringify({
        ...routing,
        messages: [
          {
            role: "system",
            content: "أنت مساعد يُخرج JSON صالحًا فقط دون أي نص إضافي أو علامات Markdown أو شرح.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر الاتصال بخدمة الذكاء الاصطناعي." });
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? "";
    } catch {
      /* non-JSON error body */
    }
    console.error(`[ai] OpenRouter ${res.status}: ${detail}`);
    if (res.status === 429) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "ميزة الذكاء الاصطناعي مشغولة حاليا. يرجى المحاولة لاحقاً."
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `خدمة الذكاء الاصطناعي ردّت بخطأ (${res.status})` + (detail ? `: ${detail}` : "."),
    });
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "لم تُعد خدمة الذكاء الاصطناعي نتيجة صالحة." });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر تحليل استجابة الذكاء الاصطناعي." });
  }

  const result = validator.safeParse(parsed);
  if (!result.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "استجابة الذكاء الاصطناعي غير متوافقة مع الصيغة المطلوبة. حاول مجدداً أو جرّب نموذجاً آخر.",
    });
  }
  return result.data;
}

// ── KPIs ─────────────────────────────────────────────────────
export async function generateKpis(job: { name: string; competencies: string[] }): Promise<AiKpiResult> {
  const compList = job.competencies.length
    ? job.competencies.map((c) => `- ${c}`).join("\n")
    : "- (لا توجد جدارات محددة، اقترح مؤشرات عامة مناسبة للوظيفة)";
  const prompt = `أنت خبير موارد بشرية متخصص في مؤشرات الأداء الرئيسية (KPIs).
الوظيفة: ${job.name}
الجدارات المطلوبة:
${compList}

اقترح لكل جدارة من 2 إلى 3 مؤشرات أداء قابلة للقياس. لكل مؤشر حدّد: الاسم، وصف موجز، طريقة القياس، المستهدف، تكرار القياس، والوزن كنسبة مئوية. اجعل مجموع أوزان كل المؤشرات يساوي 100% تقريباً.
أعد JSON فقط بالشكل: {"summary":"...","groups":[{"competencyName":"...","compType":"...","kpis":[{"name":"...","description":"...","measure":"...","target":"...","frequency":"...","weight":"..."}]}]}`;
  return callModelJson(prompt, aiKpiResultSchema);
}

// ── Competencies ─────────────────────────────────────────────
export async function generateCompetencies(job: {
  name: string;
  description: string | null;
}): Promise<AiCompetencyResult> {
  const prompt = `أنت خبير موارد بشرية متخصص في تصميم الجدارات الوظيفية.
الوظيفة: ${job.name}
الوصف الوظيفي: ${job.description?.trim() || "غير متوفر"}

اقترح من 5 إلى 8 جدارات مناسبة لهذه الوظيفة. لكل جدارة:
- name: اسم الجدارة بالعربية
- type: واحدة فقط من: ${COMPETENCY_TYPES.join(" | ")} (قيادية/تقنية/سلوكية/وظيفية/إدارية)
- level: واحدة فقط من: ${COMPETENCY_LEVELS.join(" | ")}
- description: وصف موجز
- indicators: مؤشرات مفصولة بعلامة |
أعد JSON فقط بالشكل: {"competencies":[{"name":"...","type":"...","level":"...","description":"...","indicators":"..."}]}`;
  return callModelJson(prompt, aiCompetencyResultSchema);
}

// ── Career paths ─────────────────────────────────────────────
export async function generateCareerPath(field: string): Promise<AiCareerPath> {
  const prompt = `أنت خبير في تطوير المسارات المهنية والتعاقب الوظيفي.
المجال/التخصص: ${field}

صمّم مساراً وظيفياً من 5 إلى 7 مراحل من المستوى المبتدئ حتى القيادة. لكل مرحلة:
- title: المسمى الوظيفي
- level: واحدة فقط من: ${CAREER_STAGE_LEVELS.join(" | ")} (مبتدئ/متوسط/خبير/قيادي/تنفيذي)
- gradeNum: رقم الدرجة المقترح (نص)
- durationInRole: المدة المتوقعة
- description: وصف موجز
- requiredCompetencies: مصفوفة نصية بالجدارات المطلوبة
- promotionCriteria: مصفوفة نصية بمعايير الترقية
أعد JSON فقط بالشكل: {"name":"...","field":"...","duration":"...","description":"...","stages":[{"title":"...","level":"...","gradeNum":"...","durationInRole":"...","description":"...","requiredCompetencies":["..."],"promotionCriteria":["..."]}]}`;
  return callModelJson(prompt, aiCareerPathSchema);
}

// ── Job description ──────────────────────────────────────────
export async function generateJobDescription(job: {
  name: string;
  competencies: string[];
  department?: string | null;
  grade?: string | null;
}): Promise<string> {
  const comps = job.competencies.length ? job.competencies.join("، ") : "غير محددة";
  const prompt = `أنت خبير موارد بشرية متخصص في توصيف الوظائف.
اكتب وصفاً وظيفياً احترافياً ومختصراً بالعربية للوظيفة التالية:
- المسمى: ${job.name}
- الإدارة: ${job.department ?? "غير محددة"}
- الدرجة: ${job.grade ?? "غير محددة"}
- الجدارات المطلوبة: ${comps}

يتضمن الوصف: الغرض الوظيفي العام في فقرة قصيرة، ثم المسؤوليات الرئيسية في نقاط.
أعد JSON فقط بالشكل: {"description":"..."}`;
  const result = await callModelJson(prompt, z.object({ description: z.string().min(1) }));
  return result.description;
}
