# Clanio HRMS — Backend Status

**Last session: 18 August 2026**

Poora detail `../PROJECT-NOTES.md` me hai. Ye file sirf ye batati hai ki
**abhi kahan ruke hain aur aage kya karna hai.**

---

## Ek nazar mein

| | |
|---|---|
| Modules | **20** |
| API endpoints | **314** under `/api/hrms` |
| Services | 41 |
| Schema files | 21 (raw SQL, koi migration nahi) |
| Scheduled commands | 8 |
| Test suites | 17 — sab green |
| Frontend | sirf Login page |

---

## Pichli baar kya bana

### 19. Org Chart

Company → Branch → Department → Team → Employee ka dynamic tree, DB se banta hai.

```
GET /org-chart
    ?depth=branch|department|team|employee    (default employee)
    &branch_id=1
    &include_exited=1
```

- Har level par `employee_count` — jod milta hai (test me verify kiya)
- Jinka branch/dept/team assign nahi — `unassigned`,
  `employees_without_department`, `employees_without_team` me alag dikhte hain
- Exit ho chuke employee aur super admin default me nahi aate
- Koi permission middleware nahi — har logged-in banda apni company ka chart dekhta hai
- Har node me `reporting_manager_id` bhi hai, frontend chahe to reporting tree bana le

**Files:** `app/Services/OrgChartService.php`,
`app/Http/Controllers/Company/OrgChartController.php`
**Test:** 29/29

> Departments me `branch_id` NULL hai, isliye tree **employee ke branch se** banta hai.
> Kisi department ko ek branch se pin karna ho to `departments.branch_id` set kar do.

### 20. Helpdesk / Ticket

Do tarah ke ticket, ek hi table me `scope` column se:

```
scope = platform   →  Company Admin  →  Super Admin
scope = internal   →  Employee       →  HR / Manager / IT / Admin
```

**Routing ka dimaag `ticket_category_routes` me hai** — category decide karti hai
ki kaun-kaun se option dikhenge:

| Category | Kisko bhej sakte ho | Default |
|---|---|---|
| Salary / Payslip | sirf HR | HR |
| Policy / Document | sirf HR | HR |
| Leave / Attendance | Manager ya HR | Manager |
| Work / Task / Project | sirf Manager | Manager |
| IT / Laptop / System | sirf IT | IT |
| Office / Facility | sirf Admin | Admin |
| Kuch aur | Manager / HR / IT / Admin | **koi nahi** — khud chuno |

`route_to = manager` par ticket raise karne wale ke **apne** `reporting_manager_id`
ko jati hai — koi hardcode nahi. Department khali ho to apne aap
`ticket.view_all` walon ke paas chali jati hai.

**Status ka safar:** `open → in_progress → waiting_on_user → resolved → closed`
(+ `reopen` 7 din tak, `cancel`)

- Resolve karte waqt **note likhna mandatory** hai
- **Ticket band karne ka haq raise karne wale ka** — handler sirf `resolved` tak le ja sakta hai
- `ask-info` par status `waiting_on_user`, aur **SLA ki ghadi ruk jati hai**

**SLA — default BAND hai.** Ticket kabhi bhi raise ho sakti hai, solve karne ki
koi fixed deadline nahi. Chahiye to on karo:

```
PUT /company-settings  { "ticket_sla_enabled": true }
```

On karne par deadline **sirf office hours** ginti hai — shift window, weekly off
aur public holiday chhod ke (`app/Support/BusinessHours.php`). Raat 11 baje ticket
aayi to ghadi agli subah shift start se chalti hai.

```
urgent   1h reply /   4h solve        high    4h /  24h
medium   8h        /  48h             low    24h / 120h
```

(`ticket_slas` table; category par override — `response_hours` / `resolution_hours`)

**Permissions (5):** `ticket.view_all`, `ticket.assign`, `ticket.resolve`,
`ticket.category_manage`, `ticket.platform`
Raise karne ke liye **koi permission nahi** — har employee kar sakta hai.

**Cron:** `tickets:escalate` har ghante — SLA cross hui to breach mark + escalate

**Files:** `app/Services/TicketService.php`, `TicketCategoryService.php`,
`app/Support/BusinessHours.php`, `database/schema/ticket_schema.sql` (5 table)
**Test:** 118/118

---

## Abhi kya pending hai

### A. Chhote gap — pehle yahi nikalne chahiye

| # | Kya | Kyun zaroori |
|---|---|---|
| 1 | `company_modules` ki row nayi company par banti nahi | super admin ko khali checkbox screen dikhti hai |
| 2 | Rohit (Company Admin) ka employee record nahi | uska attendance / leave / SOD-EOD / performance kuch nahi chalega |
| 3 | Role ka naam `Employee` hai | `Member` hona chahiye — HR bhi to employee hi hai |
| 4 | Priya aur Amit ka `reporting_manager` blank | inki leave / expense kisi ke paas approval me nahi jayegi |
| 5 | `Temp Role` / `Temp Designation` / `Temp User` | test ka kachra, DB me pada hai |

