# Elev8 — דפי נחיתה (סדנה + וובינר)

הפרויקט מכיל שני דפי נחיתה בעברית (RTL) של Elev8 Creative Strategy:

1. **דף הסדנה** (`/`, `index.html`) — "10 קריאטיבים מנצחים בשבוע באמצעות AI", מוגבלת ל־15 משתתפים.
2. **דף הוובינר** (`/webinar`, `webinar.html`) — "למה המודעה שלך לא ממירה" — וובינר חינמי לייב 5.5.2026 בשעה 20:00, 40 דק׳, מוגבל ל־30 משתתפים, ללא הקלטה.

- **Production:** https://elev8.co.il
- **Repo:** github.com/elevategal/landing-page
- **Hosting:** Netlify (כולל Netlify Functions)

---

## מבנה הפרויקט

```
landing-page/
├── index.html               # דף הסדנה הראשי (~3,290 שורות, hero/VSL/לוגואים/syllabus/FAQ/CTA)
├── webinar.html             # דף וובינר 5.5 (8 סקשנים: hero/בשבילך אם/3 דברים/מי אני/לוגואים/מה לדעת/FAQ/טופס)
├── form.html                # טופס הרשמה לסדנה
├── syllabus.html            # סילבוס מלא של הסדנה (עיצוב bz brutal זהה ל-index)
├── thank-you.html           # תודה אחרי הרשמה לסדנה (no-index)
├── thank-you-webinar.html   # תודה אחרי הרשמה לוובינר → CTA לקבוצת וואטסאפ + Google Calendar
├── terms.html               # תקנון
├── privacy.html             # מדיניות פרטיות
├── accessibility.html       # הצהרת נגישות
├── accessibility-widget.js  # ווידג'ט נגישות
├── netlify/functions/
│   ├── submit-lead.js       # קבלת ליד → Airtable + Meta CAPI (Lead)
│   └── airtable-purchase.js # אירוע Purchase ל־Meta CAPI
├── _redirects               # נתיבים ידידותיים (/syllabus, /form, /webinar, /live, /thank-you-webinar...)
├── robots.txt + sitemap.xml
├── serve.py                 # שרת dev מקומי (port 8080)
├── logo/, logos-white/      # לוגואים של מותגים שעבדו עם Elev8
├── proof/, gif/, gifs/      # צילומי מסך והוכחות חברתיות
├── פתיח/                    # נכסי וידאו של פתיח הסדנה
├── צילומי מסך לקוחות/        # עדויות
├── utm-links.md             # רשימת קישורי UTM לסדנה
├── utm-links-webinar.md     # רשימת קישורי UTM לוובינר
├── CHANGES.md               # תיעוד שינויים מסשן הוובינר (מאי 2026)
└── tasks-import.csv         # רשימת משימות פתוחות
```

### נתיבים נקיים (`_redirects`)

| נתיב | יעד |
|---|---|
| `/form` | `form.html` |
| `/syllabus` | `syllabus.html` |
| `/thank-you` | `thank-you.html` |
| `/webinar` | `webinar.html` |
| `/live` | `webinar.html` |
| `/thank-you-webinar` | `thank-you-webinar.html` |
| `/terms` | `terms.html` |
| `/privacy` | `privacy.html` |
| `/accessibility` | `accessibility.html` |

---

## דף הוובינר — איך לעדכן

### Progress bar (כמה כבר נרשמו)
ב-`webinar.html` יש 2 ברים. שנה את `data-taken` בשניהם:
```html
<div class="spots-progress webinar-spots" data-taken="15" data-total="30" ...>
```
- `data-taken` — כמה כבר נרשמו (ידני)
- `data-total` — סך הכל (ברירת מחדל 30)
- ב-80%+ → צבע משתנה לאדום-כתום אוטומטית
- ב-100% → טקסט משתנה ל"הוובינר מלא - הצטרף לרשימת המתנה" אוטומטית

### קישור קבוצת הוואטסאפ (בדף תודה)
ב-`thank-you-webinar.html`:
```
https://chat.whatsapp.com/BOjfgWWzE4sI59ynWCih7f?mode=gi_t
```

