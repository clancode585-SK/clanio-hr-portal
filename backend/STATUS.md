# Clanio HRMS — Status

**Last session: 17 September 2026**

Ye file batati hai **abhi kahan hain aur aage kya karna hai.** Purane
detail `../PROJECT-NOTES.md` me hain.

---

## Ek nazar mein

| | |
|---|---|
| API endpoints | **463** under `/api/hrms` |
| App me integrated | **463 / 463** |
| Services | 56 |
| Company controllers | 60 |
| Schema files | 37 (raw SQL, koi migration nahi) |
| Permissions | 108 |
| Mobile app | Expo SDK 57 — **poori ban chuki hai**, saare role |

Do endpoint jaan-boojh kar chhode hain — `exits/pending-hr-approval` aur
`exits/serving-notice`. Exits screen wahi data client side filter karke
"With HR" aur "On notice" tab me dikha deti hai, extra call ki zarurat nahi.

---

## Is session me kya bana

### Data Import — CSV se bulk data
- `ImportModules.php` — 11 module, har ek ke apne columns + validation rules
- `ImportService.php` — CSV padhkar **existing tables** me. Koi nayi table nahi
- 3 route: `imports/modules`, `imports/{module}/sample`, `imports/{module}`
- Dobara import karo to `code`/`email` se match karke **update** hota hai, duplicate nahi
- Ek row galat ho to baaki nahi rukte — us row ka reason milta hai
- Nayi permission nahi — har module apna existing use karta hai
- **Test: 14/14 pass**

Modules: departments, designations, branches, work_shifts, leave_types,
holidays, teams, employees, leave_balances, attendance, assets.
Salary structure import me nahi hai — wo employee ke andar se set hoti hai.

### Realtime notification — Reverb websocket
- Backend me pehle se tha, app kabhi connect hi nahi hui thi
- `lib/realtime.ts` — Pusher protocol seedha, koi library nahi, auto reconnect
- Login par `user.{id}` + `company.{id}` channel subscribe
- Naya notification aate hi upar se banner slide hota hai, bell par live badge
- **Live verified** — server se event bheja, app me turant dikha

### Push notification — app side ready
- `expo-notifications`, token `/devices` par register, logout par delete
- Notification tap → `action_url` ke hisab se sahi screen
- Package: `com.clanio.hrms`
- **Abhi chalega nahi** — Firebase chahiye (neeche dekho)

### File download — 5 jagah
Employee documents, task attachments, expense bills, exit documents, policy PDF.
Pehle upload ho jaata tha par wapas dekha nahi ja sakta tha.
Native par share sheet, web par seedha download. **Test 7/7 pass.**

### Super Admin module
Platform dashboard, companies list + 5-step add wizard (plan + GST + dummy
payment), company detail, 28 module toggle, impersonation, archive, plans,
revenue, permissions master list.

### Roles theek kiye — company 1
| Role | Level | Scope | Perms |
|---|---|---|---|
| Company Admin | 2 | all_company | 80 |
| HR Manager | 3 | all_company | 55 |
| Finance Manager | 3 | all_company | 7 |
| Senior Manager | 3 | department | 15 |
| Manager | 4 | department | 10 |
| Team Lead | 5 | team | 10 |
| Member | 8 | self | 3 |

Team Lead ko leave approve, attendance fix, team SOD/EOD mila.
HR ko `user.permission` mila. `Temp Role` hata diya.

### Gap band kiye — 14 Sep
| Kya | Kahan |
|---|---|
| Audit Log viewer | `GET /audit-logs`, `/filters`, `/{id}` + screen. 897 row pehle se DB me. Event/entity/actor filter, before-after diff, load more |
| `ticket_slas` edit API | `GET`/`PUT /ticket-slas` + Response Times screen. 4 priority, ghante shabdon me |
| `GET /employees/reporting-managers` | Manager dropdown ab `/users` ki jagah isse aata hai — designation, department, reports count dikhta hai |
| `plan.manage` leak | Company admin role ko platform permission mil rahi thi. `PLATFORM_ONLY_PERMISSIONS` me daal diya |

Naya permission `audit.view` — super admin + company admin ko mila.
**Test: API 29/29, app 33/33 pass.**

### Invoices — plan lete hi invoice ban jaata hai
- `invoices` table — number `CLN-2026-0001` se sequenced, saal ke hisab se
- Trigger: `PUT /companies/{company}/plan`. Plan ya seats badla to **turant** invoice
- Wahi plan wahi seats dobara bheja to invoice nahi banta — duplicate se bacha
- Signup wizard payment reference bhejta hai → invoice `paid`. Warna `pending`
- Company ka naam, GSTIN, address invoice par **freeze** ho jaate hain — baad me company badle to purana invoice nahi badalta
- `GET /invoices`, `/invoices/summary`, `/invoices/{id}`, `/invoices/{id}/download` (CSV)
- Super admin hi `mark-paid` aur `cancel` kar sakta hai. Paid invoice cancel nahi hoti
- Screen: Invoices — collected/awaiting total, status filter, detail sheet, download
- Company admin sirf apne invoice dekhta hai, download kar sakta hai, paid nahi kar sakta
- Naye permission `invoice.view` (super admin + company admin), `invoice.manage` (sirf platform)
- **Test: API 40/40 pass**

### Recruitment — opening se joining tak, website ke saath
4 table: `job_openings`, `candidates`, `applications`, `career_pages`.

**Tool ke andar**
- Opening me poora JD — title, location, experience, employment type, positions,
  key responsibilities, required skills, good to have (ek line = ek bullet)
