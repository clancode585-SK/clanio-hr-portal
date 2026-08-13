# Clanio HRMS — Project Notes

Multi-tenant HRMS. Laravel 12 + PHP 8 + MySQL (XAMPP) backend, Next.js 16 frontend.
Ye file poore kaam ka record hai — kya bana, kyun bana, kaise chalana hai.

Last updated: 05 August 2026

---

## Ek nazar mein

| | |
|---|---|
| Backend | `backend/` — Laravel 12, raw SQL schema (koi migration nahi) |
| Frontend | `frontend/` — Next.js 16, Tailwind v4, TypeScript |
| API routes | **273 endpoints** under `/api/hrms` |
| Tests | **1394 checks passing** across 15 suites |
| Modules built | 17 (Auth se Permission Management tak) |
| Frontend built | Login page + auth integration + dashboard placeholder |

---

## Kaise chalayein

```bash
# 1. Apache + MySQL — XAMPP se start karo

# 2. Backend (port 8000)
cd backend
php artisan serve --port=8000

# 3. Frontend (port 3000)
cd frontend
npm run dev

# 4. Realtime chahiye to (optional)
cd backend
php artisan reverb:start --host=127.0.0.1 --port=8080

# 5. Scheduled jobs chahiye to (optional)
php artisan schedule:run     # har minute chalna chahiye
```

Frontend `localhost:3000/login` par khulega, backend ko `localhost:8000/api/hrms` par call karega
(`frontend/.env` me set hai).

### Test credentials

| Email | Password | Role |
|---|---|---|
| `superadmin@clanio.com` | `Super@2026` | Super Admin (platform) |
| `rohit@acme.com` | `Acme@2026` | Company Admin |
| `priya@acme.com` | `Priya@2026` | HR Manager |
| `amit@acme.com` | `Amit@2026` | Team Lead |
| `neha@acme.com` | `Neha@2026` | Employee |
| `temp@acme.com` | `Temp@2026` | Employee (self scope) |

Dhyan rakhna: login par **rate limit 5 per minute** hai, aur **5 galat password** par account
15 minute ke liye lock ho jata hai.

Super admin ka `company_id` NULL hai — company-wale API call karne ke liye `X-Company-Id` header
bhejna padta hai. Testing ke liye `rohit@acme.com` behtar hai.

---

## Backend — kya bana hai

### 1. Auth & Platform
Custom bearer token guard (`ApiTokenGuard`), SHA-256 hashed tokens, 7 din ki lifetime.
Login, logout, forgot/reset/change password, account lock after 5 failed attempts.
Roles, permissions (63 total), users, profile.

### 2. Organisation
Companies, Company Settings, Branches, Departments, Teams, Designations.
Company banate hi admin user + admin role + default leave types apne aap ban jaate hain.

### 3. People
Employees, Employee Family (nominee share validation), Employee Bank Accounts (IFSC validation),
Employee Documents (private disk, verify workflow, expiry alerts).

### 4. Time & Attendance
Work Shifts, Holidays (company + branch wise, bulk create), Attendance (check-in/out, calendar),
**Attendance Regularization** (punch bhoolne par correction — manager approve karta hai).

### 5. Leave
Leave Types (per company configurable), Leave Balances (accrual, carry forward, encashment),
Leave Requests (apply, approve, team calendar). Approved leave par attendance apne aap
`on_leave` ho jati hai.

### 6. Work
Tasks (assign, status transition matrix, comments, subtask 1-level, attachments, activity history),
SOD / EOD daily reports (EOD ke ghante task ke `spent_hours` me jud jaate hain),
Work Record (employee ka performance record + team comparison + score).

### 7. Expense Reimbursement
Employee apply → Manager approve → HR verify → Payment.
9 category + "Other" (purpose mandatory), bill upload, bulk pay, payout queue.

### 8. Exit & Clearance
Employee resignation dalta hai → manager approve → HR final approval.
HR approve karte hi last working date **notice period se apne aap ban jati hai**
(`companies.notice_period_days`, default 30) — HR chahe to manually badal sakti hai.
LWD nikalte hi scheduled job `users.status = inactive` kar deta hai, token revoke,
`employees.employment_status = exited`. Reject aur withdraw dono chalte hain.
HR experience letter / relieving letter / LOR upload karti hai.

