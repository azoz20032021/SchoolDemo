import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Plus, Trash2, User } from 'lucide-react';
import { UserData, ClassData } from '../types';
import { api, ApiError } from '../lib/api';
import { isAdmin, isStaff } from '../context/AuthContext';
import { Card, ErrorBanner, Modal, Spinner, inputClass, labelClass } from '../components/ui';
import { t } from '../i18n';

/**
 * The weekly timetable, as a timetable.
 *
 * It used to be a day picker over a list of cards: to see Tuesday you left
 * Monday, and nobody could look at the week at once — which is the entire point
 * of a school timetable. It is now a grid of periods against days. Staff fill an
 * empty cell by tapping it, and teachers and students read the same grid, with a
 * teacher's own lessons highlighted.
 */

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

interface Period {
    label: string;
    time: string;
}

/**
 * Shown only if the school's own bell times cannot be fetched. The real list
 * lives in the database and the admin edits it from this screen.
 */
const FALLBACK_PERIODS: Period[] = [
    { label: 'الحصة الأولى', time: '08:00' },
    { label: 'الحصة الثانية', time: '08:45' },
    { label: 'الحصة الثالثة', time: '09:30' },
    { label: 'الحصة الرابعة', time: '10:30' },
    { label: 'الحصة الخامسة', time: '11:15' },
    { label: 'الحصة السادسة', time: '12:00' },
    { label: 'الحصة السابعة', time: '12:45' },
];

const FALLBACK_SUBJECTS = [
    'الرياضيات', 'اللغة العربية', 'اللغة الإنجليزية', 'الأحياء', 'الفيزياء',
    'الكيمياء', 'الحاسوب', 'التاريخ', 'الجغرافيا', 'الفنية', 'الرياضة',
];

interface Session {
    id: string;
    class_id: string;
    day: string;
    time: string;
    subject: string;
    teacher?: string;
    room?: string;
}

/** Cell colours cycle by subject so the same lesson looks the same all week. */
const TONES = [
    'bg-brand-50 border-brand-100 text-brand-900',
    'bg-emerald-50 border-emerald-100 text-emerald-900',
    'bg-amber-50 border-amber-100 text-amber-900',
    'bg-rose-50 border-rose-100 text-rose-900',
    'bg-cyan-50 border-cyan-100 text-cyan-900',
    'bg-purple-50 border-purple-100 text-purple-900',
];

function toneFor(subject: string): string {
    let sum = 0;
    for (const ch of subject) sum += ch.charCodeAt(0);
    return TONES[sum % TONES.length];
}