- Draft private rehta hai. Publish karte hi career page par live
- Publish se pehle responsibilities aur requirements maange jaate hain
- Pipeline: applied → screening → interview → offer → joined / rejected / dropped
- Offer ke liye CTC, joined ke liye date, reject ke liye reason zaruri
- Joined hone ke baad candidate wapas move nahi hota
- Resume download, candidate ki saari detail, cover note
- Nayi application par `recruitment.manage` walon ko notification + websocket banner

**Company ki website ke liye — unka code chhue bina**
1. **Embed** — 2 line paste karo, jobs unke hi page ke andar, unki CSS inherit
   karke. Form bhi hamara, submit seedha hamare server par — webhook ki zarurat nahi
2. **Hosted page** — `/careers/{key}` — server rendered, Google for Jobs ka
   JSON-LD saath, company ka logo aur colour
3. **Public API** — `GET /careers/{key}/openings`, `/openings/{slug}`,
   `POST /openings/{slug}/apply`. Login ke bahar, throttled

**Career Page screen**
- 2 line ka snippet + Copy button
- Paste hote hi status khud **Connected** ho jaata hai, domain aur views dikhte hain
- Heading, intro, layout, button colour, Clanio credit
- Allowed domains — bharo to sirf wahi site jobs dikha sakti hai

**Spam se bachav:** honeypot field, apply 10/min + 150/din per IP, ek email ek
opening par ek hi baar, resume sirf PDF/DOC 5MB tak

Naye permission `recruitment.view`, `recruitment.manage`, `recruitment.career_page`
— company admin aur HR manager ko mile.

**Test: API 64/64, asli browser me career page + embed 33/33, app screens 36/36.**

### Interview rounds + Jitsi
- `interviews` table — round number, kind (telephonic/technical/managerial/HR/final),
  mode (video/in person/phone), interviewer, time, how long
- **Jitsi link apne aap ban jaata hai** — video round pe `meet.jit.si/clanio-<company>-<ref>-r1-<random>`.
  Koi API key nahi, koi account nahi. Browser me khulta hai
- In person round bina jagah ke nahi banta. Phone round pe link nahi banta
- **Ek interviewer ka same time par doosra round nahi** — clash pakda jaata hai
- Round schedule hote hi application khud `interview` stage me chali jaati hai
- Interviewer ko notification + websocket banner. Candidate ko email joining link ke saath
- Reschedule pe dono ko dobara bataya jaata hai, link wahi rehta hai
- Interviewer ki apni screen — **My Interviews**: kya lena hai, candidate ki detail,
  resume download, join button. Feedback: verdict (selected/hold/rejected), score /5, notes
- Feedback ek hi baar. Feedback aane ke baad round cancel nahi hota
- `interview.conduct` permission — admin, HR, senior manager, manager, TL ko mila

### Candidate ko email
- Apply karte hi **thank you** email, reference number ke saath
- Interview schedule/reschedule pe **joining link wali email**
- `MAIL_MAILER=log` hai, to abhi log file me jaati hai. SMTP daalte hi asli chali jaayegi

### Job feed — Indeed ke liye
`/careers/{key}/feed.xml` — XML feed, poora JD saath. Indeed aur kai board
feed crawl karte hain.

### Offer letter
- `offer_letters` table — number `OL-2026-0001` se sequenced
- Candidate offer stage par ho tabhi letter banta hai. **Ek candidate, ek letter**
- CTC, joining date, designation, reporting to, probation, notice, reply-by date, extra terms
- Letter banate hi application ka `offered_ctc` aur `joining_date` bhar jaata hai
- **Letterhead wala HTML letter** — company ka naam, address, GSTIN, terms table,
  conditions, dono taraf signature block. Preview + download
- Candidate ko email letter ke saath
- Accepted / declined mark karo. **Declined pe candidate khud `dropped` ho jaata hai**
- Answered letter dobara answer nahi hota, wapas bhi nahi khichta
- `recruitment.offer` permission — admin + HR

### Google Form se resume
- Har company ka apna `intake_key` — `POST /api/hrms/intake/{key}`
- Career Page ke response me **poori Apps Script** milti hai jo form me paste karni hai.
  Wo form ke jawab padhkar hamari API par bhej deti hai
- Role title ya uska web address, dono chalte hain. Galat role par saaf message
- Resume ka Google Drive link note me chala jaata hai
- Source `google_form` set hota hai, intake counter chalta hai

### Manager ka vacancy request
Bana hua hai (`POST /openings/request`, `PUT /openings/{id}/decide`) — manager
maange, HR approve/decline kare, tab draft bane. **Par aapne kaha zarurat nahi —
HR seedha opening daal sakta hai.** API pada hai, app me screen nahi banayi.

### Candidate portal → joining → onboarding (15 Sep)

**Candidate ka apna page** — `/track/{token}`, login nahi chahiye, link hi chaabi hai
- Har candidate ka apna 48-char token, per company. Ek banda 2 company me apply kare
  to do alag page, do alag token
- Timeline: Application received → Being screened → Interviews → Offer → Joined
- Apne interview round, time aur **Jitsi join link** dikhte hain
- Offer aaya to poori terms + **I accept / I am not going ahead** button
- Accept karte hi joining date ka **countdown** ("20 days to go")
- Rejected/dropped par saaf likha hota hai ki application band ho gayi
- `noindex` — Google me nahi aata. Galat token 404
- Tracking link teeno email me jaata hai (apply, interview, offer)

**Offer accept hone ke baad company me aana**
- `GET /joinings` — HR ko overdue / this week / later me bata hua list,
  naam, role, joining date, CTC, letter number
- `POST /applications/{id}/convert` — accepted candidate ka **user + employee ban jaata hai**:
  employee code (EMP0007…), joining date offer se, onboarding `in_progress`
