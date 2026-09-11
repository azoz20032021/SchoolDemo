import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { ClassData, UserData } from '../types';
import { api, ApiError } from '../lib/api';
import { isStaff } from '../context/AuthContext';
import { Badge, ErrorBanner, Modal, Spinner, inputClass, labelClass } from '../components/ui';
import { Nothing, Page, PageTitle, Panel, Row, Rows } from '../components/ui/shell';
import { t } from '../i18n';

/**
 * Exams — the ones coming, and the ones that have been.
 *
 * Marks told a family how an exam went; nothing told them one was coming. A
 * student sees what to revise for and how long they have; a teacher schedules
 * it once and the whole class and their parents are told.
 */

interface Exam {
    id: string;
    class_id: string;
    class_name: string;
    subject: string;
    kind: string;
    date: string;
    time?: string;
    notes?: string;
    total_marks?: number;
    created_by: string;
    created_by_name: string;
}

const KINDS = ['امتحان يومي', 'اختبار قصير', 'امتحان شهري', 'امتحان فصلي', 'امتحان نهائي'];

const today = () => new Date().toISOString().slice(0, 10);

/** Days until the exam; negative once it has passed. */
function daysUntil(date: string): number {
    return Math.round((new Date(date).getTime() - new Date(today()).getTime()) / 86_400_000);
}

const ExamRow: React.FC<{ exam: Exam; canDelete: boolean; onDelete: (id: string) => void }> = ({
    exam,
    canDelete,
    onDelete,
}) => {
    const left = daysUntil(exam.date);
    const past = left < 0;

    return (
        <Row
            icon={<ClipboardList className="w-4 h-4" />}
            tone={past ? 'bg-slate-100 text-slate-400' : left <= 2 ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-700'}
            title={`${exam.subject} — ${exam.kind}`}
            subtitle={`${exam.date}${exam.time ? ` · ${exam.time}` : ''} · ${exam.class_name}${
                exam.notes ? ` · ${exam.notes}` : ''
            }`}
            trailing={
                <div className="flex items-center gap-2 shrink-0">
                    {!past && (
                        <Badge tone={left === 0 ? 'rose' : left <= 2 ? 'amber' : 'emerald'}>
                            {left === 0 ? t('اليوم') : t('بعد {days} يوم', { days: left })}
                        </Badge>
                    )}
                    {canDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(exam.id); }}
                            className="p-1.5 text-slate-300 hover:text-rose-500"
                            aria-label={t('حذف الامتحان')}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            }
        />
    );
};

