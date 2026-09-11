# School Management System — Interactive Demo

A school ERP built for a private secondary school and used there every day by
students, teachers, parents and the office.

**This repository is the public demo.** It is the same frontend as the
production system with one substitution: the API layer answers itself from a
world generated in the browser, so the whole product runs as a static site with
no backend, no database and no keys. The school's own deployment — with real
children's records — is private and shares nothing with this.

👉 **[Open the demo](#)** — four buttons, one per role. No credentials to type.

---

## What it does

| | |
|---|---|
| **Attendance** | Teachers take their own register; the office closes the day and everyone unaccounted for is marked absent, once, with parents notified |
| **The gate** | A door tablet reads a student's QR card *or* their face, logs the arrival, marks the register and tells the parent at home |
| **Marks** | Per-subject entry, per-student averages, printable statements |
| **Fees** | Instalments, part payments, receipts, automatic reminders a fortnight and a week before a payment is due |
| **Parents** | Their own account, their children's day, and direct messaging with the teachers who actually teach them |
| **Buses** | Routes, drivers, riders, and a status the parent can see |

Five roles — administrator, assistant administrator, teacher, student, parent —
each with their own navigation, their own screens, and permission checks on the
server rather than in the interface.

## Engineering worth pointing at

**Cost, on a database that charges per read.** Firestore bills reads, and a
school of three hundred generates a lot of them. Per-student fee totals are
denormalised onto the account; headcounts use server-side count aggregations
instead of reading documents; a TTL cache with prefix invalidation fronts the
hot paths; and the notification badge polls a single integer rather than a list
— roughly a sixtieth of the reads the first version cost on that poll alone.

**Face recognition that runs on the tablet.** 128-dimension descriptors are
computed in the browser and no image is ever stored — the database holds only
numbers, which cannot be turned back into a picture. The match threshold is
deliberately tighter than the library's default, and a runner-up margin check
refuses to choose between two similar faces, because siblings at the same
school make that a real risk rather than a theoretical one. The 7MB of model
weights are excluded from the service-worker precache, so only the door tablet
downloads them and every student's phone stays under 900KB.

**Failures that degrade instead of breaking.** Paginated queries survive a
missing composite index through an offset-cursor fallback — a hard failure
becomes a slower path. Permission checks cost zero reads: the role and a
parent's children travel in a signed session token.

**Two languages, properly.** Full Arabic (RTL) and English, 900+ translation
keys, verified by walking the source rather than by eye.

## Built with

TypeScript · React 19 · Vite · Tailwind 4 · Firestore · Express (Cloud
Functions + Vercel) · face-api.js · Workbox

Roughly 23k lines, 116 REST endpoints across 22 collections, 123 tests in CI.

## Running the demo locally

```bash
npm install
npm run dev
```

No environment variables, no services to start. The dataset is generated on
load; every write works and a refresh resets the school.

---

*The people, classes, marks and fees in this demo are invented. No record from
the real school appears anywhere in this repository.*