- Sirf accepted offer wala convert hota hai. Do baar nahi hota
- Us company me wahi email pehle se ho to saaf mana kar deta hai
- Convert hote hi HR/admin ko **new joining ka notification**, naye employee ko welcome
- Employee ban jaane ke baad **aapka purana onboarding checklist** chalu ho jaata hai
- `employees` list ka cache flush hota hai, to naya banda turant dikhta hai

**Ek email, kai company**
- `users` par `(company_key, email)` unique — ek email 2+ company me chalti hai,
  ek company me duplicate nahi. Candidates par bhi wahi
- Login ab password se khud tay karta hai kaun si company. Do jagah **same password**
  ho to 409 me company ki list aati hai (`company_slug` bhejo)
- Galat password har jagah → 401, aur dono par failed attempt count hota hai

**Saath me theek kiya:** `ApiException` me ab `errors` array jaata hai (409 me
company list bhejne ke liye), aur ₹ ab Indian grouping me — ₹18,50,000, ₹1,850,000 nahi.

### App ke screens (15 Sep, dopahar)

- **Joining Soon** — `/joinings`. Date passed / this week / joined this month ke counter,
  teen group me list (date passed laal border ke saath), naam, designation, joining date,
  CTC, letter number, contact
- **Put on the roll** — usi sheet me: workspace role (zaruri), work email, department,
  designation, reporting manager, branch, team, shift. Dabate hi user + employee ban jaate
  hain, employee code milta hai, onboarding shuru
- **Offer letter** — applicant sheet me. Candidate `offer` stage par ho to "Raise an offer
  letter": CTC, joining date, designation, reporting to, probation, notice, reply-by, extra
  terms. Ban jaane ke baad number, status, download, aur "They accepted" / "They turned it down"
- **Google Form + job feed** — Career Page screen me: poori Apps Script + Copy button,
  kitne log form se aaye, aur Indeed ke liye feed ka link
- **Ek email do company me** — login 409 aane par dono company ke naam **button** ban jaate
  hain, chun lo aur wahi workspace khul jaata hai. `ApiError` me ab `raw` errors aate hain

Sab dashboard tile ke saath: "Joining soon", "Interviews to take", "New applicants",
"Open positions".

---

## Abhi kya pending hai

### A. Backend module

Koi backend module pending nahi. Jo bhi chhod rakha tha (audit log, ticket SLA,
reporting managers, invoices) sab ban gaya. Aage ka kaam sirf section C me hai.

### B. Firebase — push chalane ke liye

Code taiyar hai, bas ye do file chahiye:

1. Firebase project → Android app add karo package **`com.clanio.hrms`**
   → `google-services.json` → `clanio-app/` me rakho
2. Project Settings → Service accounts → Generate private key
   → JSON backend me rakho, phir `.env`:
   ```
   FCM_PROJECT_ID=<firebase project id>
   FCM_CREDENTIALS=<service account json ka poora path>
   ```
3. Push **Expo Go me kaam nahi karta** — `npx expo run:android` se dev build banao

Jab tak ye nahi hai, app crash nahi karegi — token register nahi hoga, chup-chaap skip.

### B2. SMTP — candidate ko asli email jaane ke liye

`MAIL_MAILER=log` hai, to email log file me likhi jaati hai, bheji nahi jaati.
Apne domain ka SMTP ya SendGrid / Amazon SES / Zoho ka detail do, `.env` me
`MAIL_MAILER=smtp` + host, port, username, password. Code taiyar hai — thank-you
email aur interview joining link dono usi waqt chalne lagenge.

**Ye sabse pehle karna hai ab.** Salary transfer ka 6 digit code email par hi
jaata hai — SMTP ke bina code `storage/logs/laravel.log` me girta hai, jahan
sirf server wala dekh sakta hai. Live jaane se pehle SMTP chahiye, warna HR
paisa bhej hi nahi payegi.

### B3. Timezone — ho gaya, per company

DB me har timestamp UTC me hi rehta hai. Company-local rule aur display
`companies.timezone` ke hisaab se chalta hai — teen company teen zone me ho
sakti hain.

`config/app.php` me `'timezone' => 'UTC'` **jaan-boojh kar hardcoded** hai.
`.env` me `APP_TIMEZONE=Asia/Kolkata` padi hai par wo kaam nahi karti — usse
hatane ki zarurat nahi, par config ko env se padhne **mat** lagao. Aisa karte
hi Laravel har naya timestamp IST me likhne lagega aur purane UTC rows ke saath
mila-jula data ho jaayega (attendance, payroll, transfer schedule sab galat).

Backend me `App\Support\CompanyTime`:

```
CompanyTime::zone($co)              company ka IANA zone (galat value par Asia/Kolkata)
CompanyTime::now($co)               ab ka waqt company zone me
CompanyTime::today($co)             company zone ki aaj ki aadhi raat
CompanyTime::date($co)              'Y-m-d' company ke hisaab se
CompanyTime::day($co)               date column se compare karne wala naive midnight
CompanyTime::at($date,$time,$co)    cutoff jaisa waqt company zone me
CompanyTime::parse($naive,$co)      HR ne jo wall-clock daala use company zone me padhta hai
CompanyTime::toZone($moment,$co)    UTC se company zone me dikhane ke liye
```

Company ke id par zone cache hota hai; `Company` save hote hi cache khud saaf
ho jaata hai. Zone ab `timezone` rule se validate hota hai — bakwaas zone save
hi nahi hoga.

Kya theek hua: SOD/EOD cutoff pehle UTC se compare hota tha, is liye IST 4 baje
shaam tak koi report late nahi ginti thi. Interview ka slot wall-clock ke tarah
store ho raha tha; ab sahi UTC instant banta hai aur wapas company zone me
15:30 hi dikhta hai (app, email, candidate portal — teeno jagah zone ka naam
bhi likha aata hai).

