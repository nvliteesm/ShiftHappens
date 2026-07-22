# User Acceptance Test Plan — ShiftHappens

> **Project**: Smart Task Allocation (ShiftHappens) — CSIT321 Group 22
> **Scope**: Features delivered in branches #1–#8, plus regression of core flows
> **Environment**: Local (`http://localhost:3000`), Stripe **test mode**
> **Tester**: ______________________  **Date**: ______________

---

## 1. Purpose

This plan validates the delivered features against the PRD user stories through
manual, end-to-end use of the application. Automated tests (679 passing) already
cover service and repository logic; **this plan targets the UI and the
end-to-end flows, which automated tests do not exercise.**

Each test records **Pass / Fail** and notes. Section 6 lists requirements that are
**known to be unimplemented** — these are expected to fail and should be recorded
as open gaps, not defects.

---

## 2. Environment setup

Run once before testing:

```powershell
# 1. Database schema + permissions
npx prisma migrate deploy
npx prisma db seed

# 2. Demo data (org, staff, tasks, certifications, clock history)
npx tsx prisma/seed-demo.ts

# 3. Start the app
npm run dev
```

For the Stripe tests (UAT-01, UAT-02) **also** run, in a second terminal:

```powershell
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

> Leave it running. If it isn't running, payment succeeds but the plan will **not**
> upgrade — the webhook is what grants Pro.

**App URL**: http://localhost:3000

### 2.1 Test accounts

All accounts use password **`TestPass1!`** and are pre-verified (no email step).

| Role | Email | Notes |
|---|---|---|
| Platform Admin | `platform@smarttask.com` | Tenant management |
| Company Admin | `admin@oceangrill.com` | Ocean Grill (Pro tier) |
| Manager | `sarah@oceangrill.com` | Kitchen |
| Manager | `marcus@oceangrill.com` | Bar |
| Staff | `alex@oceangrill.com` | Kitchen, Full-time |
| Staff | `jordan@oceangrill.com` | Bar, Casual |
| Staff | `casey@oceangrill.com` | Front of House, Casual |
| **New user** | `new@smarttask.com` | **No org** — lands on onboarding |

### 2.2 Stripe test card

| Field | Value |
|---|---|
| Card number | `4242 4242 4242 4242` |
| Expiry | any future date |
| CVC | any 3 digits |
| ZIP / Postcode | any |

---

## 3. Test cases — new features (#1–#8)

### #1 — Stripe sandbox checkout (PRD §3.1, US-7, US-8)

| ID | Steps | Expected result | P/F | Notes |
|---|---|---|---|---|
| UAT-01 | Log in as `new@smarttask.com` → onboarding → pick a template → **Next** → fill org name → select the **Pro** plan → **Continue to payment** | Redirected to a Stripe-hosted checkout page showing **$29/mo** | | |
| UAT-01a | On the Stripe page, pay with the test card | Payment succeeds; redirected back into the app | | |
| UAT-01b | Go to **Settings** | Plan badge reads **Pro**. `stripe listen` shows `checkout.session.completed → 200` | | |
| UAT-01c | Repeat UAT-01 but toggle to **Annual** before paying | Stripe page shows **$290/yr** | | |
| UAT-01d | Start checkout, then **cancel** on the Stripe page | Returns to app; org remains on **Free**; no charge | | |
| UAT-02 | As a **Free**-tier company admin, go to **Settings → Upgrade to Pro** → pay | Plan badge becomes **Pro** | | |
| UAT-02a | Log in as `alex@oceangrill.com` (staff) → Settings | **No** upgrade control is available (billing is admin-only) | | |

### #2 — Staff task withdrawal request (US-76, US-69)

| ID | Steps | Expected result | P/F | Notes |
|---|---|---|---|---|
| UAT-03 | As **staff**, go to **My Tasks**. Find an **accepted** task (accept a pending one if needed) → **Request withdrawal** | A reason field appears; submitting without a reason is rejected | | |
| UAT-03a | Enter a reason → **Submit request** | Task shows **"withdrawal requested"**; message confirms the manager was notified | | |
| UAT-04 | Log in as the **manager/admin** who assigned it → **Notifications** | A **"Withdrawal requested"** notification naming the staff member and reason | | |
| UAT-04a | Go to **Tasks** → find the task | An **orange panel** shows the withdrawal reason with **Approve & unassign** / **Deny** | | |
| UAT-04b | Click **Deny** | Staff member returns to **accepted**; they receive a "Withdrawal declined" notification | | |
| UAT-04c | Repeat, then click **Approve & unassign** | Staff is removed from the task; they receive a "Withdrawal approved" notification | | |
| UAT-04d | As staff, try to withdraw from a **pending** (not yet accepted) task | No withdrawal option — reject/accept only | | |

### #3 — Clock in/out + mark completed (US-77, US-78)

| ID | Steps | Expected result | P/F | Notes |
|---|---|---|---|---|
| UAT-05 | As **staff** → **My Tasks** → an accepted task → **Clock In** | Clock-in time appears | | |
| UAT-05a | Click **Clock Out** | Task **leaves "Active"** and appears under **"Awaiting completion"**. It is **NOT** marked completed yet | | |
| UAT-05b | Click **Mark as complete** | Task moves to **Completed** | | |
| UAT-05c | As the assigning manager → **Notifications** | A **"Task completed"** notification naming the staff member | | |
| UAT-05d | Confirm hours are still counted after clock-out but **before** marking complete (check the staff dashboard hours) | Worked hours include the clocked-out shift | | |

### #4 — Eligibility warnings + override (US-63, US-64)

> Setup: create a task that **overlaps** an existing assignment for a staff member,
> so they are flagged as ineligible.

| ID | Steps | Expected result | P/F | Notes |
|---|---|---|---|---|
| UAT-06 | As **manager/admin** → **Tasks** → **Assign** on the overlapping task | Flagged staff appear in an **amber card** listing **every** warning (e.g. conflict, hour limit, availability) — not just one | | |
| UAT-06a | Try to tick a flagged staff member's checkbox | Checkbox is **disabled** until a reason is given | | |
| UAT-06b | Type an override reason | Checkbox **unlocks**; confirmation text appears | | |
| UAT-06c | Select them and **Confirm Assignment** | Assignment succeeds **despite** the conflict | | |
| UAT-06d | Go to **Audit Log** | An **"Eligibility overridden"** entry recording who, which rule, and the reason | | |
| UAT-06e | Re-open the assign panel for that task | The previously flagged member now shows as eligible (override applied) | | |
| UAT-06f | Try to confirm a flagged member **without** a reason | Blocked with "Provide an override reason for each flagged staff member" | | |

### #5 — Task notifications (US-58, US-71, US-86)

| ID | Steps | Expected result | P/F | Notes |
|---|---|---|---|---|
| UAT-07 | Assign a staff member to a task → log in as that staff → **Notifications** | **"New task assignment"** notification | | |
| UAT-08 | As manager, **Unassign** that staff member → check their notifications | **"Removed from a task"** notification | | |
| UAT-08a | Assign staff to a task, then **delete** the task → check their notifications | **"Task cancelled"** notification | | |
| UAT-08b | Assign staff to a scheduled task, then **change its start/end time** → check their notifications | **"Task rescheduled"** notification | | |
| UAT-08c | Reschedule a task so an assigned member now **conflicts** → check the **manager's** notifications | **"Assigned staff no longer eligible"** naming that member | | |
| UAT-10 | As admin → **Settings** → untick **"Task assignment notifications"** → Save. Now assign someone | **No** assignment notification is sent (the toggle actually works) | | |
| UAT-10a | Re-tick the setting → assign again | Notification is sent again | | |

### #6 — Hour-limit alerts (US-72, US-85)

> The org break rule is **8h in 24h**. "Approaching" fires at **≥80%** (6.4h), "exceeded" at **≥100%**.

| ID | Steps | Expected result | P/F | Notes |
|---|---|---|---|---|
| UAT-09 | As **staff**, clock in and out of a shift long enough to pass ~80% of the limit (or adjust the break rule in Settings to a low value, e.g. 1h, to trigger it quickly) | Staff receives **"You're approaching an hour limit"** | | |
| UAT-09a | Log in as **manager/admin** → **Notifications** | Manager receives **"Staff approaching hour limit"** naming the staff member and hours | | |
| UAT-09b | Clock out again shortly after (same staff) | **No duplicate** alert — repeats are suppressed for 12h | | |
| UAT-09c | As admin → Settings → untick **"Hour limit warning notifications"** → trigger again | No hour-limit alerts are sent | | |

### #7 — Recurring task generation (US-54)

| ID | Steps | Expected result | P/F | Notes |
|---|---|---|---|---|
| UAT-11 | As manager/admin → **Tasks → Create Task**. Fill title, **start and end time**, then **Repeats: Weekly** → tick **Mon** and **Wed** → **Create Task** | Task is created; success message mentions occurrences were generated | | |
| UAT-11a | Look at the task list | The original task carries a **`↻ Every week on Mon, Wed`** badge; additional tasks appear tagged **`↻ from series`**, all on Mondays/Wednesdays only | | |
| UAT-11b | Check the generated occurrences' times | Same **time of day** and **duration** as the original | | |
| UAT-11c | Set **Repeats: Daily**, interval **2**, with an **Until** date ~1 week out | Occurrences appear every **other** day and **stop** at the until date | | |
| UAT-11d | Try to create a repeating task **without** start/end times | Rejected: "A repeating task needs a start and end time" | | |
| UAT-11e | Confirm generated occurrences behave like normal tasks — assign staff to one | Assignment works normally (no special-casing) | | |
| UAT-12 | Note how many occurrences exist. Re-run generation via the API (below) | **No duplicates** are created (`created: 0`, `skippedExisting > 0`) | | |

Re-run generation (idempotency check), while logged in as an admin — paste into the browser console on the app:

```js
await (await fetch(`/api/organizations/${location.pathname.split('/')[2]}/recurring-tasks/generate`, {
  method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}'
})).json()
```

### #8 — Company admin dashboard summaries (US-48)

| ID | Steps | Expected result | P/F | Notes |
|---|---|---|---|---|
| UAT-13 | Log in as `admin@oceangrill.com` → **Dashboard** | Three new cards are visible: **Task summary**, **Task coverage (next 7d)**, **Certifications** | | |
| UAT-13a | **Task summary** card | Shows total tasks and a breakdown by **Open / In progress / Completed / Cancelled** matching the Tasks page | | |
| UAT-13b | **Task coverage** card | Shows a coverage **%** with a bar, plus **Fully staffed / Understaffed / Unassigned** counts | | |
| UAT-13c | Create a new **unassigned** task scheduled in the next few days → reload the dashboard | **Unassigned** count increases; coverage % drops | | |
| UAT-13d | **Certifications** card | Shows **verified**, **awaiting verification**, **expiring in 30d**, **expired** counts; "Review certifications →" links to the certifications page | | |
| UAT-13e | Verify a pending certification → reload dashboard | Awaiting-verification count decreases; verified increases | | |

---

## 4. Regression — core existing features

These already worked; confirm the new work didn't break them.

| ID | Area | Steps | Expected result | P/F |
|---|---|---|---|---|
| REG-01 | Auth | Log in / log out; reset password | Works | |
| REG-02 | Onboarding | `new@smarttask.com` → create org on the **Free** plan | Org created; lands on dashboard | |
| REG-03 | Departments | Create / edit / delete a department | Works | |
| REG-04 | Members | Invite a user; change role; deactivate | Works | |
| REG-05 | Tasks | Create a one-off task; edit; delete | Works | |
| REG-06 | AI suggest | On assign, click **✨ AI Suggest** | Ranked staff with explanations (or algorithmic fallback if no AI key) | |
| REG-07 | Auto-schedule | Run auto-schedule | Assigns staff | |
| REG-08 | Availability | Staff sets weekly availability + a date override | Saves and affects eligibility | |
| REG-09 | Certifications | Staff uploads; manager verifies / rejects with reason | Works | |
| REG-10 | Calendar | Open calendar view | Tasks + coverage render | |
| REG-11 | Audit log | Open audit log | New actions appear (completed, withdrawal, override, recurring generated) | |
| REG-12 | Platform admin | `platform@smarttask.com` → tenants + metrics | Works | |
| REG-13 | Tier limits | On **Free**, exceed a limit (e.g. 3rd department) | Blocked with an upgrade prompt | |

---

## 5. Cross-cutting checks

| ID | Check | Expected result | P/F |
|---|---|---|---|
| X-01 | Dark mode | Toggle theme — new cards, badges and panels remain readable | |
| X-02 | Multi-tenancy | A user of one org cannot see another org's data via URL tampering | |
| X-03 | Role boundaries | Staff cannot reach `/org/[orgId]/tasks` admin actions; manager sees only their departments | |
| X-04 | Console | No unhandled errors in the browser console during the flows above | |

---

## 6. Known gaps — expected to fail (record, do not raise as defects)

These PRD requirements are **not implemented**. They are listed so testers don't
report them as bugs, and so they can be tracked as open work.

| PRD ref | Requirement | Status |
|---|---|---|
| US-53, §7.4, §5.1 | **Required certifications on a task**, and the certification check in the eligibility engine | ❌ Not implemented. `Task` has no required-cert field; the engine checks 3 of the 5 PRD eligibility factors. |
| US-70, §5.1 | **Overdue task notification** | ❌ No overdue detection exists |
| §7.4 | **Department scope** as an eligibility factor | ❌ Eligibility considers all active staff regardless of the task's department |
| US-41, §1.3 | **Enforcement mode** (strict block vs warn + override) | ❌ All rules are warn + override; no strict mode |
| US-27 | Subscription **downgrade** | ❌ Upgrade only |
| US-49, US-71 | **Task issue alerts page** | ❌ Not built (data partly available via the hour-alerts API) |
| — | Manager **clock-time adjustment** | ❌ Not built |
| US-81 | **iCal feed** | ❌ Not built |
| US-87 | Certification **expiry** notification | ❌ Not built |
| §5.1 | **Email** notifications | ❌ In-app only; the `emailNotifications` toggle has no effect |

### Operational note

Hour-limit alerts fire on **clock-out**, and recurring occurrences are generated on
**task create**. Both also expose endpoints intended to be run on a schedule
(`POST /hour-alerts`, `POST /recurring-tasks/generate`), but **no scheduler is
configured** — so nothing runs nightly yet. This is expected for local UAT.

---

## 7. Result summary

| | Count |
|---|---|
| Total test cases executed | |
| Passed | |
| Failed | |
| Blocked | |
| Known gaps confirmed (Section 6) | |

**Defects raised**:

| # | Test ID | Severity | Description |
|---|---|---|---|
| | | | |

**Tester sign-off**: ______________________  **Date**: ______________