export const Exams: React.FC<{ user: UserData }> = ({ user }) => {
    const isStudent = user.role === 'student';
    const canAdd = user.role === 'teacher' || user.role === 'admin';

    const [classes, setClasses] = useState<ClassData[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [upcoming, setUpcoming] = useState<Exam[]>([]);
    const [past, setPast] = useState<Exam[]>([]);
    const [subjects, setSubjects] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ subject: '', kind: 'امتحان شهري', date: '', time: '', notes: '', total_marks: '100' });

    const loadClass = useCallback(async (classId: string) => {
        if (!classId) { setUpcoming([]); setPast([]); return; }
        const res = await api.get<{ upcoming: Exam[]; past: Exam[] }>(`/api/class/${classId}/exams`);
        setUpcoming(res.upcoming || []);
        setPast(res.past || []);
    }, []);

    useEffect(() => {
        if (isStudent) {
            api.get<{ upcoming: Exam[]; past: Exam[] }>(`/api/student/${user.id}/exams`)
                .then((res) => { setUpcoming(res.upcoming || []); setPast(res.past || []); })
                .catch((err) => setError(err instanceof ApiError ? err.message : t('تعذر تحميل الامتحانات')))
                .finally(() => setLoading(false));
            return;
        }

        const endpoint = isStaff(user.role) ? '/api/classes' : `/api/teacher/classes/${user.id}`;
        api.get<ClassData[]>(endpoint)
            .then(async (list) => {
                setClasses(list);
                if (list.length > 0) {
                    setSelectedClass(list[0].id);
                    await loadClass(list[0].id);
                }
            })
            .catch((err) => setError(err instanceof ApiError ? err.message : t('تعذر تحميل الصفوف')))
            .finally(() => setLoading(false));

        api.get<{ name: string }[]>('/api/subjects')
            .then((list) => setSubjects(list.map((s) => s.name).filter(Boolean)))
            .catch(() => setSubjects([]));
    }, [user.id, user.role, isStudent, loadClass]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const res = await api.post<{ notified: number }>('/api/exams', {
                class_id: selectedClass,
                subject: form.subject,
                kind: form.kind,
                date: form.date,
                time: form.time || undefined,
                notes: form.notes || undefined,
                total_marks: Number(form.total_marks) || 100,
            });
            setShowAdd(false);
            setForm((f) => ({ ...f, date: '', time: '', notes: '' }));
            await loadClass(selectedClass);
            alert(t('تم جدولة الامتحان وإشعار {count} شخص', { count: res.notified }));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر جدولة الامتحان'));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: string) => {
        if (!confirm(t('حذف هذا الامتحان؟'))) return;
        try {
            await api.del(`/api/exams/${id}`);
            setUpcoming((prev) => prev.filter((e) => e.id !== id));
            setPast((prev) => prev.filter((e) => e.id !== id));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر حذف الامتحان'));
        }
    };

    if (loading) return <div className="p-6"><Spinner label={t('جاري تحميل الامتحانات')} /></div>;

    // A teacher may only remove what they scheduled; an admin may remove any.
    const canDelete = (exam: Exam) => user.role === 'admin' || (user.role === 'teacher' && exam.created_by === user.id);
    const subjectOptions = user.role === 'teacher' && (user.subjects || []).length > 0 ? user.subjects! : subjects;

    return (
        <Page>
            <PageTitle
                title={t('الامتحانات')}
                subtitle={isStudent ? t('ما ينتظرك من امتحانات') : t('جدول امتحانات صفك')}
                action={
                    canAdd && classes.length > 0 ? (
                        <button
                            onClick={() => { setShowAdd(true); setError(''); }}
                            className="bg-gradient-to-l from-brand-700 to-brand-500 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-brand-700/30 active:scale-[0.98] transition-transform flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            {t('جدولة امتحان')}
                        </button>
                    ) : undefined
                }
            />

            {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

            {!isStudent && classes.length > 1 && (
                <select
                    className={inputClass}
                    value={selectedClass}
                    onChange={(e) => { setSelectedClass(e.target.value); loadClass(e.target.value).catch(() => {}); }}
                >
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            )}

            <Panel title={t('القادمة')} icon={<CalendarClock className="w-4 h-4" />} note={`${upcoming.length}`}>
                {upcoming.length === 0 ? (
                    <Nothing
                        icon={<ClipboardList className="w-10 h-10" />}
                        message="لا توجد امتحانات قادمة"
                        hint={canAdd ? 'جدول امتحاناً من الزر بالأعلى' : undefined}
                    />
                ) : (
                    <Rows>
                        {upcoming.map((exam) => (
                            <ExamRow key={exam.id} exam={exam} canDelete={canDelete(exam)} onDelete={remove} />
                        ))}
                    </Rows>
                )}
            </Panel>

            {past.length > 0 && (
                <Panel title={t('السابقة')} note={`${past.length}`}>
                    <Rows>
                        {past.slice(0, 10).map((exam) => (
                            <ExamRow key={exam.id} exam={exam} canDelete={canDelete(exam)} onDelete={remove} />
                        ))}
                    </Rows>
                </Panel>
            )}

            <Modal
                open={showAdd}
                onClose={() => setShowAdd(false)}
                title={t('جدولة امتحان')}
                subtitle={classes.find((c) => c.id === selectedClass)?.name}
            >
                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <label className={labelClass}>{t('المادة')} <span className="text-red-500">*</span></label>
                        {subjectOptions.length > 0 ? (
                            <select
                                className={inputClass}
                                value={form.subject}
                                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                                required
                            >
                                <option value="">{t('-- اختر المادة --')}</option>
                                {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        ) : (
                            <input
                                className={inputClass}
                                value={form.subject}
                                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                                required
                            />
                        )}
                    </div>

                    <div>
                        <label className={labelClass}>{t('نوع الامتحان')}</label>
                        <select
                            className={inputClass}
                            value={form.kind}
                            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                        >
                            {KINDS.map((kind) => <option key={kind} value={kind}>{t(kind)}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('التاريخ')} <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                className={inputClass}
                                value={form.date}
                                min={today()}
                                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>{t('الوقت')}</label>
                            <input
                                type="time"
                                dir="ltr"
                                className={inputClass}
                                value={form.time}
                                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>{t('الدرجة الكلية')}</label>
                        <input
                            type="number"
                            min={1}
                            className={inputClass}
                            value={form.total_marks}
                            onChange={(e) => setForm((f) => ({ ...f, total_marks: e.target.value }))}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>{t('ملاحظات')}</label>
                        <textarea
                            rows={2}
                            className={inputClass}
                            value={form.notes}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder={t('الفصول المشمولة، ما يجب إحضاره...')}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full bg-gradient-to-l from-brand-700 to-brand-500 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-brand-700/30 active:scale-[0.99] transition-transform disabled:opacity-60"
                    >
                        {busy ? t('جاري الحفظ...') : t('جدولة وإشعار الصف')}
                    </button>
                </form>
            </Modal>
        </Page>
    );
};