App me `clanio-app/lib/clock.ts` — zone `/profile` ke `organisation.timezone`
se aata hai, aur `today()` device ki ghadi nahi, company ki ghadi maanta hai.

Test: `CompanyTime` 25/25, SOD-late + interview slot 19/19, candidate portal
8/8, app clock 18/18, browser (device America/Los_Angeles rakh ke) 18/18,
saare 6 scheduled command clean.

### Onboarding — first login ka pura flow

**HR ka hissa:** naya joiner aaya to HR account banati hai. Create wizard me ab
**father's name aur date of birth mandatory** hain — inke bina employee ban hi
nahi sakta. Baaki wahi — naam, email, temporary password, phone, department,
designation, role, manager, shift, joining date.

**Employee pehli baar login karta hai, teen step aate hain:**

```
1. Terms & Conditions + Privacy Policy     ← rok deta hai, skip nahi
2. Profile form (4 step)                   ← skip kar sakta hai
3. Guided tour (9 stop)                    ← skip kar sakta hai, dobara nahi aayega
4. Tool khul gaya
```

**Step 1** — `policy_gate_enabled` ON karo aur T&C / Privacy Policy ko
"needs acknowledgement" ke saath publish kar do. Jab tak dono accept nahi hoti,
drawer khulta hi nahi. Ek baar accept, `policy_gate_cleared_at` stamp lag gaya,
phir kabhi nahi poochega.

**Step 2** — 4 step: About you → Bank account → Documents → Family.

| Step | Mandatory (bharne par) |
|---|---|
| About you | phone, gender, address, PAN, emergency contact ka naam + phone |
| Bank | holder name, bank, account number, IFSC (format check hota hai) |
| Documents | photo, Aadhaar, PAN — teeno upload |
| Family | naam + relation (nominee 100%) |

Har step par **Skip this step**, aur kabhi bhi **Finish later**. Skip kiya to
rokta nahi — bas app ke top par ek patti aati hai *"Please complete your
profile — 50% done · Bank account, Documents"* (band kar sakte ho), aur
`profile:reminders` command har weekday 11:30 par notification bhejta hai
(ek employee ko 3 din me ek baar se zyada nahi). My Profile par section-wise
tick-list aur **Finish my profile** button hamesha rehta hai.

**Step 3** — 9 stop ka tour, role ke hisaab se: Member ko sirf uske screen
dikhte hain, HR ko Employees aur Openings wale stop extra. "Take me there"
seedha us screen par le jaata hai. **Skip kiya to wapas nahi aata** —
`users.tour_done_at` stamp. My Profile se **Show the tour again** karke
wapas dekh sakte ho.

**Naya:** `database/schema/onboarding_flow.sql` — `employees.father_name`,
`profile_setup_seen_at`, `profile_nudged_at`, `users.tour_done_at`.
Purane users ko backfill me "done" mark kar diya, unko ye flow nahi dikhega.
Super admin ko bhi nahi.

`OnboardingService` decide karta hai kaunsa step baaki hai; `GET /onboarding`
se aata hai aur login response me bhi. Employee apni family/bank/document ab
`profile/*` routes se khud add karta hai — HR ki permission nahi chahiye.

**Do purane bug pakde gaye** — policy gate screen `needs_ack` field par filter
kar rahi thi jo API bhejti hi nahi thi (is liye gate **kabhi chala hi nahi**),
aur accept karte waqt policy ki jagah acknowledgement ka uuid bhej rahi thi.
Dono theek. Ab `/my-policies` policy ka poora text bhi bhejta hai, to employee
T&C app me hi padh sakta hai.

**Test:** API 39/39, browser me pura first-login flow 75/75.

### Payroll — phase 1 aur 2 ban gaye

Poora payroll 4 phase me ban raha hai. Do ho gaye:

```
1. Salary Structure    ✅  74/74 test
2. Payroll Run         ✅  76/76 test
3. Payslip download    ⬜
4. Bank transfer       ⬜
```

**Phase 1 — Salary Structure**

Component master per company. **Kuch auto-seed nahi hota** — HR
`POST /salary-components/standard` se ek click me 11 standard Indian component
bana leta hai, phir naam aur percent apne hisaab se badal sakta hai:

```
Earning    BASIC (50% of gross)  HRA (40% of basic)  CONV 1600  MED 1250
           SPL (balance — jo bacha wo isme)
Deduction  PF  ESI  PT  TDS
Employer   PF_ER  ESI_ER   (net me nahi jaate, cost to company me jaate hain)
```

Structure **effective-dated** hai, is liye "mahine ke hisaab se" chalta hai —
April se 6L, October se 7.8L, to September ki salary purane structure se aur
October ki naye se banti hai. Naya structure banate hi purana apne aap
`effective_to` ke saath band ho jaata hai. Us date par already structure ho to
refuse karta hai.

`SalaryMath` sab hisaab ek jagah karta hai. Company settings me PF/ESI/PT ki
rate editable hai (`pf_wage_ceiling` 15000, `esi_wage_limit` 21000, PT flat).
PF wage ceiling par lagta hai, ESI limit se neeche hi, aur jiska PF account nahi
hai uska PF 0. **TDS ki line hai par khaali** — HR chahe to amount daale.

Guards: Basic ke bina structure nahi banta (PF usi par lagta hai), ek se zyada
"balance" component nahi ho sakta, aur jo component kisi structure me laga hai
wo delete nahi hota. `salary-structures/coverage?month=` batata hai kis-kis ka
structure baaki hai.

**Phase 2 — Payroll Run**

```
Open month  →  Calculate  →  (LOP theek karo)  →  Approve  →  [pay]
   draft       calculated                         approved
```