### עיקרון קופי
דף הוובינר **לא מוכר את הסדנה**. ההצעה לסדנה תוצג רק בסוף הלייב. אין סקשן השוואה ואין testimonials של הסדנה.

---

## Tracking & Analytics

| מערכת | מזהה | היכן |
|---|---|---|
| Meta Pixel | `1265390459065125` | `index.html` + `webinar.html` (אחרי הסכמת cookies) |
| Meta CAPI | אותו Pixel ID | `netlify/functions/submit-lead.js` + `airtable-purchase.js` |
| GA4 | `G-8SCLND9ZP6` | `index.html` + `webinar.html` |

### אירועים

| Event | מתי | היכן |
|---|---|---|
| `PageView` | אוטומטי | כל הדפים |
| `Lead` | בשליחת טופס | `form.html`, `webinar.html` |
| `JoinWhatsAppGroup` (custom) | בלחיצה על כפתור הקבוצה | `thank-you-webinar.html` |

**פאנל הוובינר המלא:** PageView → Lead → JoinWhatsAppGroup. ההפרש בין Lead ל-JoinWhatsAppGroup חושף אם דף התודה עובד.

**צריך להגדיר ידנית ב-Events Manager:** Custom Conversions → בחר `JoinWhatsAppGroup` → שם "הצטרפות לקבוצת הוובינר" — כדי לאפשר אופטימיזציה לקמפיינים על הצטרפות בפועל ולא רק על Lead.

### דה־דופליקציה Pixel↔CAPI
הטופס מייצר `eventId` יחיד שנשלח גם לדפדפן (`fbq('track', 'Lead', {}, { eventID })`) וגם לשרת.

### Advanced Matching
אחרי השליחה ה־Pixel מאותחל מחדש עם `em`/`ph`/`fn`/`ln` כדי לשפר התאמה.

### PII hashing
SHA-256 ב־CAPI על email/phone/name/country.

---

## משתני סביבה (Netlify)

```
FB_CAPI_TOKEN       # Meta Conversions API access token
AIRTABLE_API_TOKEN  # CRM ליצירת ליד (submit-lead)
```

---

## הפעלה מקומית

```bash
python serve.py
# פותח על http://localhost:8080
```

> שים לב: Netlify Functions לא ירוצו עם `serve.py`. כדי לבדוק את הטופס מקצה־לקצה, השתמש ב־`netlify dev`.

---

## וידאו (VSL)

הנגן הוא **Bunny Stream** (mediadelivery.net), Library `637122`. הסרטון נטען ב־iframe דינמי בלחיצה על ה־thumbnail.

---

## Deploy

`git push origin main` → Netlify מבצע auto-deploy.

> ⚠️ אימות ל-GitHub: ה-PAT הישן הוסר מ-`.git/config` (היה חשוף בעבר). השתמש ב-`gh auth login` או SSH:
> ```bash
> gh auth login
> # או:
> git remote set-url origin git@github.com:elevategal/landing-page.git
> ```

---

## משימות פתוחות

מנוהלות ב-`tasks-import.csv`. נכון להיום פתוחות בין השאר:
- וידוא שהפיקסל אכן סופר אירועים בפועל
- מעבר נוסף על הקופי
- סקשן המלצות
- הצפנת Monday API token ב-Netlify Functions
- החלפת CRM
- הגדרת `JoinWhatsAppGroup` כ-Custom Conversion ב-Events Manager

---

## צ'קליסט לפני השקת קמפיין הוובינר

- [ ] `data-taken` בבר ההתקדמות מציג מספר נכון (ברירת מחדל 15/30)
- [ ] לינק הוואטסאפ עובד בדף התודה
- [ ] לינק Google Calendar פותח אירוע נכון (5.5 בשעה 20:00 ישראל)
- [ ] פיקסל יורה Lead בשליחת טופס
- [ ] אירוע `JoinWhatsAppGroup` יורה בלחיצה על כפתור הקבוצה (Events Manager → Test Events)
- [ ] `JoinWhatsAppGroup` מוגדר כ-Custom Conversion
- [ ] הדף נטען מהר במובייל (LCP < 2.5s)
- [ ] בדיקת RTL במובייל אמיתי (80% מהתנועה משם)
- [ ] טופס שולח ומגיע ל-Airtable
