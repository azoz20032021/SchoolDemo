import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Check, Clock, FileWarning, Lock, TriangleAlert, X } from 'lucide-react';
import { ClassData } from '../../types';
import { api, ApiError } from '../../lib/api';
import { Card, EmptyState, ErrorBanner, Modal, Spinner, inputClass } from '../../components/ui';
import { t } from '../../i18n';

interface Unaccounted {
    date: string;
    count: number;
    students: { id: string; name: string; uid: string; class_name: string }[];
}

/**
 * Taking the register from the office.
 *
 * Teachers record their own classes from their dashboard, but when one is away
 * — or has simply forgotten — nobody could record or correct the day at all.
 * The admin can now do it for any class. Like the teacher's screen this is
 * today's register only, deliberately: a day's attendance is a statement about
 * a day somebody was there for.
 *
 * Unlike the teacher's screen it loads what has already been recorded, so
 * opening it to fix one pupil does not silently mark the rest present.
 */

const STATUSES = [
    { key: 'present', label: 'حاضر', icon: Check, tone: 'bg-emerald-600 border-emerald-600' },
    { key: 'absent', label: 'غائب', icon: X, tone: 'bg-rose-600 border-rose-600' },
    { key: 'late', label: 'متأخر', icon: Clock, tone: 'bg-amber-500 border-amber-500' },
    { key: 'excused', label: 'بعذر', icon: FileWarning, tone: 'bg-slate-500 border-slate-500' },
] as const;

type Status = (typeof STATUSES)[number]['key'];