Ek mahine ka ek hi run. Aane wale mahine ka payroll nahi chalta. Calculate par
har employee ka payslip banta hai — us mahine ka structure **freeze** hokar
`payroll_item_lines` me copy ho jaata hai, to baad me structure badle to purani
payslip nahi badalti.

**LOP HR ke haath me hai** — attendance sirf sujhaav deti hai
(`lop_suggested`, absent + half-day/2). HR `PUT /payslips/{id}/lop` se badal
sakta hai; jo HR ne set kiya wo `lop_locked_by_hr` ho jaata hai aur
**recalculate par nahi udta**. Earning pro-rate hoti hai (paid_days /
working_days), **PF/ESI/PT pro-rate nahi hote**. Payslip par har line ka
"full" aur "actual" dono dikhta hai.

Kisi ek ki salary rokni ho to `hold` (reason ke saath), phir `release`.
Approve ke baad amount lock — LOP change aur recalculate dono 409 dete hain.
Jis run me ek bhi salary ja chuki ho wo cancel nahi hoti.

Employee apni payslip `GET /my-payslips` se dekhta hai (sirf approved ya paid
mahine). Naye permission: `salary_structure.view/manage`,
`salary_component.manage`, `payroll.view/run/approve` — company admin aur
HR manager ko diye.

**Phase 3 — Payslip**

`resources/views/payroll/payslip.blade.php` — company letterhead, do column
(earning / deduction), paid days, net pay, aur **amount in words**
(`Money::inWords` — "Forty Eight Thousand Two Hundred Rupees Only"). LOP hua ho
to har earning ke saath uska full month amount bhi grey me dikhta hai.

`GET /payslips/{id}/preview` browser me kholta hai, `/download` file deta hai
(`Payslip-EMP0001-2026-08.html`). Employee **sirf apni** payslip khol sakta hai,
aur wo bhi approve hone ke baad — dusre ki kholne par 403.

**Phase 4 — Bank transfer**

```
company_bank_accounts   admin ka account jisse paisa jaata hai
salary_disbursements    har transfer ki koshish ka record (UTR, reference, status)
bank_transactions       admin ke account ka statement (debit/credit + running balance)
```

Bank gateway **pluggable** hai — `App\Support\Bank\BankGateway` interface,
abhi `MockBank` laga hai. Asli bank ka API aane par sirf ek naya driver likhna
hoga, baaki payroll ka code waisa hi rahega:

```
BANK_DRIVER=mock
BANK_MOCK_FAIL_IFSC=HDFC0000999    is IFSC par fail hota hai (fail case test karne ko)
BANK_MOCK_PENDING=false            true karo to transfer "with the bank" par rukega
```

Mock me asli paisa kahin nahi jaata — balance hamare hi row me ghatta hai, aur
API response me `is_mock: true` ke saath saaf likha aata hai. Test ke liye
`POST /company-bank-accounts/{id}/top-up` se balance daal sakte ho (sirf mock par).

**Do tarike se salary jaati hai:**

1. **Ek click me poora mahina** — `POST /payroll-runs/{id}/transfer`. Jo fail
   hoti hai wo baaki ko nahi rokti; hold wali chhod deta hai. Response me
   `sent / failed / skipped_on_hold` aur kis-kis ka fail hua uska reason.
2. **HR ek employee par click kare** — pehle `GET /payslips/{id}/transfer-quote`
   se popup ka data (**poora structure**, kis account se jaayega, kis account me
   jaayega, amount, aur `blockers` agar kuch rok raha hai), phir
   `POST /payslips/{id}/transfer`.

**Salary date ka trigger** — `salary:disburse` command roz 9:30 par chalta hai,
approved run jiska `pay_date` aa gaya uski saari salary bhej deta hai.
`--dry-run` se pehle dekh sakte ho kiski jaayegi.

Har transfer par company ka balance ghatta hai aur statement me debit chadhta
hai (narration me employee ka naam, reference ke saath). Employee ko turant
notification jaata hai — gayi ya fail hui. Fail hui salary **retry ho sakti
hai** (IFSC theek karke dobara bhejo). Jab run me kuch pending na bache, run
apne aap `paid` ho jaata hai. Jis account se salary ja chuki ho wo delete nahi
hota.

Naye permission: `company_bank.view/manage`, `salary.disburse` — company admin
ko diye, HR manager ko sirf view.

**Test:** structure 74/74, payroll run 76/76, bank + payslip 98/98 —
**kul 248/248**.

**App ke screens**

| Screen | Kahan | Kya karta hai |
|---|---|---|
| Salary Components | Setup | 11 standard ek click me, phir naam/percent badlo. Har row par likha hai "50% of gross", "40% of Basic", "Whatever is left" |
| Salary structure | Employee ke andar | CTC daalo → **Show me the breakup** → poora breakup dekh kar save. Purana structure apne aap band, history dikhti hai |
| Payroll | Approve section | Mahine ki list, status tag, paid/total ka progress bar. Jinka structure nahi hai unki warning |
| Payroll detail | Payroll par tap | Summary (Approved / Waiting / Stopped bhi), transfer window ki line, **Final approval** block — Ready, Amount, On LOP, "LOP ke chalte ₹X kam ja raha hai", ek click me sabko approve, aur jinke saath kuch karna hai unki list wajah ke saath. Filter chip: Everyone / Waiting / Approved / Paid / Failed / Stopped |
| Payslip sheet | Row par tap | Poora breakup (deduction par `−`, employer share par "(company)"), **Final approval** block (approve / approval wapas / stop ki wajah), **LOP field** attendance ke sujhaav ke saath, transfer route, stop-release, download |
| Schedule sheet | "Transfer ka time set karo" | Date aur time pehle se bhare (pay day + 10:00), weekday likha, Sunday par chetavni, kitni salary kitne ka |
| Code sheet | Transfer ya schedule par | Amount, kis email par code gaya, kitne minute chalega, kitni koshish bachi, "Naya code bhejo", aur "Code kisi ko mat batao" |
| Payroll Settings | Setup | Deduction date (7), transfer ka time (10:00), HR review ka din (25), code maangna on/off, code kahan jaaye, pay date se pehle block, gratuity/encashment toggle, notice basis |
| Full & Final | Approvals | Jinka settlement banna baaki hai unki list (tap karke ban jaata hai), sab settlement, ek click me bulk approve, pending sujhaav ka counter |
| FnF detail | Settlement par tap | Earnings, deductions, **Sujhaav** (Apply / Apply part of it / amount badlo), apni deduction jodo, stop-release, approve, code ke saath transfer, statement download |
| Company Bank | Setup | Account add (IFSC validate hota hai), code kis email par jaaye, balance, test top-up, aur **statement** — har debit narration aur running balance ke saath |
| My Payslips | My Space | Employee apni payslip dekhta aur download karta hai. Employer share uski list me nahi, par ek line me bata diya jaata hai |

