# UTM Links — שיטת המראה

**Base URL:** `https://elev8.co.il/miror`
**קמפיין ברירת מחדל (fallback):** אם לינק מגיע בלי `utm_campaign` בכלל, הדף שם אוטומטית `mirror` - זה לא תחליף לתיוג אמיתי, רק רשת ביטחון שהנתון לא יהיה ריק.

---

## 🔵 Meta Ads (Facebook + Instagram) — הגדרה חד-פעמית, לא קישור קבוע

בניגוד לשאר הערוצים, פה **לא מעתיקים קישור** - כי כל מודעה צריכה לדווח את השם האמיתי שלה (קמפיין + מודעה), לא שם קבוע שתקליד.

**איפה:** בעריכת מודעה (ברמת ה-Ad, לא הקמפיין) → **Tracking** → **URL Parameters** → **Build a URL parameter**
1. Parameter = `campaign` → Dynamic value = **Campaign Name**
2. Parameter = `content` → Dynamic value = **Ad Name**

אם אין כפתור "Build a URL parameter", תדביק ידנית בתוך שדה ה-URL Parameters:
```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```

עושים את זה פעם אחת על המודעה הראשונה בקמפיין - מודעות ששוכפלות (Duplicate) ממנה יורשות את זה אוטומטית.

---

## ערוצים אורגניים — מוכנים להעתקה

כולם עם קמפיין משותף `mirror_organic`, כדי שאפשר יהיה לסנן "כל התנועה האורגנית" ביחד, ו-`utm_content` שונה לכל מיקום ספציפי.

### 📱 ביו אינסטגרם
```
https://elev8.co.il/miror?utm_source=instagram&utm_medium=bio&utm_campaign=mirror_organic
```

### 📖 סטורי (תחליף את התאריך/נושא בכל סטורי כדי לדעת איזה בדיוק)
```
https://elev8.co.il/miror?utm_source=instagram&utm_medium=story&utm_campaign=mirror_organic&utm_content=09-10
```

### 💚 קבוצת וואטסאפ (תחליף את שם הקבוצה)
```
https://elev8.co.il/miror?utm_source=whatsapp&utm_medium=group&utm_campaign=mirror_organic&utm_content=creative-scale
```

### פוסט אורגני בפייסבוק
```
https://elev8.co.il/miror?utm_source=facebook&utm_medium=organic&utm_campaign=mirror_organic
```

### פוסט אורגני באינסטגרם (פיד/רילס)
```
https://elev8.co.il/miror?utm_source=instagram&utm_medium=organic&utm_campaign=mirror_organic
```

### TikTok Bio
```
https://elev8.co.il/miror?utm_source=tiktok&utm_medium=bio&utm_campaign=mirror_organic
```

### 📺 תיאור סרטון ביוטיוב - casestudy
```
https://elev8.co.il/miror?utm_source=youtube&utm_medium=description&utm_campaign=mirror_organic&utm_content=casestudy
```

### ביו/אודות הערוץ
```
https://elev8.co.il/miror?utm_source=youtube&utm_medium=bio&utm_campaign=mirror_organic
```

### פוסט בקהילה (Community tab)
```
https://elev8.co.il/miror?utm_source=youtube&utm_medium=community&utm_campaign=mirror_organic
```

### תגובה נעוצה בסרטון - casestudy
```
https://elev8.co.il/miror?utm_source=youtube&utm_medium=comment&utm_campaign=mirror_organic&utm_content=casestudy
```

### חתימת מייל
```
https://elev8.co.il/miror?utm_source=email&utm_medium=signature&utm_campaign=mirror_organic
```

### ניוזלטר
```
https://elev8.co.il/miror?utm_source=email&utm_medium=newsletter&utm_campaign=mirror_organic
```

### QR קוד (כרטיס ביקור, אירועים)
```
https://elev8.co.il/miror?utm_source=qr&utm_medium=offline&utm_campaign=mirror_organic
```

---

## איך לקרוא את זה אחר כך

| פרמטר | מה הוא אומר |
|---|---|
| `utm_source` | מאיפה (instagram / whatsapp / facebook...) |
| `utm_medium` | איזה סוג (bio / story / organic / paid / group) |
| `utm_campaign` | `mirror_organic` לכל האורגני, או שם הקמפיין האמיתי למודעות ממומנות |
| `utm_content` | פרט מזהה - איזה סטורי, איזו קבוצה, איזו מודעה |
