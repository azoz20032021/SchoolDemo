import { buildWorld, DEMO_ACCOUNTS, TODAY, type Row, type World } from './dataset';

/**
 * The server, running in the browser.
 *
 * In the real system every screen talks to an Express API over Firestore. Here
 * the same calls are answered from the generated world in memory, so the demo
 * needs no backend, no database and no keys — it is a static site that behaves
 * like the whole product.
 *
 * The contract is the one the screens already expect. Nothing in src/pages or
 * src/components was changed to make this work: the substitution happens at the
 * single point where the application reaches for the network.
 */

const world: World = buildWorld();

/** Who is signed in. The demo's sign-in page sets this. */
let session: Row | null = null;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const byId = (list: Row[], id: string) => list.find((row) => row.id === id);
const students = () => world.users.filter((u) => u.role === 'student');

function classNameOf(classId?: string | null): string {
    return (classId && byId(world.classes, classId)?.name) || '';
}

/* ------------------------------------------------------------------ *
 * The pieces several endpoints need
 * ------------------------------------------------------------------ */

function financeFor(studentId: string) {
    const rows = world.invoices.filter((i) => i.student_id === studentId);
    const billed = rows.reduce((s, i) => s + (i.amount - i.discount), 0);
    const paid = rows.reduce((s, i) => s + i.paid_amount, 0);

    return {
        total_billed: billed,
        total_paid: paid,
        outstanding: Math.max(0, billed - paid),
        is_clear: billed - paid <= 0,
        invoices: rows.map((i) => ({ ...i, net_amount: i.amount - i.discount, remaining: Math.max(0, i.amount - i.discount - i.paid_amount) })),
    };
}