**Teen bug pakde gaye aur theek kiye** (browser me chalane par nikle):

1. Payslip list me `run` relation load nahi hota tha — is liye LOP field aur download button dono chhup jaate the
2. `/my-payslips` me `lines` load nahi hote the — employee ki payslip me sirf "Net pay" dikhta tha, breakup gayab
3. Action ke baad `reload()` poora screen blank kar deta tha — `refresh()` par shift kiya, ab content dikhta rehta hai

Saath me run detail ka call halka kiya — `items` dobara nahi bhejta, kyunki payslip ka apna endpoint hai.

**Test:** API 248/248 · browser: components + structure + bank 72/72,
payroll run se salary transfer tak 79/79.

### Full and Final Settlement (17 Sep)

Jab koi chhod ke jaata hai to uska aakhri hisaab. **Jaan-boojh kar chhota
rakha hai** — jo private companies asal me deti hain, bas wahi.

```
fnf_settlements    ek exit ka ek settlement (identity + numbers ka snapshot)
fnf_lines          us settlement ki har line (earning / deduction)
```

FnF me sirf **aakhri mahine ki salary** aati hai, last working day tak ke
working days par pro-rated — bilkul normal payslip jaisi. PF/ESI/PT usi tarah
katte hain. **Gratuity aur leave encashment default OFF hain** (company
settings me toggle hai) kyunki aaj kal private companies ye deti hi nahi.

**Deduction apne aap nahi katti.** Tool notice shortfall aur clearance recovery
ko **sujhaav** banata hai — `source = suggested`, `is_applied = false`,
`amount = 0`, aur `suggested_amount` me poora hisaab. HR jab tak Apply na kare,
net me kuch farak nahi padta. HR chahe to poora amount le, chahe kam kar de —
`suggested_amount` record ke liye bacha rehta hai, aur statement par likha
aata hai ki HR ne kam kiya.

Hisaab ka example — Amit, 6L CTC (gross 50,000 / basic 25,000), LWD 20 Sept,
Sept me 26 working day, 17 kaam kiye:

```
Sept ki salary (17/26)   32,692.30
PF                       −1,800.00
Net                     ₹30,892.30

Sujhaav (lagaye nahi gaye)
  Notice shortfall 11 din    21,153.85    [Apply]
  Laptop wapas nahi aaya     15,000.00    [Apply]
```

Stages: `draft → calculated → approved → settled` (ya `cancelled`). Calculate
dobara chal sakta hai — HR ke Apply/amount ke faisle bach jaate hain, manual
lines bhi. Approve hone ke baad sab lock.

Net minus aa jaye (notice shortfall salary se bada ho) to `payment_status`
**recoverable** ho jaata hai, transfer band, aur `mark-recovered` se HR paisa
aane par band karti hai.

`FnfStatementService` + `resources/views/payroll/fnf.blade.php` — payslip jaisa
statement, jisme "Not deducted" ka alag block hai taaki jo sujhaav waive kiya
wo bhi likha rahe. `preview` aur `download` dono hain.

Paisa usi salary ledger se jaata hai — `salary_disbursements.purpose =
settlement`, company account se debit, statement me "Full and final EMP0002"
ke naam se.

Naye permission: `fnf.view` / `fnf.manage` / `fnf.approve` — company admin aur
HR manager dono ko.

**Test:** API 115/115 (main flow) + 29/29 (recovery wala case) + 34/34
(approval, stop, code) = **178/178**.

### Salary release ka do-step control (17 Sep)

Paise ka mamla hai, is liye do jagah pakka kiya — **kaun approve karta hai**
aur **kab paisa nikal sakta hai.**

**1. Har employee par alag final approval**

`payroll_items.approval_status` (pending / approved) + `approved_at`,
`approved_by`, `fingerprint`. Pehle approval poore run par thi, ab HR **ek-ek
payslip** par approve karti hai — ya ek hi click me sabki:

```
POST /payslips/{id}/approve           ek employee
POST /payslips/{id}/unapprove         galti se ho gayi to wapas
POST /payroll-runs/{id}/approve-items sabki ek saath (uuids do to unhi ki)
GET  /payroll-runs/{id}/approval-review kitne ready, kitne LOP par, kya rok raha hai
```

Approve karne se pehle teen jaanch:

- **Stop wali salary approve nahi hoti.** 500 me se 4 ki rokni ho to unko stop
  karo, baaki bulk approve me apne aap chhoot jaayenge — response me naam aur
  wajah ke saath
- **LOP ka faisla pehle.** Attendance LOP keh rahi hai aur HR ne kuch tay nahi
  kiya to approval rukti hai (`LOP_UNDECIDED`) — 0 rakhna ho to bhi save karna
  padega. LOP save karne par payslip dobara bantii hai, to approve **kati hui
  amount** par hota hai