### B. Design ho chuka, bana nahi

| # | Kya |
|---|---|
| 6 | `GET /employees/reporting-managers` — dropdown (department + level filter, khali ho to upar chadho, cross-dept toggle) + manager level aur circular chain ki validation |
| 7 | Nayi company par **5 default role** seed — abhi sirf `Company Admin` banta hai |
| 8 | Department permission preset — `department_permissions` abhi **poori khali** hai |
| 9 | `ticket_slas` edit karne ka API — table hai, endpoint nahi |

### C. Module pending

| # | Kya | Note |
|---|---|---|
| 10 | Audit Log viewer | data DB me pada hai (`created_by`/`updated_by`), API nahi |
| 11 | Bulk Import | Excel se employee upload |
| 12 | Billing & Plans | **rate fix nahi**, isliye ruka |

### D. Jaan-boojh kar last ke liye rakhe hain

```
13. Payroll + Salary Structure
14. LOP  (attendance → payroll)
15. Statutory  (PF / ESI / PT / TDS challan, filing)
16. Full & Final Settlement
17. Dashboard / Reports
18. Recruitment  (job, candidate, interview)
19. Onboarding flow  (offer letter → joining)
20. HTML letter templates  (offer, relieving, experience)
```

### E. Hata diye — inpe kaam nahi karna

```
Travel & Advance      Timesheet / Project
Insurance             Training / LMS
```

---

## Audit Log ka design (tay ho chuka, bana nahi)

```
Super Admin       →  saari companies + platform level
Company Admin     →  apni company ka poora
HR Manager        →  apni company ka, par HR se juda hi
Manager / Member  →  kuch nahi
```

Permission: `audit.view`

Do baatein pakki karni hain:

1. **Kaun dekh raha hai wo bhi log ho** — warna audit log ka matlab hi nahi
2. **Sensitive value mask ho** — Aadhaar, PAN, bank a/c, password
   (`XXXX4521 → XXXX9832`, poora number nahi) — warna log khud ek leak ban jayega

---

## Multiple Company Admin — verify ho chuka hai

Ek company me kitne bhi admin ho sakte hain. `user_roles` ka unique
`(user_id, role_id)` par hai, isliye alag-alag log wahi role le sakte hain.

`UserService::resolveRoles()` ka guard `hierarchy_level < actor->lowestRoleLevel()`
hai — **strictly less than**. Isliye Company Admin (level 2) doosra Company Admin
(level 2) bana sakta hai, par Super Admin nahi bana sakta.

```
Rohit  ──POST /users {role_ids:[2]}──►  Vikram  (poora barabar admin)
Vikram ──POST /users {role_ids:[2]}──►  Teesra
```

> Ye **poora barabar** ka admin hota hai — naya admin purane ko bhi delete kar sakta hai.
> Aisa nahi chahiye to naya role banao (`Co-Admin`, level 3) aur usme `user.delete` mat do.

---

## Frontend shuru karne se pehle jaan lo

Login response me **user object hai hi nahi**:

```json
{ "data": {
    "token": "...",
    "role": "company_admin",
    "policy_gate": { "blocked": false, "pending": 0 }
} }
```

Naam, avatar, department, designation, permissions — kuch nahi milta.
Login ke turant baad do call karni padengi:

```
POST /auth/login   →  token + role + policy_gate
GET  /profile      →  naam, email, department, designation, roles, employee detail
```

`policy_gate.blocked` **true** aaye to seedha policy-accept screen par bhejo,
dashboard par nahi.

Baaki jo dhyan rakhna:

- Har request me `Authorization: Bearer <token>` **aur** `X-Company-Id: 1`
- Login par rate limit **5 per minute**; **5 galat password** par account 15 min lock
- App timezone **UTC** hai, MySQL **IST** — timestamp hamesha API se aaye ISO string
  se lo, khud calculate mat karo
- Route binding `uuid` aur numeric `id` dono accept karta hai
- List response me `meta` (pagination), error me `error_code` + `errors`

---

## Test kaise chalayein

Suites scratchpad me PHP scripts hain, real HTTP hit karti hain — Apache chalna
chahiye (`http://localhost/clanio-hr-portal/backend/public/api/hrms`).

```
Purani 16 suites:
C:\Users\ICG-21\AppData\Local\Temp\claude\...\270b9723-...\scratchpad\

Nayi 2 suites (org chart, ticket):
C:\Users\ICG-21\AppData\Local\Temp\claude\...\4d29eece-...\scratchpad\
```

Chalane se pehle:

- Default shift `09:30–18:30`, Sunday off hona chahiye — kuch suites isko badal deti hain
- Ticket ka data saaf kar lo, warna count wale assertions fail honge
- `test_realtime` ke liye Reverb chahiye:
  `php artisan reverb:start --host=127.0.0.1 --port=8080`