**Clearance checklist:** HR final approval par 4 department (IT / Finance / HR / Manager) ka
checklist apne aap ban jata hai (`clearance_items` master se copy). Har item `pending` →
`cleared` / `blocked` / `not_applicable`. Recoverable item par amount likh sakte ho
(laptop damage waghera) — total nikal aata hai, **par kaatega payroll wala FnF, wo last me hai**.
Manager sirf apne `manager` wale item sign kar sakta hai, `clearance.sign` wala sab.

Gate teen jagah lagta hai:
- **Exit complete** — koi mandatory item pending ho to `409 CLEARANCE_PENDING`.
  `clearance.manage` wala `force: true` + `force_reason` se bypass kar sakta hai (record ho jata hai).
- **Relieving letter** — clearance pending me issue hi nahi hota. Experience letter aur LOR chalte hain.
- **Scheduled job** — LWD nikal jaye to login phir bhi band hoga, chahe clearance pending ho
  (jaisa real companies me hota hai — paperwork alag, access alag).

### 9. Performance
Score **Work Record se banta hai** — SOD/EOD compliance + task on-time %, minus penalty
(overdue, absent, missed report). Weights company set karti hai (`companies.perf_*`,
default 50/50). Har mahine ka score `performance_scores` me **freeze** hota hai,
uske baad wo number nahi badalta. Trend, leaderboard, rank.

**Goals — teen shape, ek hi table** (`performance_goals`, `parent_id` se hierarchy):
| `goal_type` | Kya | Progress kahan se |
|---|---|---|
| `kra` | Standalone target | target vs achieved, ya linked tasks |
| `objective` | OKR ka O | apne key results ka weighted average |
| `key_result` | OKR ka KR | target vs achieved, ya linked tasks |

Task link kar do to progress **apne aap** update hota hai — task done hote hi
`TaskService::changeStatus` se `GoalService::recalculateForTask` chalta hai.
Top-level weight ka total 100 se zyada nahi ho sakta.

**Appraisal cycle:** HR cycle banati hai → launch par sabke appraisal ban jate hain aur
us period ka **auto score + goal achievement apne aap bhar jata hai** → employee self review
→ manager review → HR final rating. Cycle sirf aage badhti hai, peeche nahi.
Rating scale configurable (default 1-5).

### 10. IT Assets
Asset master (`AST0001` auto code, 10 category, serial number unique) → allocate to employee
→ return (condition + recovery amount) → retire / lost. Poori allocation history rehti hai.

**Asset Request** — employee khud raise karta hai:
| Type | Kab |
|---|---|
| `repair` | Asset me issue hai |
| `new` | Naya asset chahiye (category chunni padti hai) |
| `replacement` | Theek nahi ho raha, badal do |
| `return` | Zarurat nahi, wapas le lo |

Flow: `pending` → IT approve → `in_progress` → `resolved`. Repair start hote hi asset
`in_repair` ho jata hai, resolve par wapas `allocated`/`available`.
Ek asset par ek hi open request, aur sirf apne allocated asset par request daal sakte ho.

**Clearance se link:** exit ke waqt jitne asset allocated hain, unka "wapas karo" item
apne aap clearance me aa jata hai (`exit_clearances.asset_allocation_id`). Asset return
karte hi wo item **auto cleared** ho jata hai aur recovery amount clearance me chala jata hai.

### 11. Compliance & Policy
HR policy banati hai (text likhe **ya** PDF upload kare) → publish → har active employee ke liye
`policy_acknowledgements` me pending row ban jati hai + notification jata hai. Employee accept
kare to **timestamp + IP** save hota hai — audit me yahi proof kaam aata hai.

**First-login gate** (`companies.policy_gate_enabled`, admin Company Settings se on/off karta hai):
- **Naya employee** — jab tak saari policies accept na kare, har API `403 POLICY_ACCEPTANCE_PENDING`.
  Sirf profile · my-policies · acknowledge · download · notifications khulte hain.
  Sab accept karte hi `employees.policy_gate_cleared_at` set ho jata hai — phir kabhi block nahi hoga.