- **Apni salary** approve kar sakte ho, par **LOP lagi ho to nahi** — wo dusra
  approver hi karega (`SELF_APPROVAL_WITH_LOP`)

Run approve tabhi hoga jab ek bhi employee approval ka intezaar na kar raha ho.
Recalculate ya LOP badalne par approval apne aap hat jaati hai.

**2. Deduction date se pehle paisa nahi**

`companies.salary_pay_day` (7), `salary_pay_time` (10:00), `payroll_review_day`
(25), `transfer_early_block`. `TransferWindow` in dono se transfer ka window
banata hai; window se pehle transfer **band** — response me saaf date-time.
Chhod ne ka haq alag permission me hai: `salary.disburse_early` (sirf company
admin).

Company ka 7 Sunday pade to HR date badal sakti hai:

```
GET    /payroll-runs/{id}/schedule   default date + time, weekday, is_sunday
POST   /payroll-runs/{id}/schedule   date + time + note
DELETE /payroll-runs/{id}/schedule   hata do
```

Schedule lag jaane par `salary:disburse` cron usi time ka intezaar karta hai —
cron ab **har 15 minute** chalta hai (pehle roz 9:30) taaki 10:00 ka time sahi
pakde.

**3. Bhejne se pehle code (2-step)**

`transfer_verifications` table. Transfer ya schedule ka pehla call paisa nahi
bhejta — ek 6 digit ka code email par bhejta hai aur `202` ke saath
verification uuid deta hai. Dusre call me `verification_uuid` + `code` jaate
hain, tab paisa chalta hai.

```
transfer_otp_enabled   on/off
transfer_otp_to        admin  → jiske paas salary.disburse hai, requester ke alawa
                       account → company bank account ka contact_email
```

Code kabhi API response me nahi aata — sirf email me. Sath hi:

- hash karke rakha jaata hai, 10 minute chalta hai, **ek hi baar**
- 5 galat koshish ke baad request band
- code maangne ke baad amount ya headcount badal jaye to code mar jaata hai
  (`VERIFICATION_STALE`) — dobara maango
- HR ne trigger kiya aur code admin ke paas gaya, to do log lagenge — yahi
  "galti se trigger" ka bachaav hai

**4. Amount ki seal**

Approve karte waqt `SalarySeal` payslip ke numbers aur lines ka sha256 banata
hai (`fingerprint`). Transfer se pehle dobara banake milaya jaata hai — DB me
seedha amount badal diya jaye to transfer rukta hai: "Approval ke baad amount
badal gaya hai — dobara approve karna padega." FnF settlement par bhi wahi.

**5. Double-spend**

`push()` ab transaction ke andar payslip ko `lockForUpdate` karke payment aur
approval status dobara padhta hai. Do request ek saath aayein to doosri
`ALREADY_IN_FLIGHT` par ruk jaati hai. Transfer routes par apna throttle hai
(`throttle:transfer` — 30/minute, 300/hour).

FnF par bhi wahi teen cheezein lagi hain — bulk approve, stop/release, aur
transfer par code + seal. Farak sirf date ka hai: settlement ek baar ka kaam
hai, uska koi monthly window nahi.

Naya permission: `salary.disburse_early`.

**Test:** API 94/94 (approval + code) + 41/41 (schedule, window, seal,
tampering) = **135/135**.

### Salary Advance (17 Sep)

Employee paisa maange, HR de, aur payroll khud kaat le — bina kisi ko yaad
rakhe.

```
salary_advances             ek employee ka ek chalta hua advance
salary_advance_recoveries   har mahine ki EMI ka record
```

```
Employee request  →  HR approve  →  HR "Transfer" dabaye  →  paisa account me
                                        ↓
                          har mahine payslip par EMI katti hai
                                        ↓
                          outstanding 0 hote hi apne aap CLOSED
```

Transfer **apne aap nahi hota** — HR ko button dabana padta hai, aur usi 6 digit
code + seal se guzarna padta hai jo salary aur FnF par lagta hai. Paisa usi
salary ledger se jaata hai (`purpose = advance`), company statement me dikhta hai.

**EMI HR ke haath me hai.** Employee kitne mahine chahta hai wo bata deta hai,
par asli EMI HR set karti hai — transfer se pehle bhi, beech me bhi. EMI badlo
to tenure apne aap recalculate hota hai. Outstanding se badi EMI refuse hoti hai.

Hisaab — 50,000 gross, 50,000 advance, 10,000 EMI:

```
Gross                50,000.00
PF                   −1,800.00
Advance recovery    −10,000.00
                    -----------
Net                 ₹38,200.00      (baaki 40,000 · 4 kist)
```

**PF advance se nahi badalta** — wo basic par lagta hai. Gross → saari deduction
(PF + PT + TDS + advance) → net. Isliye paanchon mahine PF wahi rehta hai.

Guards: ek waqt me ek hi advance · max 2x monthly gross (company setting) ·
max 12 mahine · structure na ho to limit nikal hi nahi sakte · byaaj nahi ·
EMI kat chuki ho to cancel nahi hota · **recalculate par EMI do baar nahi katti**
(run ki rows delete karke dobara likhi jaati hain) · run cancel ho to EMI wapas.

**Exit par** — outstanding FnF me `suggested` line ban jaati hai, bilkul notice
shortfall jaisi. HR Apply kare tabhi katti hai, chahe kam kare, chahe waive.

Naye permission: `advance.view` / `advance.approve` / `advance.manage` —
admin aur HR ko, `advance.view` finance ko bhi.

**Test:** API 22/22 + end-to-end 22/22 (code, galat code, transfer, payslip,
double-deduct guard) = **44/44**.

