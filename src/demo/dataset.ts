/**
 * The school this demo invents.
 *
 * The real system runs on Firestore behind an Express API. This build has
 * neither: everything below is generated once, in the browser, and lives in
 * memory for as long as the tab is open. Writes work — mark a register, record
 * a payment, send a message — and a refresh puts the school back the way it
 * started, which is exactly what a public demo should do.
 *
 * The people are invented. No child's record appears anywhere in this build.
 */

/* ------------------------------------------------------------------ *
 * A small deterministic generator, so the demo looks the same to
 * everyone who opens it and screenshots stay honest.
 * ------------------------------------------------------------------ */

let seed = 20260911;
function rand(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
}
const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)];
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const FIRST = [
    'Omar', 'Yusuf', 'Kareem', 'Mustafa', 'Hassan', 'Ali', 'Ahmed', 'Zaid', 'Ibrahim', 'Bilal',
    'Layla', 'Noor', 'Sara', 'Maryam', 'Zainab', 'Hala', 'Dina', 'Rana', 'Lina', 'Aya',
    'Tariq', 'Samir', 'Nadir', 'Firas', 'Jamal', 'Rami', 'Basim', 'Adnan', 'Waleed', 'Fahad',
];
const LAST = [
    'Hassan', 'Karim', 'Nouri', 'Saleh', 'Aziz', 'Farouk', 'Mansour', 'Hadi', 'Rashid', 'Amin',
    'Jaber', 'Sultan', 'Darwish', 'Khalil', 'Marouf', 'Sabah', 'Taleb', 'Younis',
];

const name = () => `${pick(FIRST)} ${pick(LAST)}`;

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

export interface Row { [key: string]: any }

export interface World {
    users: Row[];
    classes: Row[];
    enrollments: Row[];
    subjects: Row[];
    schedules: Row[];
    periods: Row[];
    grades: Row[];
    attendance: Row[];
    behavior: Row[];
    invoices: Row[];
    payments: Row[];
    homework: Row[];
    exams: Row[];
    buses: Row[];
    conversations: Row[];
    messages: Row[];
    notifications: Row[];
    registrations: Row[];
    audit: Row[];
    gateEvents: Row[];
    faces: Row[];
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return iso(d);
};
const stamp = (secondsAgo: number) => ({ seconds: Math.floor(Date.now() / 1000) - secondsAgo });

export const TODAY = iso(today);

/* ------------------------------------------------------------------ *
 * The world
 * ------------------------------------------------------------------ */

const SUBJECT_NAMES = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Arabic', 'History', 'Computer Science',
];

const CLASS_NAMES = [
    'Grade 10 — A', 'Grade 10 — B', 'Grade 11 — Science', 'Grade 12 — Science',
];

/* The values the application itself stores; the interface translates them. */
const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

const SEMESTER = 'الفصل الأول';
const CATEGORIES = ['يومي', 'اختبار قصير', 'امتحان شهري', 'امتحان فصل'];