export const Schedule: React.FC<{ user: UserData }> = ({ user }) => {
    const canEdit = isStaff(user.role);

    const [classes, setClasses] = useState<ClassData[]>([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [subjects, setSubjects] = useState<string[]>(FALLBACK_SUBJECTS);
    const [periods, setPeriods] = useState<Period[]>(FALLBACK_PERIODS);
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    /** The slot being filled: which day and which period. */
    const [slot, setSlot] = useState<{ day: string; time: string } | null>(null);
    /** The bell-times editor, and the draft being edited in it. */
    const [showPeriods, setShowPeriods] = useState(false);
    const [draftPeriods, setDraftPeriods] = useState<Period[]>([]);
    /**
     * Phones show one day at a time, opening on today. getDay() counts from
     * Sunday, which is exactly how the Iraqi school week is ordered, so the
     * index lines up; Friday and Saturday fall off the end and open on Sunday.
     */
    const [activeDay, setActiveDay] = useState(() => DAYS[new Date().getDay()] ?? DAYS[0]);
    const [form, setForm] = useState({ subject: '', teacher_id: '', room: '' });

    const loadSessions = useCallback(async (classId: string) => {
        if (!classId) { setSessions([]); return; }
        try {
            setSessions(await api.get<Session[]>(`/api/schedules/${classId}`));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تحميل الجدول'));
            setSessions([]);
        }
    }, []);

    useEffect(() => {
        const endpoint = canEdit
            ? '/api/classes'
            : user.role === 'teacher'
                ? `/api/teacher/classes/${user.id}`
                : `/api/student/classes/${user.id}`;

        api.get<ClassData[]>(endpoint)
            .then(async (list) => {
                setClasses(list);
                if (list.length > 0) {
                    setSelectedClassId(list[0].id);
                    await loadSessions(list[0].id);
                }
            })
            .catch((err) => setError(err instanceof ApiError ? err.message : t('تعذر تحميل الصفوف')))
            .finally(() => setLoading(false));

        api.get<{ name: string }[]>('/api/subjects')
            .then((list) => {
                const names = list.map((s) => s.name).filter(Boolean);
                if (names.length > 0) setSubjects(names);
            })
            .catch(() => { /* the built-in list still works */ });

        api.get<Period[]>('/api/periods')
            .then((list) => { if (Array.isArray(list) && list.length > 0) setPeriods(list); })
            .catch(() => { /* the fallback times still render a usable grid */ });

        if (canEdit) {
            api.get<{ data: { id: string; name: string }[] }>('/api/admin/teachers?limit=100')
                .then((res) => setTeachers(res?.data || []))
                .catch(() => setTeachers([]));
        }
    }, [user.id, user.role, canEdit, loadSessions]);

    /**
     * Rows are the standard periods plus any other time already saved, so a
     * lesson entered before this grid existed still has somewhere to appear.
     */
    const rows = useMemo(() => {
        const known = new Set<string>(periods.map((p) => p.time));
        const seen = new Set<string>(sessions.map((s) => String(s.time)));
        const extras = [...seen]
            .filter((time) => !known.has(time))
            .sort()
            .map((time) => ({ label: '', time }));
        return [...periods, ...extras];
    }, [sessions, periods]);

    const bySlot = useMemo(() => {
        const map = new Map<string, Session>();
        for (const s of sessions) map.set(`${s.day}|${s.time}`, s);
        return map;
    }, [sessions]);

    const openSlot = (day: string, time: string) => {
        setSlot({ day, time });
        setForm({ subject: subjects[0] || '', teacher_id: '', room: '' });
        setError('');
    };

    const saveSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!slot) return;
        setBusy(true);
        setError('');
        try {
            // The name is what the timetable displays; the id is what links the
            // teacher to the class.
            const chosen = teachers.find((teacher) => teacher.id === form.teacher_id);

            await api.post('/api/admin/schedules', {
                class_id: selectedClassId,
                day: slot.day,
                time: slot.time,
                subject: form.subject,
                teacher: chosen?.name || undefined,
                teacher_id: chosen?.id || undefined,
                room: form.room || undefined,
            });
            setSlot(null);
            await loadSessions(selectedClassId);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر إضافة الحصة'));
        } finally {
            setBusy(false);
        }
    };

    const openPeriodEditor = () => {
        setDraftPeriods(periods.map((p) => ({ ...p })));
        setShowPeriods(true);
        setError('');
    };

    /**
     * Saving new bell times also moves the lessons already standing at the old
     * ones — the server matches them by position, so the second period stays
     * the second period whatever o'clock it now starts at.
     */
    const savePeriods = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const res = await api.put<{ periods: Period[]; moved_lessons: number }>('/api/admin/periods', {
                periods: draftPeriods,
            });
            setPeriods(res.periods);
            setShowPeriods(false);
            await loadSessions(selectedClassId);
            if (res.moved_lessons > 0) {
                alert(t('تم تحديث الأوقات ونقل {count} درس', { count: res.moved_lessons }));
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر حفظ أوقات الحصص'));
        } finally {
            setBusy(false);
        }
    };

    const removeSession = async (id: string) => {
        if (!confirm(t('حذف هذه الحصة من الجدول؟'))) return;
        try {
            await api.del(`/api/admin/schedules/${id}`);
            await loadSessions(selectedClassId);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر حذف الحصة'));
        }
    };

    if (loading) return <div className="p-6"><Spinner label={t('جاري تحميل الجدول')} /></div>;

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('الجدول الأسبوعي')}</h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {canEdit ? t('اضغط على أي خانة فارغة لإضافة درس') : t('جدول الحصص لكامل الأسبوع')}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {isAdmin(user.role) && (
                        <button
                            onClick={openPeriodEditor}
                            className="flex-1 sm:flex-none justify-center bg-white border border-slate-200 text-slate-600 px-3 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-slate-50"
                        >
                            <Clock className="w-4 h-4" />
                            {t('أوقات الحصص')}
                        </button>
                    )}
                    {classes.length > 1 && (
                        <select
                            className={`${inputClass} w-full sm:w-auto sm:min-w-40`}
                            value={selectedClassId}
                            onChange={(e) => { setSelectedClassId(e.target.value); loadSessions(e.target.value); }}
                        >
                            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

            {classes.length === 0 ? (
                <Card className="p-10 text-center">
                    <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">{t('لا يوجد صف مرتبط بحسابك بعد')}</p>
                </Card>
            ) : (
                <>
                {/* --------------------------- phones --------------------------- */}
                <div className="md:hidden space-y-3">
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                        {DAYS.map((day) => (
                            <button
                                key={day}
                                onClick={() => setActiveDay(day)}
                                className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-colors ${
                                    activeDay === day
                                        ? 'bg-brand-700 text-white shadow-lg shadow-brand-100'
                                        : 'bg-white text-slate-500 border border-slate-100'
                                }`}
                            >
                                {t(day)}
                            </button>
                        ))}
                    </div>

                    <Card className="divide-y divide-slate-50">
                        {rows.map((period) => {
                            const session = bySlot.get(`${activeDay}|${period.time}`);
                            const mine = session && user.role === 'teacher' && session.teacher === user.name;

                            return (
                                <div key={period.time} className="flex items-center gap-3 p-3">
                                    <div className="w-16 shrink-0 text-center">
                                        <p className="text-[11px] font-black text-slate-700" dir="ltr">{period.time}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">
                                            {period.label ? t(period.label) : ''}
                                        </p>
                                    </div>

                                    {session ? (
                                        <div
                                            className={`flex-1 min-w-0 rounded-xl border px-3 py-2 ${toneFor(session.subject)} ${
                                                mine ? 'ring-2 ring-brand-400' : ''
                                            }`}
                                        >
                                            <p className="text-xs font-black truncate">{session.subject}</p>
                                            <p className="text-[10px] font-bold opacity-70 truncate">
                                                {[session.teacher, session.room].filter(Boolean).join(' · ') || '—'}
                                            </p>
                                        </div>
                                    ) : canEdit ? (
                                        <button
                                            onClick={() => openSlot(activeDay, period.time)}
                                            className="flex-1 rounded-xl border border-dashed border-slate-200 text-slate-300 hover:border-brand-300 hover:text-brand-600 py-3 flex items-center justify-center"
                                            aria-label={t('إضافة درس')}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <div className="flex-1 rounded-xl border border-dashed border-slate-100 py-3 text-center">
                                            <span className="text-[10px] font-bold text-slate-300">{t('لا يوجد درس')}</span>
                                        </div>
                                    )}

                                    {session && canEdit && (
                                        <button
                                            onClick={() => removeSession(session.id)}
                                            className="p-1.5 text-slate-300 hover:text-rose-500 shrink-0"
                                            aria-label={t('حذف الحصة')}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </Card>
                </div>

                {/* ------------------------ tablets and up ------------------------ */}
                <Card className="hidden md:block p-4 overflow-x-auto">
                    <table className="w-full border-collapse min-w-[680px]">
                        <thead>
                            <tr>
                                <th className="w-28 text-[10px] font-black text-slate-400 p-2 text-right">{t('الحصة')}</th>
                                {DAYS.map((day) => (
                                    <th key={day} className="text-xs font-black text-slate-700 bg-slate-50 border border-slate-100 rounded-t-xl p-2">
                                        {t(day)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((period) => (
                                <tr key={period.time}>
                                    <th className="text-right align-top p-2 border-t border-slate-50">
                                        <p className="text-[11px] font-black text-slate-700">{period.label ? t(period.label) : period.time}</p>
                                        <p className="text-[10px] text-slate-400 font-bold" dir="ltr">{period.time}</p>
                                    </th>

                                    {DAYS.map((day) => {
                                        const session = bySlot.get(`${day}|${period.time}`);
                                        const mine = session && user.role === 'teacher' && session.teacher === user.name;

                                        if (!session) {
                                            return (
                                                <td key={day} className="p-1 align-top">
                                                    {canEdit ? (
                                                        <button
                                                            onClick={() => openSlot(day, period.time)}
                                                            className="w-full h-16 rounded-xl border border-dashed border-slate-200 text-slate-300 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/40 transition-colors flex items-center justify-center"
                                                            aria-label={t('إضافة درس')}
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <div className="w-full h-16 rounded-xl border border-dashed border-slate-100" />
                                                    )}
                                                </td>
                                            );
                                        }

                                        return (
                                            <td key={day} className="p-1 align-top">
                                                <div
                                                    className={`w-full h-16 rounded-xl border px-2 py-1.5 flex flex-col justify-center relative group ${toneFor(session.subject)} ${
                                                        mine ? 'ring-2 ring-brand-400' : ''
                                                    }`}
                                                >
                                                    <p className="text-[11px] font-black truncate">{session.subject}</p>
                                                    {session.teacher && (
                                                        <p className="text-[9px] font-bold opacity-70 truncate flex items-center gap-0.5">
                                                            <User className="w-2.5 h-2.5 shrink-0" />
                                                            {session.teacher}
                                                        </p>
                                                    )}
                                                    {session.room && (
                                                        <p className="text-[9px] font-bold opacity-60 truncate">{session.room}</p>
                                                    )}
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => removeSession(session.id)}
                                                            className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600"
                                                            aria-label={t('حذف الحصة')}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
                </>
            )}

            <Modal
                open={showPeriods}
                onClose={() => setShowPeriods(false)}
                title={t('أوقات الحصص')}
                subtitle={t('تسري على كل الصفوف، وتُنقل الدروس المسجلة تلقائياً')}
            >
                <form onSubmit={savePeriods} className="space-y-3">
                    {draftPeriods.map((period, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                className={`${inputClass} flex-1`}
                                value={period.label}
                                onChange={(e) => setDraftPeriods((list) =>
                                    list.map((p, i) => (i === index ? { ...p, label: e.target.value } : p))
                                )}
                                placeholder={t('اسم الحصة')}
                            />
                            <input
                                type="time"
                                dir="ltr"
                                className={`${inputClass} w-32 shrink-0`}
                                value={period.time}
                                onChange={(e) => setDraftPeriods((list) =>
                                    list.map((p, i) => (i === index ? { ...p, time: e.target.value } : p))
                                )}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setDraftPeriods((list) => list.filter((_, i) => i !== index))}
                                className="p-2 text-slate-300 hover:text-rose-500 shrink-0"
                                aria-label={t('حذف الحصة')}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={() => setDraftPeriods((list) => [
                            ...list,
                            { label: `${t('الحصة')} ${list.length + 1}`, time: '' },
                        ])}
                        className="w-full border border-dashed border-slate-200 text-slate-400 hover:text-brand-700 hover:border-brand-300 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        {t('إضافة حصة')}
                    </button>

                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                        {t('حذف حصة لا يحذف دروسها؛ ستبقى ظاهرة في الجدول بوقتها القديم حتى تحذفها يدوياً.')}
                    </p>

                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full bg-gradient-to-l from-brand-700 to-brand-500 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-brand-700/30 active:scale-[0.99] transition-transform disabled:opacity-60"
                    >
                        {busy ? t('جاري الحفظ...') : t('حفظ الأوقات')}
                    </button>
                </form>
            </Modal>

            <Modal
                open={Boolean(slot)}
                onClose={() => setSlot(null)}
                title={t('إضافة درس')}
                subtitle={slot ? `${t(slot.day)} — ${slot.time}` : ''}
            >
                <form onSubmit={saveSession} className="space-y-3">
                    <div>
                        <label className={labelClass}>{t('المادة')} <span className="text-red-500">*</span></label>
                        <select
                            className={inputClass}
                            value={form.subject}
                            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                            required
                        >
                            <option value="">{t('-- اختر المادة --')}</option>
                            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>{t('المعلم')}</label>
                        <select
                            className={inputClass}
                            value={form.teacher_id}
                            onChange={(e) => setForm((f) => ({ ...f, teacher_id: e.target.value }))}
                        >
                            <option value="">{t('-- اختر المعلم --')}</option>
                            {teachers.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">
                            {t('سيُضاف المعلم إلى هذا الصف تلقائياً')}
                        </p>
                    </div>

                    <div>
                        <label className={labelClass}>{t('القاعة')}</label>
                        <input
                            className={inputClass}
                            value={form.room}
                            onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                            placeholder={t('مثال: قاعة 1')}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full bg-gradient-to-l from-brand-700 to-brand-500 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-brand-700/30 active:scale-[0.99] transition-transform disabled:opacity-60"
                    >
                        {busy ? t('جاري الحفظ...') : t('حفظ في الجدول')}
                    </button>
                </form>
            </Modal>
        </div>
    );
};