### TDS — new regime ka hisaab (17 Sep)

Pehle TDS ki line khaali thi, HR khud amount daalti thi. Ab `TaxMath` hisaab
karta hai:

```
Taxable earning × 12
  − standard deduction 75,000
  = net taxable
  → slab (0/5/10/15/20/25/30)
  − 87A rebate (12L tak pura maaf, marginal relief ke saath)
  + 4% cess
  = saal ka tax

monthly TDS = (saal ka tax − ab tak kata) ÷ FY me bache mahine
```

Sirf `is_taxable` earning ginte hain, isliye exempt component (jaise medical
insurance) bahar rehta hai. Pichhle mahinon ka kata hua wahi ginte hain jo
approve ya paid ho chuke hain — isliye October me structure badle to baaki saal
me apne aap adjust ho jaata hai.

Checked: 6L → 0 · 12L → 0 · 16L → 1,13,100 · 25L → 3,19,800.

**Old regime nahi hai** — 80C/80D/HRA exemption, investment declaration, proof
upload, Form 16, 24Q kuch nahi. Chahiye to HR payslip par amount overwrite kare.

### Employee ke andar month-wise payroll (17 Sep)

`GET /employees/{employee}/payroll?month=` — mahine ki chip chuno aur us mahine
ka net, gross, paid days, **PF (employee + employer), ESI, PT, TDS, advance EMI**
aur poori line list ek screen me. HR ko payroll run kholne ki zarurat nahi.

### C. Jaan-boojh kar last ke liye

```
Dashboard / Reports           HTML letter templates
```

Baaki sab ban gaya — payroll, FnF, LOP, statutory, onboarding flow, advance, TDS.

### D. Hata diye — inpe kaam nahi karna

```
Travel                Timesheet / Project
Insurance claim       Training / LMS
Loan (byaaj wala)     Old tax regime
```

Insurance ka sirf **record** rakha hai — insurer, policy number, validity
employee par; `is_insured` flag har family member par. Claim humare yahan se
nahi hota.

---

## Nayi company banne par kya milta hai

| Kya | Milta hai |
|---|---|
| Roles | **sirf Company Admin** |
| Leave types | 6 (CL, SL, EL, ML, PL, LWP) |
| Ticket categories | 11 + routes + SLA |
| Company modules | 28, sab ON |
| Departments, designations, shifts, branches | **kuch nahi** |
| Clearance items | **kuch nahi** |
| Salary components | **kuch nahi** — `POST /salary-components/standard` se 11 ek click me |
| Deduction date / time | 7 tarikh, 10:00 (Payroll Settings me badlo) |
| HR review ka din | 25 |
| Transfer par code | ON, admin ke email par |
| Pay date se pehle transfer | band (`salary.disburse_early` wale ke liye khula) |
| Gratuity, leave encashment | dono OFF |

Naye admin ko ye order follow karna padta hai — app ka **Setup checklist**
dashboard par yahi guide karta hai:

```
1. Role banao (Manager / TL / Member)
2. Department
3. Designation
4. Work shift
5. Tab employee add karo
```

Aapka faisla: default role seed **nahi** karna. Admin khud banayega.

---

## App chalane ke liye

```
cd backend      php artisan serve --host=0.0.0.0 --port=8001
cd backend      php artisan reverb:start --host=0.0.0.0 --port=8080
cd clanio-app   npx expo start --clear
```

Reverb ke bina app chalti hai, bas realtime banner nahi aayega.

`php artisan serve` single-threaded hai — dev me parallel calls dheeri lagti
hain. `PHP_CLI_SERVER_WORKERS=10` lagane se theek ho jaata hai.

---

## Test ka haal

| Kya | Result |
|---|---|
| Har module ka chain (attendance, task, SOD/EOD, leave, expense, regularization, asset, ticket, goal, appraisal, recognition, exit, clearance, policy) | pass |
| Company onboarding end to end | 46 check |
| Tech team scenario (Manager → TL → 2 dev) | 32 check |
| Super admin scenario | 18 check |
| Data import | 14/14 |
| Audit log, ticket SLA, manager dropdown | API 29/29, app 33/33 |
| Invoices (plan kharidna → invoice → paid/cancel → download) | API 40/40 |
| Recruitment API | 64/64 |
| Career page + embed asli browser me | 33/33 |
| Recruitment app screens | 36/36 |
| Interviews + Jitsi API | 47/47 |
| Interviews app (HR schedule → interviewer feedback → HR reads it) | 54/54 |
| Offer letter + Google Form intake + vacancy request (API) | 58/58 |
| Candidate portal → accept → joining → onboarding (API + portal page) | 51/51 |
| App: offer letter, Google Form, joining pipeline, put on the roll | 51/51 |
| App: ek email do company me login | 6/6 |
| File download | 7/7 |
| Per-company timezone | API 25/25 + 19/19 + 21/21 + 18/18 |
| Onboarding first-login flow | API 39/39, browser 75/75 |
| Payroll (structure, run, payslip, bank) | API 248/248, browser 72/72 + 79/79 |
| FnF settlement | API 115/115 + 29/29 (recovery) |
| Salary approval + 2-step code + schedule | API 94/94 + 41/41, FnF 34/34 |
| Approval flow browser me (settings → stop → bulk approve → schedule → code → paisa) | 91/91 |
| Salary advance (request → approve → code → transfer → EMI → close) | API 22/22 + e2e 22/22 |
| TDS new regime (6L, 12L, 16L, 25L) | verified |
| Saare 7 role ka scope aur permission | verified |
| App browser me — har role login karke | 0 JS error |

**Abhi tak asli phone par nahi chali.** Native me `expo-secure-store`,
file picker, share sheet, drawer gesture, safe area — sab alag hain.
Sabse pehle wahi test karna.
