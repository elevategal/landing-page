# Elev8 — דף נחיתה לסדנת קריאייטיב AI

דף נחיתה בעברית (RTL) לסדנה של Elev8 Creative Strategy: "10 קריאטיבים מנצחים בשבוע באמצעות AI", מוגבלת ל־15 משתתפים.

- **Production:** https://elev8.co.il
- **Repo:** github.com/elevategal/landing-page
- **Hosting:** Netlify (כולל Netlify Functions)

---

## מבנה הפרויקט

```
landing-page/
├── index.html               # דף הנחיתה הראשי (~3,290 שורות, hero/VSL/לוגואים/syllabus/FAQ/CTA)
├── form.html                # טופס הרשמה
├── syllabus.html            # סילבוס מלא של הסדנה
├── thank-you.html           # תודה אחרי שליחה (no-index)
├── terms.html               # תקנון
├── privacy.html             # מדיניות פרטיות
├── accessibility.html       # הצהרת נגישות
├── accessibility-widget.js  # ווידג'ט נגישות
├── netlify/functions/
│   ├── submit-lead.js       # קבלת ליד → Airtable + Meta CAPI (Lead)
│   └── airtable-purchase.js # אירוע Purchase ל־Meta CAPI
├── _redirects               # נתיבים ידידותיים (/syllabus, /form, /thank-you...)
├── robots.txt + sitemap.xml
├── serve.py                 # שרת dev מקומי (port 8080)
├── logo/, logos-white/      # לוגואים של מותגים שעבדו עם Elev8
├── proof/, gif/, gifs/      # צילומי מסך והוכחות חברתיות
├── פתיח/                    # נכסי וידאו של פתיח הסדנה
├── צילומי מסך לקוחות/        # עדויות
├── utm-links.md             # רשימת קישורי UTM לכל ערוץ
└── tasks-import.csv         # רשימת משימות פתוחות (אתר + סרטונים)
```

תתי־דפים נגישים בנתיבים נקיים דרך `_redirects`:
`/form`, `/syllabus`, `/thank-you`, `/terms`, `/privacy`, `/accessibility`.

---

## Tracking & Analytics

| מערכת | מזהה | היכן |
|---|---|---|
| Meta Pixel | `1265390459065125` | `index.html` (אחרי הסכמת cookies) |
| Meta CAPI | אותו Pixel ID | `netlify/functions/submit-lead.js` + `airtable-purchase.js` |
| GA4 | `G-8SCLND9ZP6` | `index.html` |

- **דה־דופליקציה Pixel↔CAPI:** הטופס מייצר `eventId` יחיד שנשלח גם לדפדפן (`fbq('track', 'Lead', {}, { eventID })`) וגם לשרת.
- **Advanced Matching:** אחרי השליחה ה־Pixel מאותחל מחדש עם `em`/`ph`/`fn`/`ln` כדי לשפר התאמה.
- **PII hashing:** SHA-256 ב־CAPI על email/phone/name/country.

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

## משימות פתוחות

מנוהלות ב־`tasks-import.csv`. נכון להיום פתוחות בין השאר:
- וידוא שהפיקסל אכן סופר אירועים בפועל
- מעבר נוסף על הקופי
- סקשן המלצות
- הצפנת Monday API token ב־Netlify Functions
- החלפת CRM

---

## ⚠️ אזהרת אבטחה

הקובץ `.git/config` מכיל כרגע **GitHub PAT חשוף** ב־URL של ה־`origin`. החלף מיידית:

```bash
# 1. החלף את ה-token (מחק את הקיים ב-GitHub Settings → Developer → Personal access tokens)
# 2. נקה את ה-remote URL:
git remote set-url origin https://github.com/elevategal/landing-page.git
# 3. הגדר אותנטיקציה דרך gh CLI או SSH במקום:
gh auth login
# או:
git remote set-url origin git@github.com:elevategal/landing-page.git
```