- **Purana employee** — nayi policy aane par sirf notification, **kaam nahi rukta**.
- `policy.manage` walon par gate nahi lagta, warna naya HR khud phas jata aur publish hi na kar pata.
- Login response me `policy_gate: {blocked, pending}` aata hai taaki frontend seedha policy screen kholе.

**Version:** same title ka naya version publish karte hi purana apne aap archive ho jata hai aur
sabko dobara accept karna padta hai. Purane version ke acknowledgements history me rehte hain.

**Profile completion %** — `GET /profile/completion`, 5 section weighted:
Personal 20 · Bank 15 · Documents 20 · Family 15 · **Policies 30**.

**Exit se link:** exit ke waqt policy pending ho to clearance me HR ka ek item apne aap aa jata hai
(`exit_clearances.source = 'policy'`), aur saari policies accept hote hi wo **auto clear** ho jata hai.

### 12. Permission Management
Teen level ka model — har level upar wale ki ceiling ke andar rehta hai:

```
Super Admin  →  company ke liye module on/off (company_modules)
                 OKR nahi chahiye? band. Us company me kisi ko bhi
                 performance.* permission nahi milegi, admin ko bhi nahi
                      ▼
Role         →  default permission (HR role me 12, Team Lead me 6)
                 role me add kiya = us role ke sabko turant mil gaya
                      ▼
Per user     →  admin kisi ek employee par grant / revoke kar sakta hai
                 role wahi rehta hai, sirf us bande ka farq padta hai
```

**Formula:** `effective = role wali (live) + grant − revoke`, phir disabled module hata do.
Sab `User::permissionSlugs()` me hai, per-user cached.

| Admin kya chahta hai | Kahan jayega |
|---|---|
| Teeno HR ko payroll | HR **role** me add |
| Sirf Priya ko payroll | Priya ki **profile** par grant |
| Sneha se expense hatana | Sneha ki **profile** par revoke |
| Kisi aur ko permission dene ka haq | `user.permission` de do |

**Guards:** jo permission khud ke paas nahi wo kisi ko de nahi sakte (`PERMISSION_ESCALATION`) ·
super admin ki permission koi nahi chhoo sakta · apni company ke andar hi ·
`user.permission` khud se nahi hata sakte (`PERMISSION_SELF_LOCK`).

`GET /permissions/tree` module-wise checkbox list deta hai — har permission par `can_assign`
flag hai (jo aap de sakte ho), aur har module par `is_enabled`.

Super admin module band kare to **pura cache flush** hota hai (`Cache::flush()`), kyunki
TenantCache apne hi tenant ka scope rakhti hai aur wo doosri company ka data badal raha hota hai.

### 13. Realtime & Notifications
In-app inbox, preferences, announcements, Laravel Reverb websocket, FCM push.

### 14. Scheduled Jobs (11)
| Kab | Command | Kaam |
|---|---|---|
| Roz 00:30 | `exits:process` | LWD nikal chuke employees ka login band |
| 1 tarikh 01:00 | `performance:snapshot` | Pichle mahine ka score save + freeze |
| Roz 09:00 | `work:reminders --type=tasks` | Kal due + overdue task |
| 11:00 Mon–Fri | `work:reminders --type=sod` | SOD nahi bhara |
| 20:00 Mon–Fri | `work:reminders --type=eod` | EOD nahi bhara |
| Roz 23:55 | `attendance:auto-checkout` | Aaj ki khuli punch band |
| Roz 06:00 | `attendance:auto-checkout --stale-only` | Pichle dino ki bhooli punch |
| Roz 10:00 | `documents:expiry-alerts` | 30/15/7/1 din pehle |
| Monday 10:30 | `policy:reminders` | Pending policy acceptance ka reminder |
| 1 tarikh 02:00 | `leave:accrue` | Monthly accrual (idempotent) |
| 1 Jan 03:00 | `leave:accrue --carry-forward` | Pichle saal ka balance aage |

---

## Architecture — zaroori baatein