export function buildWorld(): World {
    seed = 20260911;

    const users: Row[] = [];
    const classes: Row[] = [];
    const enrollments: Row[] = [];
    const schedules: Row[] = [];
    const grades: Row[] = [];
    const attendance: Row[] = [];
    const behavior: Row[] = [];
    const invoices: Row[] = [];
    const payments: Row[] = [];
    const homework: Row[] = [];
    const exams: Row[] = [];
    const notifications: Row[] = [];
    const gateEvents: Row[] = [];
    const faces: Row[] = [];

    /* ------------------------------- staff ------------------------------- */

    users.push({
        id: 'u-admin', uid: 'ADMIN', username: 'ADMIN', role: 'admin', status: 'active',
        name: 'Adam Rashid', phone: '07700000001', email: 'office@demo.school',
    });

    users.push({
        id: 'u-assistant', uid: 'ASSIST', username: 'ASSIST', role: 'assistant_admin', status: 'active',
        name: 'Huda Nouri', phone: '07700000002',
    });

    const teachers: Row[] = SUBJECT_NAMES.map((subject, i) => ({
        id: `u-t${i + 1}`,
        uid: `T${100 + i}`,
        username: `T${100 + i}`,
        role: 'teacher',
        status: 'active',
        name: name(),
        subjects: [subject],
        phone: `0770000${1000 + i}`,
    }));
    users.push(...teachers);

    /* ------------------------------ classes ------------------------------ */

    CLASS_NAMES.forEach((className, i) => {
        classes.push({
            id: `c${i + 1}`,
            name: className,
            teacher_ids: teachers.slice(0, 5).map((t) => t.id),
            student_count: 0,
        });
    });

    /* ------------------------------ students ----------------------------- */

    const students: Row[] = [];
    let uidCounter = 20451;

    classes.forEach((klass, ci) => {
        const size = ci === 0 ? 18 : between(12, 16);
        for (let i = 0; i < size; i++) {
            const studentName = name();
            const uid = String(uidCounter++);
            const guardianPhone = `07${between(70, 79)}${between(1000000, 9999999)}`;

            const student: Row = {
                id: `s-${uid}`,
                uid,
                username: uid,
                role: 'student',
                status: 'active',
                name: studentName,
                class_id: klass.id,
                class_name: klass.name,
                guardian_name: `${pick(FIRST)} ${studentName.split(' ')[1]}`,
                guardian_phone: guardianPhone,
                guardian_relation: 'الأب',
                phone: `07${between(70, 79)}${between(1000000, 9999999)}`,
                birth_date: `${between(2007, 2010)}-0${between(1, 9)}-1${between(0, 9)}`,
                address: `${pick(['Al-Andalus', 'Al-Mansour', 'Karrada', 'Zayouna'])} district`,
                bus_id: rand() > 0.6 ? `b${between(1, 2)}` : null,
            };

            students.push(student);
            users.push(student);
            enrollments.push({ id: `e-${uid}`, student_id: student.id, class_id: klass.id });
        }
        klass.student_count = size;
    });

    /* ----------------------------- guardians ----------------------------- */

    const guardians: Row[] = [];
    // One parent per student, except two families that have a second child here.
    students.forEach((student, i) => {
        if (i > 0 && i % 17 === 0) {
            // Attach this child to the previous parent instead: a family of two.
            const previous = guardians[guardians.length - 1];
            previous.student_ids.push(student.id);
            return;
        }

        const guardian: Row = {
            id: `g-${student.uid}`,
            uid: student.guardian_phone,
            username: student.guardian_phone,
            role: 'guardian',
            status: 'active',
            name: student.guardian_name,
            phone: student.guardian_phone,
            guardian_phone: student.guardian_phone,
            student_ids: [student.id],
        };
        guardians.push(guardian);
        users.push(guardian);
    });

    /* ------------------------------ timetable ----------------------------- */

    const periods = [
        { id: 'p1', index: 1, label: 'الحصة الأولى', time: '08:00 - 08:45', start: '08:00', end: '08:45' },
        { id: 'p2', index: 2, label: 'الحصة الثانية', time: '08:50 - 09:35', start: '08:50', end: '09:35' },
        { id: 'p3', index: 3, label: 'الحصة الثالثة', time: '09:40 - 10:25', start: '09:40', end: '10:25' },
        { id: 'p4', index: 4, label: 'الحصة الرابعة', time: '10:45 - 11:30', start: '10:45', end: '11:30' },
        { id: 'p5', index: 5, label: 'الحصة الخامسة', time: '11:35 - 12:20', start: '11:35', end: '12:20' },
        { id: 'p6', index: 6, label: 'الحصة السادسة', time: '12:25 - 13:10', start: '12:25', end: '13:10' },
    ];

    classes.forEach((klass) => {
        DAYS.forEach((day) => {
            periods.forEach((period, pi) => {
                const subject = SUBJECT_NAMES[(pi + DAYS.indexOf(day)) % SUBJECT_NAMES.length];
                const teacher = teachers.find((t) => t.subjects[0] === subject)!;
                schedules.push({
                    id: `sc-${klass.id}-${day}-${period.index}`,
                    class_id: klass.id,
                    class_name: klass.name,
                    day,
                    // The timetable reads one "time" string, not a pair.
                    time: `${period.start} - ${period.end}`,
                    period: period.index,
                    subject,
                    teacher_id: teacher.id,
                    teacher: teacher.name,
                    teacher_name: teacher.name,
                    room: `Room ${101 + (pi % 6)}`,
                });
            });
        });
    });

    /* -------------------------------- marks ------------------------------- */

    students.forEach((student) => {
        // A believable student is good at some subjects and not others.
        const bias = between(-12, 14);
        SUBJECT_NAMES.slice(0, 6).forEach((subject) => {
            const base = Math.max(35, Math.min(98, between(55, 92) + bias));
            for (const category of CATEGORIES.slice(0, between(2, 4))) {
                const total = category === 'يومي' ? 20 : category === 'اختبار قصير' ? 25 : 100;
                const ratio = Math.max(0.3, Math.min(1, (base + between(-8, 8)) / 100));
                grades.push({
                    id: `gr-${student.uid}-${subject}-${category}`,
                    student_id: student.id,
                    student_name: student.name,
                    class_id: student.class_id,
                    subject,
                    category,
                    semester: SEMESTER,
                    score: Math.round(total * ratio),
                    total,
                });
            }
        });
    });

    /* ------------------------------ attendance ----------------------------- */

    // The last thirty days, weekends skipped.
    for (let back = 30; back >= 0; back--) {
        const date = shift(-back);
        const weekday = new Date(date).getDay();
        if (weekday === 5 || weekday === 6) continue;

        students.forEach((student) => {
            const roll = rand();
            // Most days most children are simply present.
            const status = roll > 0.94 ? 'absent' : roll > 0.90 ? 'late' : roll > 0.885 ? 'excused' : 'present';

            // Today is deliberately half-finished, so "close the register" has
            // something real to do when a visitor presses it.
            if (back === 0 && rand() > 0.72) return;

            attendance.push({
                id: `at-${student.uid}-${date}`,
                student_id: student.id,
                student_name: student.name,
                class_id: student.class_id,
                class_name: student.class_name,
                date,
                status,
                source: back === 0 && rand() > 0.5 ? 'gate' : 'teacher',
            });
        });
    }

    /* ------------------------------- conduct ------------------------------- */

    const POSITIVE: [string, string][] = [
        ['Outstanding participation in class', 'مشاركة فعالة'],
        ['Helped a classmate catch up', 'مساعدة الزملاء'],
        ['Top mark in the monthly exam', 'تفوق دراسي'],
        ['Represented the school at the science fair', 'مشاركة فعالة'],
    ];
    const NEGATIVE: [string, string][] = [
        ['Late to the first lesson', 'تأخر متكرر'],
        ['Homework not submitted', 'عدم أداء الواجبات'],
        ['Talking during the lesson', 'إزعاج داخل الصف'],
        ['Phone used in class', 'مخالفة سلوكية'],
    ];

    students.forEach((student) => {
        const count = between(1, 3);
        for (let i = 0; i < count; i++) {
            const positive = rand() > 0.4;
            const [title, category] = pick(positive ? POSITIVE : NEGATIVE);
            behavior.push({
                id: `bh-${student.uid}-${i}`,
                student_id: student.id,
                student_name: student.name,
                student_uid: student.uid,
                class_id: student.class_id,
                type: positive ? 'positive' : 'negative',
                category,
                title,
                description: '',
                points: positive ? between(1, 5) : -between(1, 5),
                date: shift(-between(1, 25)),
                created_by_name: pick(teachers).name,
                createdAt: stamp(between(3600, 600000)),
            });
        }
    });

    /* -------------------------------- fees --------------------------------- */

    students.forEach((student) => {
        const terms = [
            { title: 'القسط الأول', due: shift(-between(5, 30)), amount: 500000 },
            { title: 'القسط الثاني', due: shift(between(5, 25)), amount: 500000 },
        ];

        terms.forEach((term, i) => {
            const roll = rand();
            const paid = i === 0
                ? (roll > 0.12 ? term.amount : Math.round(term.amount * 0.5))
                : (roll > 0.7 ? term.amount : roll > 0.4 ? Math.round(term.amount * 0.4) : 0);

            const status = paid >= term.amount ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

            const invoice: Row = {
                id: `inv-${student.uid}-${i}`,
                student_id: student.id,
                student_name: student.name,
                student_uid: student.uid,
                class_id: student.class_id,
                class_name: student.class_name,
                title: term.title,
                category: 'قسط دراسي',
                amount: term.amount,
                discount: 0,
                paid_amount: paid,
                net_amount: term.amount,
                remaining: term.amount - paid,
                currency: 'IQD',
                due_date: term.due,
                term: i === 0 ? 'الفصل الأول' : 'الفصل الثاني',
                academic_year: '2026/2027',
                status,
                createdAt: stamp(between(600000, 3000000)),
            };
            invoices.push(invoice);

            if (paid > 0) {
                payments.push({
                    id: `pay-${student.uid}-${i}`,
                    invoice_id: invoice.id,
                    student_id: student.id,
                    student_name: student.name,
                    amount: paid,
                    method: pick(['نقداً', 'تحويل']),
                    paid_at: term.due,
                    receipt_no: `R-${student.uid}${i}`,
                    recorded_by_name: 'Huda Nouri',
                    createdAt: stamp(between(100000, 900000)),
                });
            }
        });

        const billed = terms.reduce((s, t) => s + t.amount, 0);
        const collected = invoices
            .filter((inv) => inv.student_id === student.id)
            .reduce((s, inv) => s + inv.paid_amount, 0);

        student.fees_billed = billed;
        student.fees_paid = collected;
        student.fees_next_due = invoices
            .filter((inv) => inv.student_id === student.id && inv.remaining > 0)
            .map((inv) => inv.due_date)
            .sort()[0] || null;
    });

    /* ------------------------------- homework ------------------------------- */

    const TASKS: [string, string][] = [
        ['Exercises 3.1 – 3.8', 'Mathematics'],
        ['Lab report: refraction', 'Physics'],
        ['Unit 4 — writing task', 'English'],
        ['Periodic table revision', 'Chemistry'],
        ['Essay: the Abbasid era', 'History'],
        ['Build a to-do app in HTML', 'Computer Science'],
    ];

    classes.forEach((klass) => {
        TASKS.slice(0, between(3, 6)).forEach(([title, subject], i) => {
            const teacher = teachers.find((t) => t.subjects[0] === subject)!;
            homework.push({
                id: `hw-${klass.id}-${i}`,
                class_id: klass.id,
                class_name: klass.name,
                subject,
                title,
                description: '',
                due_date: shift(between(1, 12)),
                created_by: teacher.id,
                teacher_name: teacher.name,
                createdAt: stamp(between(3600, 400000)),
            });
        });
    });

    /* -------------------------------- exams --------------------------------- */

    classes.forEach((klass) => {
        ['Physics', 'Chemistry', 'Mathematics'].forEach((subject, i) => {
            exams.push({
                id: `ex-${klass.id}-${i}`,
                class_id: klass.id,
                class_name: klass.name,
                subject,
                kind: pick(['امتحان شهري', 'اختبار قصير', 'امتحان فصلي']),
                date: shift(between(3, 20)),
                time: pick(['09:00', '10:45', '11:35']),
                createdAt: stamp(between(3600, 200000)),
            });
        });
    });

    /* -------------------------------- buses --------------------------------- */

    const buses: Row[] = [
        {
            id: 'b1',
            name: 'East line — 7',
            driver_name: 'Abu Ali',
            driver_phone: '07701234567',
            plate: 'BGD 4471',
            departure_time: '06:50',
            return_time: '13:40',
            stops: ['Al-Andalus square', 'Palestine street', 'Zayouna'],
            status: 'on_route',
            status_text: 'في الطريق',
        },
        {
            id: 'b2',
            name: 'West line — 3',
            driver_name: 'Abu Kareem',
            driver_phone: '07709876543',
            plate: 'BGD 8892',
            departure_time: '06:40',
            return_time: '13:45',
            stops: ['Al-Mansour', 'Yarmouk', 'Al-Jamia'],
            status: 'at_school',
            status_text: 'وصل المدرسة',
        },
    ];

    /* ------------------------------- messages ------------------------------- */

    const conversations: Row[] = [];
    const messages: Row[] = [];

    const firstGuardian = guardians[0];
    const firstChild = students.find((s) => s.id === firstGuardian.student_ids[0])!;
    const mathTeacher = teachers.find((t) => t.subjects[0] === 'Mathematics')!;

    conversations.push({
        id: 'cv1',
        pair_key: 'cv1',
        participant_ids: [firstGuardian.id, mathTeacher.id],
        participants: {
            [firstGuardian.id]: { name: firstGuardian.name, role: 'guardian' },
            [mathTeacher.id]: { name: mathTeacher.name, role: 'teacher' },
        },
        student_id: firstChild.id,
        student_name: firstChild.name,
        last_message: `${firstChild.name.split(' ')[0]} is doing very well in mathematics.`,
        last_at: stamp(900),
        unread: { [firstGuardian.id]: 2, [mathTeacher.id]: 0 },
    });

    messages.push(
        {
            id: 'm1', conversation_id: 'cv1', sender_id: mathTeacher.id, sender_name: mathTeacher.name,
            sender_role: 'teacher', body: 'Good morning — I wanted to say your son took part very well today.',
            createdAt: stamp(90000),
        },
        {
            id: 'm2', conversation_id: 'cv1', sender_id: firstGuardian.id, sender_name: firstGuardian.name,
            sender_role: 'guardian', body: 'Thank you. How is he finding the new term?',
            createdAt: stamp(3600),
        },
        {
            id: 'm3', conversation_id: 'cv1', sender_id: mathTeacher.id, sender_name: mathTeacher.name,
            sender_role: 'teacher', body: `${firstChild.name.split(' ')[0]} is doing very well in mathematics.`,
            createdAt: stamp(900),
        },
    );

    conversations.push({
        id: 'cv2',
        pair_key: 'cv2',
        participant_ids: [firstGuardian.id, 'u-admin'],
        participants: {
            [firstGuardian.id]: { name: firstGuardian.name, role: 'guardian' },
            'u-admin': { name: 'Adam Rashid', role: 'admin' },
        },
        student_id: firstChild.id,
        student_name: firstChild.name,
        last_message: 'A reminder that the second instalment is due this month.',
        last_at: stamp(86400),
        unread: { [firstGuardian.id]: 1, 'u-admin': 0 },
    });

    messages.push({
        id: 'm4', conversation_id: 'cv2', sender_id: 'u-admin', sender_name: 'Adam Rashid',
        sender_role: 'admin', body: 'A reminder that the second instalment is due this month.',
        createdAt: stamp(86400),
    });

    /*
     * A few more, so whichever role a visitor picks the inbox has something in
     * it. An empty messages screen reads as a feature that does not work rather
     * than as a quiet week.
     */
    const englishTeacher = teachers.find((t) => t.subjects[0] === 'English')!;
    const secondChild = students.find((s) => firstGuardian.student_ids.includes(s.id) && s.id !== firstChild.id);

    const thread = (
        id: string,
        a: Row,
        b: Row,
        about: Row | undefined,
        lines: [Row, string, number][],
        unreadFor?: string
    ) => {
        const last = lines[lines.length - 1];
        conversations.push({
            id,
            pair_key: id,
            participant_ids: [a.id, b.id],
            participants: {
                [a.id]: { name: a.name, role: a.role },
                [b.id]: { name: b.name, role: b.role },
            },
            student_id: about?.id || null,
            student_name: about?.name || null,
            last_message: last[1],
            last_at: stamp(last[2]),
            unread: unreadFor ? { [unreadFor]: 1 } : {},
        });

        lines.forEach(([sender, body, ago], i) => {
            messages.push({
                id: id + '-m' + i,
                conversation_id: id,
                sender_id: sender.id,
                sender_name: sender.name,
                sender_role: sender.role,
                body,
                createdAt: stamp(ago),
            });
        });
    };

    if (secondChild) {
        thread('cv3', firstGuardian, englishTeacher, secondChild, [
            [firstGuardian, `Good evening. Has ${secondChild.name.split(' ')[0]} handed in the writing task?`, 200000],
            [englishTeacher, 'Not yet — the deadline is Thursday, so there is still time.', 180000],
            [firstGuardian, 'Understood, thank you. I will make sure it is done.', 172000],
        ]);
    }

    const scienceTeacher = teachers.find((t) => t.subjects[0] === 'Chemistry')!;
    const secondGuardian = guardians[3];
    const secondGuardianChild = students.find((s) => s.id === secondGuardian?.student_ids[0]);

    if (secondGuardian && secondGuardianChild) {
        thread('cv4', scienceTeacher, secondGuardian, secondGuardianChild, [
            [
                scienceTeacher,
                `${secondGuardianChild.name.split(' ')[0]} missed the lab session on Tuesday. Is everything alright?`,
                150000,
            ],
            [secondGuardian, 'He had a doctor\'s appointment. I sent a note with him.', 140000],
            [scienceTeacher, 'Thank you — I have marked it as excused.', 138000],
        ], scienceTeacher.id);
    }

    thread('cv5', teachers[0], { id: 'u-admin', name: 'Adam Rashid', role: 'admin' } as Row, undefined, [
        [teachers[0], 'The projector in Room 103 is still not working.', 260000],
        [
            { id: 'u-admin', name: 'Adam Rashid', role: 'admin' } as Row,
            'Maintenance are coming on Sunday morning. Use Room 105 until then.',
            250000,
        ],
    ]);

    /* ----------------------------- notifications ---------------------------- */

    const notifyFor = (userId: string, rows: [string, string, string, number][]) => {
        rows.forEach(([title, message, type, ago], i) => {
            notifications.push({
                id: `n-${userId}-${i}`,
                user_id: userId,
                title,
                message,
                type,
                isRead: i > 1,
                createdAt: stamp(ago),
            });
        });
    };

    notifyFor(firstGuardian.id, [
        ['Arrived at school', `${firstChild.name} entered the school at 07:42.`, 'gate', 5400],
        ['New message', `Message from ${mathTeacher.name}`, 'message', 900],
        ['Fees reminder', 'The second instalment is due in two weeks.', 'finance', 172800],
        ['Conduct note', `Outstanding participation — ${firstChild.name}`, 'behavior', 260000],
    ]);

    notifyFor(firstChild.id, [
        ['New homework', 'Mathematics — Exercises 3.1 – 3.8', 'homework', 7200],
        ['Exam scheduled', 'Physics — Monthly exam', 'exam', 90000],
        ['Conduct note', 'Outstanding participation 🌟', 'behavior', 260000],
    ]);

    notifyFor('u-admin', [
        ['New application', 'A new registration is waiting for review.', 'registration', 3600],
        ['Payment recorded', 'IQD 500,000 received on First instalment.', 'payment', 60000],
    ]);

    notifyFor(mathTeacher.id, [
        ['New message', `Message from ${firstGuardian.name}`, 'message', 3600],
    ]);

    /* ------------------------------ the gate -------------------------------- */

    students.slice(0, 22).forEach((student, i) => {
        gateEvents.push({
            id: `ge-${i}`,
            student_id: student.id,
            student_name: student.name,
            class_id: student.class_id,
            class_name: student.class_name,
            direction: 'in',
            method: i % 3 === 0 ? 'face' : 'barcode',
            date: TODAY,
            at: stamp(3000 + i * 45),
        });
    });

    // A few students already have a face on file.
    students.slice(0, 9).forEach((student, i) => {
        faces.push({
            id: `f-${student.uid}`,
            student_id: student.id,
            student_name: student.name,
            student_uid: student.uid,
            samples: [],
            enrolled_by: i % 3 === 0 ? 'student' : 'admin',
        });
    });

    /* ---------------------------- registrations ------------------------------ */

    const registrations: Row[] = [0, 1, 2].map((i) => ({
        id: `reg-${i}`,
        request_number: `REQ-${4100 + i}`,
        name: name(),
        national_id: `199${between(100000, 999999)}`,
        mother_name: name(),
        birth_date: `2010-0${between(1, 9)}-1${between(0, 9)}`,
        birth_place: 'Baghdad',
        gender: 'male',
        nationality: 'Iraqi',
        phone: `077${between(1000000, 9999999)}`,
        guardian_name: name(),
        guardian_phone: `077${between(1000000, 9999999)}`,
        guardian_relation: 'الأب',
        previous_school: 'Al-Noor Primary',
        address: 'Al-Mansour district',
        status: 'pending',
        createdAt: stamp(between(3600, 300000)),
    }));

    /* -------------------------------- audit ---------------------------------- */

    const audit: Row[] = [
        ['login', 'Adam Rashid signed in', 'admin', 600],
        ['payment', 'Recorded IQD 500,000 on First instalment', 'assistant_admin', 60000],
        ['approve', 'Approved a registration', 'admin', 90000],
        ['attendance', 'Closed the register for yesterday — 9 absent', 'admin', 100000],
        ['update', 'Enrolled a face for a student', 'admin', 150000],
    ].map(([action, summary, role, ago], i) => ({
        id: `au-${i}`,
        action,
        entity: 'system',
        summary,
        actor_name: role === 'admin' ? 'Adam Rashid' : 'Huda Nouri',
        actor_role: role,
        createdAt: stamp(ago as number),
    }));

    return {
        users, classes, enrollments,
        subjects: SUBJECT_NAMES.map((n, i) => ({ id: `sub${i}`, name: n })),
        schedules, periods, grades, attendance, behavior, invoices, payments,
        homework, exams, buses, conversations, messages, notifications,
        registrations, audit, gateEvents, faces,
    };
}

/** The four accounts the demo's sign-in page offers. */
export const DEMO_ACCOUNTS = [
    { role: 'admin', id: 'u-admin', label: 'Administrator', blurb: 'Runs the school: applications, finance, reports, the gate' },
    { role: 'teacher', id: 'u-t1', label: 'Teacher', blurb: 'Marks, homework, conduct and the register for their classes' },
    { role: 'student', id: '', label: 'Student', blurb: 'Their own marks, attendance, homework, fees and gate card' },
    { role: 'guardian', id: '', label: 'Parent', blurb: 'Follows their child and messages the school' },
] as const;