interface Student {
    id: string;
    name: string;
    uid: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export const Attendance: React.FC = () => {
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState<Student[]>([]);
    const [marks, setMarks] = useState<Record<string, Status>>({});
    const [alreadyRecorded, setAlreadyRecorded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingClass, setLoadingClass] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const loadClass = useCallback(async (classId: string) => {
        if (!classId) { setStudents([]); return; }
        setLoadingClass(true);
        setError('');
        try {
            const [roster, recorded] = await Promise.all([
                api.get<Student[]>(`/api/class/${classId}/students`),
                api.get<{ student_id: string; status: Status }[]>(
                    `/api/class/${classId}/attendance?date=${today()}`
                ).catch(() => []),
            ]);

            setStudents(roster);

            // Start from what is already on record; anyone not yet marked is
            // present, which is the common case and the fastest to correct.
            const existing = new Map<string, Status>(recorded.map((row) => [row.student_id, row.status] as const));
            const next: Record<string, Status> = {};
            roster.forEach((student) => { next[student.id] = existing.get(student.id) || 'present'; });

            setMarks(next);
            setAlreadyRecorded(recorded.length > 0);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تحميل قائمة الطلاب'));
            setStudents([]);
        } finally {
            setLoadingClass(false);
        }
    }, []);

    useEffect(() => {
        api.get<ClassData[]>('/api/classes')
            .then(async (list) => {
                setClasses(list);
                if (list.length > 0) {
                    setSelectedClass(list[0].id);
                    await loadClass(list[0].id);
                }
            })
            .catch((err) => setError(err instanceof ApiError ? err.message : t('تعذر تحميل الصفوف')))
            .finally(() => setLoading(false));
    }, [loadClass]);

    const setAll = (status: Status) => {
        setMarks(Object.fromEntries(students.map((s) => [s.id, status])) as Record<string, Status>);
    };

    const submit = async () => {
        if (!selectedClass || students.length === 0) return;
        setBusy(true);
        setError('');
        try {
            await api.post('/api/attendance', {
                classId: selectedClass,
                date: today(),
                attendanceData: students.map((s) => ({ studentId: s.id, status: marks[s.id] || 'present' })),
            });
            setAlreadyRecorded(true);
            alert(t('تم تسجيل الحضور بنجاح'));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تسجيل الحضور'));
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <div className="p-6"><Spinner label={t('جاري التحميل')} /></div>;

    const counts = STATUSES.map((s) => ({
        ...s,
        count: students.filter((student) => (marks[student.id] || 'present') === s.key).length,
    }));

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-3xl lg:max-w-5xl mx-auto">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('تسجيل الحضور')}</h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {t('حضور اليوم')} · <span dir="ltr">{today()}</span>
                    </p>
                </div>
                <select
                    className={`${inputClass} w-full sm:w-auto sm:min-w-48`}
                    value={selectedClass}
                    onChange={(e) => { setSelectedClass(e.target.value); loadClass(e.target.value); }}
                >
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

            <CloseRegister />

            {alreadyRecorded && (
                <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    {t('سُجّل حضور هذا الصف اليوم — الحفظ يستبدل التسجيل السابق.')}
                </p>
            )}

            {loadingClass ? (
                <Spinner label={t('جاري تحميل قائمة الطلاب')} />
            ) : students.length === 0 ? (
                <Card><EmptyState message={t('لا يوجد طلاب في هذا الصف')} /></Card>
            ) : (
                <>
                    <Card className="p-3">
                        <div className="grid grid-cols-4 gap-2">
                            {counts.map((s) => (
                                <button
                                    key={s.key}
                                    onClick={() => setAll(s.key)}
                                    className="rounded-xl border border-slate-100 bg-slate-50 py-2 text-center hover:border-brand-200 transition-colors"
                                    title={t('تعليم الجميع')}
                                >
                                    <p className="text-sm font-black text-slate-800">{s.count}</p>
                                    <p className="text-[10px] font-bold text-slate-400">{t(s.label)}</p>
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-2 text-center">
                            {t('اضغط على أي حالة لتعليم جميع الطلاب بها')}
                        </p>
                    </Card>

                    <Card className="divide-y divide-slate-50">
                        {students.map((student) => (
                            <div key={student.id} className="p-3 flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black text-slate-800 truncate">{student.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{student.uid}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    {STATUSES.map((s) => {
                                        const Icon = s.icon;
                                        const active = (marks[student.id] || 'present') === s.key;
                                        return (
                                            <button
                                                key={s.key}
                                                onClick={() => setMarks((m) => ({ ...m, [student.id]: s.key }))}
                                                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
                                                    active ? `${s.tone} text-white` : 'bg-white border-slate-200 text-slate-300 hover:text-slate-500'
                                                }`}
                                                aria-label={t(s.label)}
                                                title={t(s.label)}
                                            >
                                                <Icon className="w-4 h-4" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </Card>

                    <button
                        onClick={submit}
                        disabled={busy}
                        className="w-full bg-gradient-to-l from-brand-700 to-brand-500 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-brand-700/30 active:scale-[0.99] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        <CalendarCheck className="w-4 h-4" />
                        {busy ? t('جاري الحفظ...') : t('حفظ الحضور')}
                    </button>
                </>
            )}
        </div>
    );
};

/* ------------------------------------------------------------------ *
 * Closing the day
 * ------------------------------------------------------------------ */

/**
 * The button the office presses when the morning is over.
 *
 * Until now an absence was the *absence* of a record rather than a record: the
 * gate wrote down who arrived and the teachers wrote down their own classes,
 * and a child who simply never came left no trace anywhere and no parent was
 * told. Making absent the default instead would be worse — every child would
 * show as absent from midnight until something proved otherwise, and their
 * families would spend each morning reading a lie. So the school says when the
 * morning is over, and everyone still unaccounted for is marked absent at that
 * moment, once.
 *
 * The count is fetched before the button does anything, because "this will mark
 * 34 students absent" is the only way for the person pressing it to notice that
 * the gate tablet was switched off, or that two teachers have not submitted
 * yet — and to stop, instead of telling thirty families their sons never
 * arrived.
 */
const CloseRegister: React.FC = () => {
    const [pending, setPending] = useState<Unaccounted | null>(null);
    const [asking, setAsking] = useState(false);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ marked: number; notified: number } | null>(null);
    const [error, setError] = useState('');

    const check = useCallback(async () => {
        setError('');
        try {
            setPending(await api.get<Unaccounted>('/api/attendance/unaccounted'));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر حساب الغياب'));
        }
    }, []);

    useEffect(() => { check(); }, [check]);

    const close = async () => {
        setBusy(true);
        setError('');
        try {
            const res = await api.post<{ marked: number; notified: number }>('/api/attendance/close', {});
            setDone(res);
            setAsking(false);
            check();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر إغلاق الحضور'));
        } finally {
            setBusy(false);
        }
    };

    if (done) {
        return (
            <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-xs font-black text-emerald-800 leading-relaxed">
                    {t('تم إغلاق حضور اليوم')} — {done.marked} {t('غائب')}
                    {done.notified > 0 ? ` · ${done.notified} ${t('إشعار لأولياء الأمور')}` : ''}
                </p>
            </div>
        );
    }

    if (!pending) return null;

    return (
        <>
            <div className="bg-white ring-1 ring-slate-900/[0.06] rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)]">
                <div className="w-11 h-11 rounded-2xl bg-brand-50 ring-1 ring-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900">{t('إغلاق حضور اليوم')}</p>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5 leading-snug">
                        {pending.count === 0
                            ? t('كل الطلاب مسجّلون — لا يوجد من يُحتسب غائباً')
                            : `${pending.count} ${t('طالب لم يُسجَّل لهم حضور بعد — سيُحتسبون غائبين ويُبلَّغ أولياؤهم')}`}
                    </p>
                </div>

                <button
                    onClick={() => setAsking(true)}
                    disabled={pending.count === 0}
                    className="w-full sm:w-auto bg-brand-900 text-white px-5 py-2.5 rounded-xl text-xs font-black disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                    {t('إغلاق الحضور')}
                </button>
            </div>

            {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

            <Modal
                open={asking}
                onClose={() => setAsking(false)}
                title={t('إغلاق حضور اليوم')}
                subtitle={t('راجع القائمة قبل التأكيد')}
            >
                <div className="space-y-4">
                    <div className="bg-amber-50 ring-1 ring-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                        <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                            {t('سيُسجَّل')} <span className="font-black">{pending.count}</span>{' '}
                            {t('طالباً غائبين، وسيصل إشعار لكل ولي أمر. إذا كان الرقم أكبر من المتوقع فتأكد أن تابلت البوابة كان يعمل وأن المدرّسين سجّلوا صفوفهم.')}
                        </p>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 ring-1 ring-slate-900/[0.06] rounded-2xl">
                        {pending.students.map((student) => (
                            <div key={student.id} className="px-3.5 py-2.5 flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-slate-800 truncate">{student.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 truncate">{student.class_name}</p>
                                </div>
                                <span className="text-[10px] font-black text-slate-400 tabular shrink-0" dir="ltr">
                                    {student.uid}
                                </span>
                            </div>
                        ))}
                        {pending.count > pending.students.length && (
                            <p className="px-3.5 py-2.5 text-[10px] font-bold text-slate-400 text-center">
                                {t('و{count} طالباً آخرين', { count: pending.count - pending.students.length })}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={close}
                        disabled={busy}
                        className="w-full bg-brand-900 text-white py-3.5 rounded-xl text-sm font-black disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        <Lock className="w-4 h-4" />
                        {busy ? t('جاري التسجيل...') : `${t('تأكيد — تسجيل')} ${pending.count} ${t('غائباً')}`}
                    </button>
                </div>
            </Modal>
        </>
    );
};