### Multi-tenancy
`CompanyScope` global scope + `TenantContext`. Har query apne aap company se filter hoti hai.
Super admin `X-Company-Id` header se kisi bhi company me ja sakta hai.

### Data scope
`App\Support\DataScope` — `all_company` / `branch` / `department` / `team` / `self`.
`user.view_all` permission scope ko bypass karti hai.

### Delete = `is_active 0` — soft delete hata diya
Poore backend me `SoftDeletes` / `deleted_at` nikal diya hai. Ab har delete-able table par
`is_active TINYINT(1) NOT NULL DEFAULT 1` hai:

- **Delete API** row hataati nahi — sirf `is_active = 0` kar deti hai. Data DB me apne
  `id` ke against pada rehta hai.
- `App\Support\Scopes\ActiveScope` global scope har query me `is_active = 1` lagata hai,
  isliye list / show / route binding me inactive row aati hi nahi (show par 404).
- `App\Support\Concerns\HasActiveState` trait me `deactivate()`, `activate()`,
  `withInactive()`, `onlyInactive()` hain. 22 model is trait ko use karte hain.
- Employee delete par uske family aur bank rows bhi `is_active = 0` ho jate hain.
- `notifications`, `leave_balances`, `daily_report_items`, `password_reset_tokens` —
  in par `is_active` nahi hai, inka delete aaj bhi hard delete hai.
- Schema change: `database/schema/is_active_alter.sql` (column add + backfill +
  `deleted_at` drop + `shift_key` / `holiday_key` / `type_key` / `day_key` ab `is_active`
  par bane hain).

Abhi baaki: inactive row wapas active karne ka koi API nahi hai (`withInactive()` sirf code
me hai), aur employee delete karne par uska `users` row `active` hi rehta hai — wo login
kar sakta hai.

**`is_active` aur `employment_status` alag cheezein hain — mix mat karna:**

| | Matlab | Kaun set karta hai |
|---|---|---|
| `is_active = 0` | "Galti se bana tha, hata do" — kisi ko nahi dikhta, admin ko bhi nahi | Delete API |
| `employment_status = 'exited'` | "Sahi me kaam kiya, ab company me nahi hai" — default list se hat jata hai par HR/Admin `?employment_status=exited` se pura record dekh sakte hain | Exit module |

### Raw SQL schema — koi migration nahi
Saare table `backend/database/schema/*.sql` me hain. Chalane ka tareeka:
```bash
/c/xampp/mysql/bin/mysql -u root clanio < database/schema/expense_schema.sql
```

Files: `hrms_schema.sql`, `attendance_schema.sql`, `leave_schema.sql`, `notification_schema.sql`,
`profile_schema.sql`, `regularization_schema.sql`, `task_schema.sql`, `work_record_schema.sql`,
`work_schedule_schema.sql`, `expense_schema.sql`

### MySQL generated columns — business rules DB level par
PHP me check karne ke bajaye DB me hi enforce kiya hai:

| Column | Table | Kaam |
|---|---|---|
| `day_key` | `attendance_regularizations` | Ek din ki ek hi pending/approved request (`is_active = 1` par) |
| `open_key` / `is_open` | `attendances` | Ek time par ek hi khuli punch |
| `payable_amount` | `expense_claims` | `IFNULL(approved_amount, amount)` |
| `dedupe_slot` | `notifications` | Duplicate notification block |
| `token_hash` | `api_tokens` | Token lookup |

### Realtime
`ShouldBroadcastNow` use kiya hai — queue worker ki zarurat nahi (XAMPP par convenient).
Trade-off: broadcast HTTP request ke andar hi hota hai. Isliye
`config/broadcasting.php` me `connect_timeout: 0.3`, `timeout: 1.5` set kiya hai —
Reverb band ho to API ~1s me chalti rahegi, atkegi nahi.

### Cache
`TenantCache` — version counter based invalidation. Key badalne par purana data apne aap invalid.

---

## Test suites

Scratchpad me PHP scripts hain (curl se real HTTP calls karte hain, mock nahi):

