package notifier

import (
	"fmt"
	"strings"

	"competency/internal/domain"
)

// renderTemplates generates subject, HTML body, and plain-text body for the given payload.
func renderTemplates(p SendPayload) (subject, html, text string) {
	switch p.Type {
	case domain.NotifNewEvaluation:
		return renderNewEval(p)
	case domain.NotifDeadlineReminder:
		return renderDeadline(p)
	case domain.NotifApproved:
		return renderApproved(p)
	case domain.NotifResultSummary:
		return renderSummary(p)
	default:
		return "إشعار", "<p>إشعار من منصة الكفاءات</p>", "إشعار من منصة الكفاءات"
	}
}

func wrapHTML(inner string) string {
	return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><style>
body { font-family: 'IBM Plex Sans Arabic', 'Segoe UI', sans-serif; background: #f5f6fa; margin: 0; padding: 20px; direction: rtl; }
.card { background: #fff; border-radius: 12px; max-width: 560px; margin: 0 auto; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.header { background: #2c3e6b; color: #fff; padding: 20px 32px; border-radius: 12px 12px 0 0; margin: -32px -32px 24px -32px; text-align: center; }
.header h1 { margin: 0; font-size: 20px; }
.btn { display: inline-block; background: #1a6b5a; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; margin-top: 16px; }
.footer { text-align: center; color: #888; font-size: 12px; margin-top: 24px; }
h2 { color: #2c3e6b; margin-top: 0; }
.info { background: #f0f4ff; padding: 12px 16px; border-radius: 8px; margin: 12px 0; }
</style></head>
<body><div class="card">
<div class="header"><h1>منصة الكفاءات</h1></div>
` + inner + `
<div class="footer">هذا إشعار آلي من منصة الكفاءات — لا تقم بالرد على هذه الرسالة.</div>
</div></body></html>`
}

func renderNewEval(p SendPayload) (string, string, string) {
	subject := "📋 تقييم جديد بانتظار التعبئة"
	inner := fmt.Sprintf(`
<h2>مرحباً %s،</h2>
<p>تم إنشاء تقييم أداء جديد لك للفترة <strong>%s</strong> وهو بانتظار تعبئتك.</p>
<div class="info">
<strong>الفترة:</strong> %s
</div>
<p style="text-align:center;"><a href="%s" class="btn">الذهاب إلى التقييم</a></p>`,
		p.EmployeeName, p.EvalPeriod, p.EvalPeriod, p.EvalLink)

	text := fmt.Sprintf("مرحباً %s،\nتم إنشاء تقييم أداء جديد لك للفترة %s.\nرابط التقييم: %s",
		p.EmployeeName, p.EvalPeriod, p.EvalLink)

	return subject, wrapHTML(inner), text
}

func renderDeadline(p SendPayload) (string, string, string) {
	subject := "⏰ تذكير — اقتراب موعد انتهاء التقييم"
	inner := fmt.Sprintf(`
<h2>مرحباً %s،</h2>
<p>نذكرك بأن فترة التقييم <strong>%s</strong> على وشك الانتهاء.</p>
<p>يرجى إكمال التقييم في أقرب وقت.</p>
<p style="text-align:center;"><a href="%s" class="btn">إكمال التقييم</a></p>`,
		p.EmployeeName, p.EvalPeriod, p.EvalLink)

	text := fmt.Sprintf("تذكير: فترة التقييم %s على وشك الانتهاء.\nأكمل التقييم: %s",
		p.EvalPeriod, p.EvalLink)

	return subject, wrapHTML(inner), text
}

func renderApproved(p SendPayload) (string, string, string) {
	subject := "✅ تم اعتماد تقييمك"
	scoreStr := "—"
	if p.TotalScore != nil {
		scoreStr = fmt.Sprintf("%d%%", *p.TotalScore)
	}
	label := ""
	if p.RatingLabel != nil && *p.RatingLabel != "" {
		label = fmt.Sprintf(" (%s)", *p.RatingLabel)
	}

	inner := fmt.Sprintf(`
<h2>مرحباً %s،</h2>
<p>تم اعتماد تقييم أدائك للفترة <strong>%s</strong> من قبل المدير.</p>
<div class="info">
<strong>الدرجة النهائية:</strong> %s%s
</div>
<p style="text-align:center;"><a href="%s" class="btn">عرض التقييم</a></p>`,
		p.EmployeeName, p.EvalPeriod, scoreStr, label, p.EvalLink)

	var b strings.Builder
	fmt.Fprintf(&b, "تم اعتماد تقييمك للفترة %s.\nالدرجة: %s%s\nالرابط: %s",
		p.EvalPeriod, scoreStr, label, p.EvalLink)

	return subject, wrapHTML(inner), b.String()
}

func renderSummary(p SendPayload) (string, string, string) {
	subject := "📊 ملخص نتيجة التقييم"
	scoreStr := "—"
	if p.TotalScore != nil {
		scoreStr = fmt.Sprintf("%d%%", *p.TotalScore)
	}
	label := ""
	if p.RatingLabel != nil && *p.RatingLabel != "" {
		label = *p.RatingLabel
	}

	inner := fmt.Sprintf(`
<h2>ملخص التقييم — %s</h2>
<div class="info">
<strong>الموظف:</strong> %s<br/>
<strong>الفترة:</strong> %s<br/>
<strong>الدرجة النهائية:</strong> %s<br/>
<strong>التصنيف:</strong> %s
</div>
<p style="text-align:center;"><a href="%s" class="btn">عرض التقييم الكامل</a></p>`,
		p.EmployeeName, p.EmployeeName, p.EvalPeriod, scoreStr, label, p.EvalLink)

	text := fmt.Sprintf("ملخص تقييم %s — الفترة: %s — الدرجة: %s — التصنيف: %s\nالرابط: %s",
		p.EmployeeName, p.EvalPeriod, scoreStr, label, p.EvalLink)

	return subject, wrapHTML(inner), text
}