function attendanceFor(studentId: string) {
    const records = world.attendance
        .filter((a) => a.student_id === studentId)
        .map((a) => ({ date: a.date, status: a.status }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    const present = records.filter((r) => r.status === 'present').length;
    const rate = records.length > 0 ? Math.round((present / records.length) * 100) : 100;

    return { stats: { rate, absent, late, present, total: records.length }, records };
}

function gradesFor(studentId: string) {
    const rows = world.grades.filter((g) => g.student_id === studentId);
    const bySubject = new Map<string, { sum: number; count: number }>();

    for (const g of rows) {
        const entry = bySubject.get(g.subject) || { sum: 0, count: 0 };
        entry.sum += g.total ? g.score / g.total : 0;
        entry.count += 1;
        bySubject.set(g.subject, entry);
    }

    const subjects = [...bySubject].map(([subject, e]) => ({
        subject,
        percentage: Math.round((e.sum / e.count) * 100),
    }));

    const overall = subjects.length
        ? Math.round(subjects.reduce((s, x) => s + x.percentage, 0) / subjects.length)
        : null;

    return { rows, stats: { overall_percentage: overall, subjects } };
}

function behaviorFor(studentId: string) {
    const notes = world.behavior
        .filter((b) => b.student_id === studentId)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const score = Math.max(0, Math.min(100, 100 + notes.reduce((s, n) => s + n.points, 0)));
    return { conduct_score: score, notes };
}

function reportFor(studentId: string) {
    const student = byId(world.users, studentId);
    if (!student) return null;

    return {
        student: {
            id: student.id, name: student.name, uid: student.uid,
            class_name: student.class_name, guardian_name: student.guardian_name,
            guardian_phone: student.guardian_phone,
        },
        grades: gradesFor(studentId),
        attendance: attendanceFor(studentId),
        behavior: behaviorFor(studentId),
        finance: financeFor(studentId),
        generated_at: new Date().toISOString(),
    };
}

function busFor(student: Row) {
    if (!student?.bus_id) return null;
    const bus = byId(world.buses, student.bus_id);
    if (!bus) return null;
    return { ...bus, stop: bus.stops[0] };
}

/** The paged shape the lists expect. */
function page(rows: Row[], query: URLSearchParams) {
    const limit = Number(query.get('limit') || 20);
    const offset = Number(query.get('after') || 0);
    const slice = rows.slice(offset, offset + limit);
    const next = offset + limit;
    return { data: slice, total: rows.length, nextCursor: next < rows.length ? String(next) : null };
}

function matchesTerm(student: Row, term: string): boolean {
    if (!term) return true;
    const needle = term.trim().toLowerCase();
    return (
        String(student.name).toLowerCase().includes(needle) ||
        String(student.uid).includes(needle) ||
        String(student.class_name || '').toLowerCase().includes(needle)
    );
}

/* ------------------------------------------------------------------ *
 * Signing in
 * ------------------------------------------------------------------ */

/** Resolve the demo's four buttons to actual people in the generated world. */
export function demoAccountFor(role: string): Row {
    if (role === 'admin') return byId(world.users, 'u-admin')!;
    if (role === 'teacher') return byId(world.users, 'u-t1')!;
    if (role === 'student') return students()[0];

    const guardian = world.users.find((u) => u.role === 'guardian' && (u.student_ids || []).length > 1)
        || world.users.find((u) => u.role === 'guardian')!;
    return guardian;
}

export function signInAs(role: string): { token: string; user: Row } {
    session = demoAccountFor(role);
    return { token: `demo-${role}`, user: publicUser(session) };
}

function publicUser(user: Row): Row {
    const safe = clone(user);
    delete safe.password;

    if (user.role === 'student') {
        const finance = financeFor(user.id);
        safe.dues = {
            outstanding: finance.outstanding,
            next_due_date: user.fees_next_due || null,
            // The demo never locks anyone out; a paywall is not what a visitor
            // came to look at.
            blocked: false,
        };
    }

    if (user.role === 'guardian') safe.students = user.student_ids || [];
    return safe;
}

/* ------------------------------------------------------------------ *
 * The routes
 * ------------------------------------------------------------------ */

type Handler = (ctx: {
    parts: string[];
    query: URLSearchParams;
    body: any;
    method: string;
}) => any;

const ROUTES: [RegExp, Handler][] = [
    /* ------------------------------ identity ------------------------------ */

    [/^\/api\/login$/, ({ body }) => {
        const uid = String(body?.uid || '').trim();
        const match = world.users.find((u) => String(u.uid) === uid);
        if (!match) throw { status: 401, message: 'No account with that ID. Use one of the buttons above.' };
        session = match;
        return { token: `demo-${match.role}`, user: publicUser(match) };
    }],

    [/^\/api\/me$/, () => {
        if (!session) throw { status: 401, message: 'Session expired' };
        return publicUser(session);
    }],

    [/^\/api\/change-password$/, () => ({ success: true })],
    [/^\/api\/set-initial-password$/, () => ({ success: true })],
    [/^\/api\/register$/, ({ body }) => {
        const request = { id: `reg-${Date.now()}`, request_number: `REQ-${Date.now() % 10000}`, ...body, status: 'pending' };
        world.registrations.unshift(request);
        return { success: true, request_number: request.request_number };
    }],
    [/^\/api\/register\/status/, ({ query }) => {
        const number = query.get('request_number');
        return world.registrations.find((r) => r.request_number === number) || null;
    }],

    /* ------------------------------ the school ----------------------------- */

    [/^\/api\/classes$/, () => world.classes],
    [/^\/api\/subjects$/, () => world.subjects],
    [/^\/api\/periods$/, () => world.periods],
    [/^\/api\/admin\/periods$/, ({ method, body }) => {
        if (method === 'PUT' || method === 'POST') {
            world.periods = body?.periods || world.periods;
            return { success: true };
        }
        return world.periods;
    }],

    [/^\/api\/schedules\/([^/]+)$/, ({ parts }) => world.schedules.filter((s) => s.class_id === parts[0])],

    [/^\/api\/class\/([^/]+)\/students$/, ({ parts }) =>
        students().filter((s) => s.class_id === parts[0]).map((s) => ({ id: s.id, name: s.name, uid: s.uid }))],

    [/^\/api\/class\/([^/]+)\/grades$/, ({ parts, query }) =>
        page(world.grades.filter((g) => g.class_id === parts[0]), query)],

    [/^\/api\/class\/([^/]+)\/behavior$/, ({ parts, query }) =>
        page(world.behavior.filter((b) => b.class_id === parts[0]), query)],

    [/^\/api\/class\/([^/]+)\/exams$/, ({ parts }) => world.exams.filter((e) => e.class_id === parts[0])],

    [/^\/api\/class\/([^/]+)\/attendance$/, ({ parts, query }) =>
        world.attendance.filter((a) => a.class_id === parts[0] && a.date === (query.get('date') || TODAY))],

    [/^\/api\/class\/grades\/student\/([^/]+)$/, ({ parts }) => gradesFor(parts[0]).rows],

    [/^\/api\/teacher\/classes\/([^/]+)$/, () => world.classes],
    [/^\/api\/student\/classes\/([^/]+)$/, ({ parts }) => {
        const student = byId(world.users, parts[0]);
        return world.classes.filter((c) => c.id === student?.class_id);
    }],

    /* ------------------------------ a student ------------------------------ */

    [/^\/api\/reports\/student\/([^/]+)$/, ({ parts }) => reportFor(parts[0])],
    [/^\/api\/student\/([^/]+)\/homework$/, ({ parts }) => {
        const student = byId(world.users, parts[0]);
        return world.homework.filter((h) => h.class_id === student?.class_id);
    }],
    [/^\/api\/student\/([^/]+)\/exams$/, ({ parts }) => {
        const student = byId(world.users, parts[0]);
        const upcoming = world.exams
            .filter((e) => e.class_id === student?.class_id && e.date >= TODAY)
            .sort((a, b) => a.date.localeCompare(b.date));
        return { upcoming };
    }],
    [/^\/api\/student\/([^/]+)\/bus$/, ({ parts }) => busFor(byId(world.users, parts[0])!)],
    [/^\/api\/student\/([^/]+)\/finance$/, ({ parts }) => financeFor(parts[0])],
    [/^\/api\/student\/([^/]+)\/behavior$/, ({ parts }) => behaviorFor(parts[0]).notes],
    [/^\/api\/student\/([^/]+)\/attendance$/, ({ parts }) => attendanceFor(parts[0]).records],

    /* ------------------------------- a parent ------------------------------- */

    [/^\/api\/guardian\/children$/, () => {
        const ids: string[] = session?.student_ids || [];
        return ids
            .map((id) => byId(world.users, id))
            .filter(Boolean)
            .map((s) => ({ id: s!.id, name: s!.name, uid: s!.uid, class_id: s!.class_id, class_name: s!.class_name }));
    }],

    /* ------------------------------- messages ------------------------------- */

    [/^\/api\/conversations$/, ({ method, body }) => {
        if (method === 'POST') {
            const existing = world.conversations.find((c) => c.participant_ids.includes(body?.user_id));
            if (existing) return { id: existing.id, existing: true };
            const other = byId(world.users, body?.user_id);
            const created: Row = {
                id: `cv-${Date.now()}`,
                participant_ids: [session!.id, body?.user_id],
                participants: {
                    [session!.id]: { name: session!.name, role: session!.role },
                    [body?.user_id]: { name: other?.name || '', role: other?.role || '' },
                },
                student_id: body?.student_id || null,
                student_name: byId(world.users, body?.student_id || '')?.name || '',
                last_message: '',
                last_at: { seconds: Math.floor(Date.now() / 1000) },
                unread: {},
            };
            world.conversations.unshift(created);
            return { id: created.id, existing: false };
        }

        return world.conversations
            .filter((c) => c.participant_ids.includes(session?.id))
            .map((c) => {
                const otherId = c.participant_ids.find((id: string) => id !== session?.id);
                return {
                    id: c.id,
                    other_id: otherId,
                    other_name: c.participants?.[otherId]?.name || '',
                    other_role: c.participants?.[otherId]?.role || '',
                    student_name: c.student_name || '',
                    last_message: c.last_message,
                    last_at: c.last_at,
                    unread: Number(c.unread?.[session!.id] || 0),
                };
            });
    }],

    [/^\/api\/conversations\/([^/]+)\/messages$/, ({ parts }) => {
        const conversation = byId(world.conversations, parts[0]);
        const rows = world.messages
            .filter((m) => m.conversation_id === parts[0])
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        return {
            data: rows,
            nextCursor: null,
            conversation: {
                id: parts[0],
                student_name: conversation?.student_name || '',
                participants: conversation?.participants || {},
            },
        };
    }],

    [/^\/api\/conversations\/([^/]+)\/read$/, ({ parts }) => {
        const conversation = byId(world.conversations, parts[0]);
        if (conversation && session) conversation.unread[session.id] = 0;
        return { success: true };
    }],

    [/^\/api\/messages\/contacts$/, () => {
        const office = world.users
            .filter((u) => u.role === 'admin' || u.role === 'assistant_admin')
            .map((u) => ({ id: u.id, name: u.name, role: u.role, subtitle: 'School office' }));

        if (session?.role === 'guardian') {
            const child = byId(world.users, (session.student_ids || [])[0]);
            const teachers = world.users
                .filter((u) => u.role === 'teacher')
                .slice(0, 6)
                .map((t) => ({
                    id: t.id, name: t.name, role: 'teacher',
                    subtitle: (t.subjects || []).join(', '),
                    student_id: child?.id, student_name: child?.name,
                }));
            return [...teachers, ...office.map((o) => ({ ...o, student_id: child?.id, student_name: child?.name }))];
        }

        if (session?.role === 'teacher') {
            return [
                ...world.users.filter((u) => u.role === 'guardian').slice(0, 12).map((g) => {
                    const child = byId(world.users, (g.student_ids || [])[0]);
                    return {
                        id: g.id, name: g.name, role: 'guardian',
                        subtitle: child ? `Parent of ${child.name}` : 'Parent',
                        student_id: child?.id, student_name: child?.name,
                    };
                }),
                ...office,
            ];
        }

        return [
            ...world.users.filter((u) => u.role === 'teacher').map((t) => ({
                id: t.id, name: t.name, role: 'teacher', subtitle: (t.subjects || []).join(', '),
            })),
            ...world.users.filter((u) => u.role === 'guardian').slice(0, 15).map((g) => ({
                id: g.id, name: g.name, role: 'guardian', subtitle: g.phone,
            })),
        ];
    }],

    /* ----------------------------- notifications ---------------------------- */

    [/^\/api\/notifications\/([^/]+)\/unread-count$/, ({ parts }) => ({
        count: world.notifications.filter((n) => n.user_id === parts[0] && !n.isRead).length,
    })],

    [/^\/api\/notifications\/read-all$/, () => {
        world.notifications.forEach((n) => { if (n.user_id === session?.id) n.isRead = true; });
        return { success: true };
    }],

    [/^\/api\/notifications\/read\/([^/]+)$/, ({ parts }) => {
        const row = byId(world.notifications, parts[0]);
        if (row) row.isRead = true;
        return { success: true };
    }],

    [/^\/api\/notifications\/([^/]+)$/, ({ parts }) =>
        world.notifications
            .filter((n) => n.user_id === parts[0])
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))],

    /* -------------------------------- the gate ------------------------------- */

    [/^\/api\/gate\/today$/, () => {
        const rows = [...world.gateEvents].sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0));
        const inSet = new Set(rows.filter((r) => r.direction === 'in').map((r) => r.student_id));
        const outSet = new Set(rows.filter((r) => r.direction === 'out').map((r) => r.student_id));
        return {
            events: rows.slice(0, 25),
            arrived: inSet.size,
            departed: outSet.size,
            inside: [...inSet].filter((id) => !outSet.has(id)).length,
        };
    }],

    [/^\/api\/gate\/scan$/, ({ body }) => {
        const code = String(body?.code || '').trim();
        const student = students().find((s) => String(s.uid) === code || s.id === code);
        if (!student) throw { status: 404, message: `No student with the code ${code}` };

        world.gateEvents.unshift({
            id: `ge-${Date.now()}`,
            student_id: student.id,
            student_name: student.name,
            class_id: student.class_id,
            class_name: student.class_name,
            direction: body?.direction || 'in',
            method: body?.method || 'scan',
            date: TODAY,
            at: { seconds: Math.floor(Date.now() / 1000) },
        });

        return {
            success: true,
            duplicate: false,
            notified: 1,
            student: { id: student.id, name: student.name, uid: student.uid, class_name: student.class_name },
        };
    }],

    /* -------------------------------- faces --------------------------------- */

    [/^\/api\/faces\/mine$/, ({ method, body }) => {
        if (method === 'POST') {
            const descriptors = (body as any)?.descriptors || [];
            world.faces = world.faces.filter((f) => f.student_id !== session?.id);
            world.faces.push({
                id: `f-${session?.id}`,
                student_id: session!.id,
                student_name: session!.name,
                samples: descriptors,
                enrolled_by: 'student',
            });
            return { success: true, samples: descriptors.length };
        }
        const row = world.faces.find((f) => f.student_id === session?.id);
        return { enrolled: Boolean(row), samples: row ? 3 : 0, enrolled_by: row?.enrolled_by || null };
    }],

    [/^\/api\/faces\/enrolled$/, () =>
        world.faces.map((f) => ({
            student_id: f.student_id,
            student_name: f.student_name,
            samples: 3,
            enrolled_by: f.enrolled_by,
        }))],

    /*
     * The faces enrolled in this tab, and nobody else's.
     *
     * The demo ships none on purpose: a visitor opens the gate screen, enrols
     * their own face, and the door then recognises them — the whole feature
     * demonstrated on one device in under a minute, with the descriptors living
     * in this tab's memory and nowhere else.
     */
    [/^\/api\/faces$/, () =>
        world.faces
            .filter((f) => Array.isArray(f.samples) && f.samples.length > 0)
            .map((f) => {
                const student = byId(world.users, f.student_id);
                return {
                    student_id: f.student_id,
                    name: student?.name || f.student_name,
                    uid: student?.uid || '',
                    class_name: student?.class_name || '',
                    descriptors: f.samples,
                };
            })],

    [/^\/api\/faces\/([^/]+)$/, ({ parts, method, body }) => {
        if (method === 'DELETE') {
            world.faces = world.faces.filter((f) => f.student_id !== parts[0]);
            return { success: true };
        }

        const student = byId(world.users, parts[0]);
        const descriptors = (body as any)?.descriptors || [];

        // Re-enrolling replaces, exactly as the real endpoint does.
        world.faces = world.faces.filter((f) => f.student_id !== parts[0]);
        world.faces.push({
            id: `f-${parts[0]}`,
            student_id: parts[0],
            student_name: student?.name || '',
            samples: descriptors,
            enrolled_by: 'admin',
        });

        return { success: true, samples: descriptors.length };
    }],

    /* ------------------------------ attendance ------------------------------- */

    [/^\/api\/attendance\/unaccounted$/, () => {
        const marked = new Set(world.attendance.filter((a) => a.date === TODAY).map((a) => a.student_id));
        const missing = students().filter((s) => !marked.has(s.id));
        return {
            date: TODAY,
            class_id: null,
            count: missing.length,
            students: missing.slice(0, 50).map((s) => ({
                id: s.id, name: s.name, uid: s.uid, class_name: s.class_name,
            })),
        };
    }],

    [/^\/api\/attendance\/close$/, () => {
        const marked = new Set(world.attendance.filter((a) => a.date === TODAY).map((a) => a.student_id));
        const missing = students().filter((s) => !marked.has(s.id));

        missing.forEach((s) => {
            world.attendance.push({
                id: `at-${s.uid}-${TODAY}`, student_id: s.id, student_name: s.name,
                class_id: s.class_id, class_name: s.class_name,
                date: TODAY, status: 'absent', source: 'close',
            });
        });

        return { success: true, date: TODAY, marked: missing.length, notified: missing.length };
    }],

    [/^\/api\/attendance$/, ({ body }) => {
        const date = body?.date || TODAY;
        const classId = body?.class_id;
        world.attendance = world.attendance.filter((a) => !(a.class_id === classId && a.date === date));

        (body?.entries || []).forEach((entry: Row) => {
            const student = byId(world.users, entry.student_id);
            world.attendance.push({
                id: `at-${entry.student_id}-${date}`,
                student_id: entry.student_id,
                student_name: student?.name || '',
                class_id: classId,
                class_name: classNameOf(classId),
                date,
                status: entry.status,
                note: entry.note || '',
            });
        });

        return { success: true, recorded: (body?.entries || []).length, replaced: 0 };
    }],

    /* -------------------------------- homework -------------------------------- */

    [/^\/api\/homework$/, ({ method, body, query }) => {
        if (method === 'POST') {
            const row = {
                id: `hw-${Date.now()}`, ...body,
                class_name: classNameOf(body?.class_id),
                teacher_name: session?.name,
                createdAt: { seconds: Math.floor(Date.now() / 1000) },
            };
            world.homework.unshift(row);
            return { notified: 20 };
        }
        const classId = query.get('class_id');
        return page(world.homework.filter((h) => !classId || h.class_id === classId), query);
    }],

    [/^\/api\/homework\/([^/]+)$/, ({ parts }) => {
        world.homework = world.homework.filter((h) => h.id !== parts[0]);
        return { success: true };
    }],

    /* --------------------------------- exams ---------------------------------- */

    [/^\/api\/exams$/, ({ method, body }) => {
        if (method === 'POST') {
            world.exams.unshift({
                id: `ex-${Date.now()}`, ...body,
                class_name: classNameOf(body?.class_id),
                createdAt: { seconds: Math.floor(Date.now() / 1000) },
            });
            return { notified: 20 };
        }
        return world.exams.sort((a, b) => a.date.localeCompare(b.date));
    }],

    [/^\/api\/exams\/([^/]+)$/, ({ parts }) => {
        world.exams = world.exams.filter((e) => e.id !== parts[0]);
        return { success: true };
    }],

    /* --------------------------------- buses ----------------------------------- */

    [/^\/api\/buses$/, ({ method, body }) => {
        if (method === 'POST') {
            const row = { id: `b-${Date.now()}`, status: 'idle', status_text: 'Idle', stops: [], ...body };
            world.buses.push(row);
            return { success: true, id: row.id };
        }
        return world.buses.map((b) => ({
            ...b,
            riders: students().filter((s) => s.bus_id === b.id).length,
        }));
    }],

    [/^\/api\/buses\/([^/]+)\/students$/, ({ parts }) =>
        students().filter((s) => s.bus_id === parts[0]).map((s) => ({
            id: s.id, name: s.name, uid: s.uid, class_name: s.class_name, guardian_phone: s.guardian_phone,
        }))],

    [/^\/api\/admin\/buses\/([^/]+)\/status$/, ({ parts, body }) => {
        const bus = byId(world.buses, parts[0]);
        if (bus) {
            bus.status = body?.status || bus.status;
            bus.status_text = body?.status_text || String(body?.status || '').replace(/_/g, ' ');
        }
        return { success: true, notified: 12 };
    }],

    [/^\/api\/admin\/students\/([^/]+)\/bus$/, ({ parts, body }) => {
        const student = byId(world.users, parts[0]);
        if (student) student.bus_id = body?.bus_id || null;
        return { success: true };
    }],

    /* -------------------------------- behaviour --------------------------------- */

    [/^\/api\/behavior$/, ({ body }) => {
        const student = byId(world.users, body?.student_id);
        world.behavior.unshift({
            id: `bh-${Date.now()}`, ...body,
            student_name: student?.name || '',
            student_uid: student?.uid || '',
            points: body?.type === 'positive' ? (body?.points || 3) : -(body?.points || 3),
            created_by_name: session?.name,
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
        });
        return { success: true };
    }],

    [/^\/api\/behavior\/([^/]+)$/, ({ parts }) => {
        world.behavior = world.behavior.filter((b) => b.id !== parts[0]);
        return { success: true };
    }],

    /* --------------------------------- grades ----------------------------------- */

    [/^\/api\/grades$/, ({ body }) => {
        (body?.entries || [body]).forEach((entry: Row) => {
            const existing = world.grades.find(
                (g) => g.student_id === entry.student_id && g.subject === entry.subject && g.category === entry.category
            );
            if (existing) {
                existing.score = entry.score;
                existing.total = entry.total;
            } else {
                const student = byId(world.users, entry.student_id);
                world.grades.push({
                    id: `gr-${Date.now()}-${entry.student_id}`,
                    student_name: student?.name,
                    class_id: student?.class_id,
                    semester: 'First term',
                    ...entry,
                });
            }
        });
        return { success: true };
    }],

    /* --------------------------------- finance ----------------------------------- */

    [/^\/api\/admin\/finance\/summary$/, () => {
        const billed = world.invoices.reduce((s, i) => s + (i.amount - i.discount), 0);
        const paid = world.invoices.reduce((s, i) => s + i.paid_amount, 0);
        const withDues = students().filter((s) => financeFor(s.id).outstanding > 0).length;

        return {
            currency: 'IQD',
            total_billed: billed,
            total_collected: paid,
            outstanding: Math.max(0, billed - paid),
            invoice_count: world.invoices.length,
            paid_invoices: world.invoices.filter((i) => i.status === 'paid').length,
            overdue_invoices: world.invoices.filter((i) => i.due_date < TODAY && i.paid_amount < i.amount).length,
            students_with_dues: withDues,
            collection_rate: billed > 0 ? Math.round((paid / billed) * 100) : 100,
        };
    }],

    [/^\/api\/admin\/invoices\/([^/]+)\/payments$/, ({ parts, body }) => {
        const invoice = byId(world.invoices, parts[0]);
        if (!invoice) throw { status: 404, message: 'Invoice not found' };

        const amount = Number(body?.amount || 0);
        invoice.paid_amount = Math.min(invoice.amount, invoice.paid_amount + amount);
        invoice.remaining = Math.max(0, invoice.amount - invoice.discount - invoice.paid_amount);
        invoice.status = invoice.remaining === 0 ? 'paid' : invoice.paid_amount > 0 ? 'partial' : 'unpaid';

        world.payments.unshift({
            id: `pay-${Date.now()}`,
            invoice_id: invoice.id,
            student_id: invoice.student_id,
            student_name: invoice.student_name,
            amount,
            method: body?.method || 'Cash',
            paid_at: TODAY,
            receipt_no: `R-${Date.now().toString(36).toUpperCase()}`,
            recorded_by_name: session?.name,
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
        });

        return { success: true, receipt_no: `R-${Date.now().toString(36).toUpperCase()}` };
    }],

    [/^\/api\/admin\/invoices$/, ({ method, body, query }) => {
        if (method === 'POST') {
            const targets = body?.target === 'student'
                ? students().filter((s) => s.id === body?.student_id)
                : body?.target === 'class'
                    ? students().filter((s) => s.class_id === body?.class_id)
                    : students();

            targets.forEach((s) => {
                world.invoices.push({
                    id: `inv-${Date.now()}-${s.uid}`,
                    student_id: s.id, student_name: s.name, student_uid: s.uid,
                    class_id: s.class_id, class_name: s.class_name,
                    title: body?.title, category: body?.category || 'Tuition',
                    amount: Number(body?.amount || 0), discount: Number(body?.discount || 0),
                    paid_amount: 0, net_amount: Number(body?.amount || 0),
                    remaining: Number(body?.amount || 0),
                    currency: 'IQD', due_date: body?.due_date || null,
                    term: body?.term || 'First term', status: 'unpaid',
                    createdAt: { seconds: Math.floor(Date.now() / 1000) },
                });
            });

            return { success: true, created: targets.length };
        }

        const term = query.get('search') || '';
        const onlyDue = query.get('with_balance') === 'true';
        let rows: Row[] = world.invoices.map((i) => ({
            ...i,
            net_amount: i.amount - i.discount,
            remaining: Math.max(0, i.amount - i.discount - i.paid_amount),
        }));
        if (term) rows = rows.filter((i) => matchesTerm({ name: i.student_name, uid: i.student_uid, class_name: i.class_name }, term));
        if (onlyDue) rows = rows.filter((i) => i.remaining > 0);

        return page(rows, query);
    }],

    [/^\/api\/admin\/finance\/rebuild-totals$/, () => ({ success: true, students: students().length, invoices: world.invoices.length })],
    [/^\/api\/admin\/finance\/reminders$/, () => ({ sent: 0 })],

    /* ---------------------------------- office ------------------------------------ */

    [/^\/api\/admin\/students\/lookup$/, () =>
        students().map((s) => ({
            id: s.id, name: s.name, uid: s.uid,
            class_id: s.class_id, class_name: s.class_name, guardian_phone: s.guardian_phone,
        }))],

    [/^\/api\/admin\/students$/, ({ query }) => {
        const term = query.get('search') || '';
        const classId = query.get('class_id');
        let rows = students();
        if (classId) rows = rows.filter((s) => s.class_id === classId);
        if (term) rows = rows.filter((s) => matchesTerm(s, term));
        return page(rows, query);
    }],

    [/^\/api\/admin\/teachers$/, ({ query }) => page(world.users.filter((u) => u.role === 'teacher'), query)],
    [/^\/api\/admin\/assistants$/, () => world.users.filter((u) => u.role === 'assistant_admin')],
    [/^\/api\/admin\/uids$/, () => []],
    [/^\/api\/admin\/audit$/, () => world.audit],
    [/^\/api\/admin\/broadcast$/, () => ({ success: true, count: students().length })],

    [/^\/api\/admin\/absences\/daily$/, () =>
        world.attendance
            .filter((a) => a.date === TODAY && a.status === 'absent')
            .slice(0, 20)
            .map((a) => ({
                student_id: a.student_id, student_name: a.student_name,
                class_name: a.class_name, status: a.status, date: a.date,
                guardian_phone: byId(world.users, a.student_id)?.guardian_phone || '',
            }))],

    [/^\/api\/admin\/registrations\/([^/]+)\/approve$/, ({ parts }) => {
        const row = byId(world.registrations, parts[0]);
        if (row) { row.status = 'approved'; row.assigned_uid = String(20900 + world.registrations.indexOf(row)); }
        return { success: true, uid: row?.assigned_uid };
    }],

    [/^\/api\/admin\/registrations\/([^/]+)\/reject$/, ({ parts, body }) => {
        const row = byId(world.registrations, parts[0]);
        if (row) { row.status = 'rejected'; row.rejection_reason = body?.reason || ''; }
        return { success: true };
    }],

    [/^\/api\/admin\/registrations$/, ({ query }) => {
        const status = query.get('status') || 'pending';
        return page(world.registrations.filter((r) => r.status === status), query);
    }],

    [/^\/api\/admin\/users\/([^/]+)$/, ({ parts, method, body }) => {
        const user = byId(world.users, parts[0]);
        if (method === 'PUT' && user) Object.assign(user, body);
        return user ? publicUser(user) : null;
    }],
];

/* ------------------------------------------------------------------ *
 * The entry point the API layer calls
 * ------------------------------------------------------------------ */

export class DemoError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

/** Answer one request. Throws DemoError the way the real API returns one. */
export async function handle(method: string, url: string, body?: unknown): Promise<any> {
    const [rawPath, rawQuery] = url.split('?');
    const path = rawPath.replace(/\/$/, '');
    const query = new URLSearchParams(rawQuery || '');

    for (const [pattern, handler] of ROUTES) {
        const match = path.match(pattern);
        if (!match) continue;

        try {
            const result = handler({ parts: match.slice(1), query, body, method });
            return clone(result === undefined ? null : result);
        } catch (err: any) {
            throw new DemoError(err?.status || 500, err?.message || 'Something went wrong');
        }
    }

    // Anything this demo does not model answers empty rather than failing, so a
    // screen shows "nothing yet" instead of an error the visitor cannot act on.
    return null;
}

export { DEMO_ACCOUNTS };