| Suite | Checks |
|---|---|
| test_attendance | 53 |
| test_leave | 112 |
| test_profile | 89 |
| test_schedule | 67 |
| test_task | 161 |
| test_realtime | 83 |
| test_regularization | 87 |
| test_workrecord | 91 |
| test_fixes | 53 |
| test_expense | 115 |
| test_exit | 113 |
| test_performance | 114 |
| test_asset | 106 |
| test_policy | 96 |
| test_permission | 54 |
| **Total** | **1394** |

`test_employee.php` aur `test_visibility.php` bootstrap/fixture scripts hain — regression me
nahi chalane chahiye (wo company aur org data create karte hain).

**Test pollution ka dhyan rakhna:** har suite ke top par reset block hai
(`DELETE FROM holidays`, shift reset, attendance cleanup). Ye isliye hai ki suites
ek doosre ka data kharab na karein — order kuch bhi ho, sab green rahein.

---

## Frontend — kya bana hai

```
frontend/
  .env                    NEXT_PUBLIC_API_URL=http://localhost:8000/api/hrms
  lib/config.ts           env values
  lib/api.ts              fetch wrapper + ApiError (status, error_code, field errors)
  lib/auth.ts             login() / logout()
  lib/session.ts          token+role store, formatRole()
  lib/theme.ts            light/dark + bootstrap script
  components/
    login-form.tsx        email, password (eye toggle), remember me
    brand-panel.tsx       left side — heading + 3 points
    theme-toggle.tsx      Light / Dark
    icons.tsx             inline SVG set (koi icon library nahi)
  app/
    page.tsx              redirect → /login ya /dashboard
    login/page.tsx        split layout
    dashboard/page.tsx    "Welcome {Role}" + sign out
```

**Theme:** `data-theme` attribute `<html>` par. `<head>` me inline script se apply hota hai
isliye page load par **flash nahi hota** (Next 16 ka official pattern —
`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`).

**Remember me:** on → `localStorage`, off → `sessionStorage`.

**CORS:** Laravel 12 ka default `HandleCors` chal raha hai (`config/cors.php` publish nahi kiya).
`api/*` path par `Access-Control-Allow-Origin: *` aata hai — preflight verify kiya hua hai.

### Frontend me abhi kya nahi bana
App shell (sidebar + topbar), koi bhi module page, aur baaki 174 endpoints ka integration.

---

## Design approval pack

`C:\Users\ICG-21\Downloads\CLANIO-UI-Design\` — static HTML prototype, approval ke liye.
70 screens, 5 role panel (Super Admin / Admin / HR / Manager / Employee), light + dark,
responsive. Koi API call nahi, saara data dummy.

`index.html` browser me kholo. Iske tokens frontend ke `globals.css` se match karte hain,
taaki approve hone ke baad copy-paste ho jaye.

---

## Business decisions (discussion se tay hue)

### LOP — attendance se auto nahi katega
Attendance sirf **suggest** karega, HR **approve** karegi tabhi payroll chalega.
Teen bucket: punch hi nahi (LOP) · in hai out nahi (LOP nahi) · kam ghante (half day).
Sheet month end se 10 din pehle khulegi. HR set karegi ki kitne missed punch = 1 LOP.
Approve ke baad number freeze — correction agle mahine arrear se.
**Jab tak HR approve na kare, payroll run start hi nahi hoga.**

Wajah: "attendance ke through employees ko track nahi kar sakte, aisa wrong hai jyada strict ban jayega."

### Expense Reimbursement — koi fixed amount nahi
Employee khud amount daalta hai, koi category-wise limit nahi.
Ek hi table (`expense_claims` + `expense_bills`) — category master table nahi banaya.
"Other" chunne par **purpose mandatory** (jaise "Laptop repair karaya").
Bill upload optional, last me.
HR amount **kam** kar sakti hai par remarks dena zaroori — claim se **zyada** nahi kar sakti.

### Packages (discussion — abhi implement nahi hua)
Flat monthly price, per-employee nahi:

| Package | Price | Employee logins | Modules |
|---|---|---|---|
| Basic | ₹1,499/m | 5 | Core HR, Attendance, Leave, Documents |
| Premium | ₹2,999/m | 10 | + Task Manager, Reimbursement, Payroll, LOP |
| Advance | ₹6,999/m | Unlimited | Sab kuch — Recruitment, Performance, Assets, AI |

Backend ko: plan ke module flags company row par save honge, band module ke API
`403 PLAN_MODULE_LOCKED` denge, sidebar se wo item gayab, login limit cross par
employee create block + upgrade prompt.

---

## Gotchas — jo problem aayi aur kaise theek hui

| Problem | Wajah / Fix |
|---|---|
| Reverb commands nahi mile | `composer require --no-scripts` ne package discovery skip kar di → `php artisan package:discover` |
| Broadcast me 4.7s lag | Reverb band tha aur timeout bada tha → `config/broadcasting.php` me `connect_timeout: 0.3`, `timeout: 1.5` |
| `daysLeft()` 500 error | Carbon 3 me `diffInDays(..., false)` float deta hai, method `?int` tha → `(int) round(...)` |
| `alert()` fatal error | `Illuminate\Console\Command::alert()` se clash → method ka naam `notifyExpiry()` kiya |
| Manager apne direct report ko task assign nahi kar pa raha tha | `assignee()` sirf `User::visibleTo()` dekh raha tha → `directReport()` add kiya + `Task::visibleTo` me `reporting_manager_id` check |
| Test suites ek doosre ka data kharab kar rahe the | Har suite ke reset block me holidays delete + shift reset add kiya |
| `?? 'x'` sentinel se test hamesha pass | `??` null value ko "absent" maanta hai — sentinel hata diye |
| Leave test date-dependent flake | `+40 day` Sunday par aa gaya tha → Sunday skip karne ka loop add kiya |

---

## Abhi kya pending hai

**Backend ke chhote kaam**
- Postman collection update (~60 endpoint missing hain)
- Email notification channel (flag hai, bhejne ka code nahi)
- Audit log read API (data ban raha hai, sirf task ka read endpoint hai)
- Refresh token + logout all devices
- Geo-fence validation (lat/long save hota hai, check nahi hota)
- HR bulk attendance marking
- Experience letter system se generate (abhi HR khud upload karti hai)
- Clearance ka recoverable amount abhi sirf store hota hai — kaatega FnF, wo payroll ke saath last me

**Naye module (priority order — Payroll / Dashboard / Recruitment sabse last me rakhe hain)**
1. **Billing & Plans** — package flags, `PLAN_MODULE_LOCKED`, login limit
2. **OKR extension** — period cascade (quarter → month → week) + OKR ka weight score me +
   appreciation/recognition. Schema (`performance_goals.period_type`, `recognitions`) ban chuka hai, code nahi
3. **Helpdesk / Ticket** — employee query, SLA
4. **Org Chart** — data hai, sirf API
5. **Travel & Advance** — sirf tab jab company travel-heavy ho
6. **Sabse last:** Reports/Dashboard · Recruitment/Job · LOP → Payroll → Statutory → FnF

**Ye do module nahi banenge (tay ho gaya)**
- **Insurance** — claim humare yahan se nahi hoga. Sirf record rakhna hai ki family me kaun
  cover hai — uske liye pura module nahi chahiye, `employee_family_members` me
  `is_insured` flag aur employee par policy number / insurer, bas itna kaafi hai.
- **Training / LMS** — companies iske liye alag product leti hain, HRMS ka LMS use hi nahi hota.

**Frontend**
- App shell (sidebar + topbar + protected layout)
- Employees module (base — iske bina baaki ka matlab nahi)
- Phir Attendance → Leave → Task → Reimbursement

---

## Coding conventions (in par chalte rehna)

- Raw SQL schema files — **koi migration nahi**
- Code me **comment nahi** likhte
- Artisan commands sirf tab jab bola jaye
- Service layer me business logic, controller patla
- `ApiException` throw karo with message + status + error code
- Error messages Hinglish me (user-facing), code English me
- Response envelope: `{ success, status, message, data }` · error me `error_code` bhi
- Filters `applyFilters()` se, pagination `ApiResponse::paginated()` se
