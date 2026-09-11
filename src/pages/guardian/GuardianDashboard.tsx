import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bus, CalendarDays, ClipboardList, GraduationCap, MessageCircle, Phone, Smile, Users, Wallet,
} from 'lucide-react';
import { UserData } from '../../types';
import { api, ApiError, formatMoney } from '../../lib/api';
import { Badge, ErrorBanner, Spinner } from '../../components/ui';
import {
    Chips, Headline, Hero, HeroStats, Meter, Nothing, Page, Panel, Row, Rows, Section, Split,
} from '../../components/ui/shell';
import { AttendanceCalendar } from '../../components/AttendanceCalendar';
import { t } from '../../i18n';

/**
 * What a parent opens the application to see.
 *
 * The old version was a column of identical white cards — everything present,
 * nothing prominent. This one answers the four questions a parent actually has
 * before they have finished reading: how is he doing, is he attending, does he
 * owe anything, and is there homework. Everything else sits underneath in the
 * order a parent asks for it.
 */

interface Child {
    id: string;
    name: string;
    uid: string;
    class_id: string | null;
    class_name: string;
}

interface Assignment {
    id: string;
    subject: string;
    title: string;
    due_date?: string | null;
}

interface Exam {
    id: string;
    subject: string;
    kind: string;
    date: string;
    time?: string;
}

interface BusLine {
    id: string;
    name: string;
    status_text: string;
    stop?: string;
    driver_name?: string;
    driver_phone?: string;
    departure_time?: string;
    return_time?: string;
    stops?: string[];
}

const today = () => new Date().toISOString().slice(0, 10);

export const GuardianDashboard: React.FC<{ user: UserData }> = ({ user }) => {
    const navigate = useNavigate();

    const [children, setChildren] = useState<Child[]>([]);
    const [selected, setSelected] = useState<Child | null>(null);
    const [report, setReport] = useState<any>(null);
    const [homework, setHomework] = useState<Assignment[]>([]);
    const [bus, setBus] = useState<BusLine | null>(null);
    const [exams, setExams] = useState<Exam[]>([]);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingChild, setLoadingChild] = useState(false);
    const [error, setError] = useState('');

    const loadChild = useCallback(async (child: Child) => {
        setLoadingChild(true);
        setError('');
        try {
            // The report carries the profile, marks, attendance, fees and
            // conduct in one call; homework and the bus are the only extras.
            const [full, tasks, line, exam] = await Promise.all([
                api.get<any>(`/api/reports/student/${child.id}`),
                api.get<Assignment[]>(`/api/student/${child.id}/homework`).catch(() => []),
                api.get<BusLine | null>(`/api/student/${child.id}/bus`).catch(() => null),
                api.get<{ upcoming: Exam[] }>(`/api/student/${child.id}/exams`).catch(() => ({ upcoming: [] })),
            ]);
            setReport(full);
            setHomework(Array.isArray(tasks) ? tasks : []);
            setBus(line);
            setExams(exam.upcoming || []);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تحميل بيانات الطالب'));
            setReport(null);
        } finally {
            setLoadingChild(false);
        }
    }, []);

    useEffect(() => {
        api.get<Child[]>('/api/guardian/children')
            .then(async (list) => {
                setChildren(list);
                if (list.length > 0) {
                    setSelected(list[0]);
                    await loadChild(list[0]);
                }
            })
            .catch((err) => setError(err instanceof ApiError ? err.message : t('تعذر تحميل قائمة الأبناء')))
            .finally(() => setLoading(false));

        api.get<{ unread: number }[]>('/api/conversations')
            .then((rows) => setUnreadMessages(rows.reduce((sum, row) => sum + (row.unread || 0), 0)))
            .catch(() => setUnreadMessages(0));
    }, [loadChild]);

    if (loading) return <div className="p-6"><Spinner label={t('جاري التحميل')} /></div>;

    if (children.length === 0) {
        return (
            <Page>
                <Panel>
                    <Nothing
                        icon={<Users className="w-10 h-10" />}
                        message="لا يوجد طلاب مرتبطون بحسابك"
                        hint="راجع إدارة المدرسة لربط أبنائك بالحساب"
                    />
                </Panel>
            </Page>
        );
    }

    const upcoming = homework.filter((a) => !a.due_date || a.due_date >= today());

    return (
        <Page>
            {children.length > 1 && (
                <Chips
                    items={children.map((c) => ({ key: c.id, label: c.name }))}
                    active={selected?.id || ''}
                    onPick={(id) => {
                        const child = children.find((c) => c.id === id);
                        if (child) { setSelected(child); loadChild(child); }
                    }}
                />
            )}

            {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

            {selected && (
                <Hero
                    initial={selected.name.charAt(0)}
                    title={selected.name}
                    subtitle={`${selected.class_name} · ${selected.uid}`}
                    badge={t('ابنك')}
                >
                    {report && (
                        <HeroStats
                            items={[
                                {
                                    label: 'المعدل',
                                    value: report.grades.stats.overall_percentage === null
                                        ? '—'
                                        : `${report.grades.stats.overall_percentage}%`,
                                },
                                { label: 'الحضور', value: `${report.attendance.stats.rate}%` },
                                { label: 'واجبات', value: upcoming.length },
                                { label: 'السلوك', value: report.behavior.conduct_score },
                            ]}
                        />
                    )}
                </Hero>
            )}

            {loadingChild && <Spinner label={t('جاري تحميل البيانات')} />}

            {!loadingChild && report && selected && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Headline
                            label={t('المتبقي عليك')}
                            value={formatMoney(report.finance.outstanding)}
                            tone={report.finance.is_clear ? 'emerald' : 'rose'}
                            icon={<Wallet className="w-4 h-4" />}
                            hint={report.finance.is_clear ? t('لا توجد مستحقات') : t('راجع المحاسب للتسديد')}
                        />
                        <Headline
                            label={t('الرسائل')}
                            value={unreadMessages > 0 ? unreadMessages : t('لا جديد')}
                            tone={unreadMessages > 0 ? 'indigo' : 'slate'}
                            icon={<MessageCircle className="w-4 h-4" />}
                            hint={unreadMessages > 0 ? t('غير مقروءة') : t('تواصل مع المدرسة')}
                            onClick={() => navigate('/messages')}
                        />
                    </div>

                    <Split>
                    <Section title="يومه" className="lg:col-span-2" />

                    {bus && (
                        <Panel title={t('الباص')} icon={<Bus className="w-4 h-4" />} tone="violet" note={bus.name}>
                            <div className="px-4 pb-4">
                                <div className="flex items-center gap-2 flex-wrap mb-3">
                                    <Badge tone="indigo">{bus.status_text}</Badge>
                                    {bus.stop && <Badge tone="slate">{t('المحطة')}: {bus.stop}</Badge>}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-center">
                                    <div className="bg-slate-50 rounded-xl py-2">
                                        <p className="text-[10px] font-bold text-slate-400">{t('الانطلاق صباحاً')}</p>
                                        <p className="text-xs font-black text-slate-700" dir="ltr">
                                            {bus.departure_time || '—'}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl py-2">
                                        <p className="text-[10px] font-bold text-slate-400">{t('العودة')}</p>
                                        <p className="text-xs font-black text-slate-700" dir="ltr">
                                            {bus.return_time || '—'}
                                        </p>
                                    </div>
                                </div>

                                {bus.driver_phone && (
                                    <a
                                        href={`tel:${bus.driver_phone}`}
                                        className="mt-3 w-full bg-slate-800 text-white py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2"
                                    >
                                        <Phone className="w-3.5 h-3.5" />
                                        {t('اتصل بالسائق')} {bus.driver_name ? `— ${bus.driver_name}` : ''}
                                    </a>
                                )}
                            </div>
                        </Panel>
                    )}

                    <Panel
                        title={t('الحضور')}
                        icon={<CalendarDays className="w-4 h-4" />}
                        tone="emerald"
                        note={`${report.attendance.stats.absent} ${t('يوم غياب')} · ${report.attendance.stats.late} ${t('تأخير')}`}
                    >
                        <AttendanceCalendar records={report.attendance.records || []} />
                    </Panel>

                    <Section title="دراسته" className="lg:col-span-2" />

                    <Panel
                        title={t('المعدل حسب المادة')}
                        icon={<GraduationCap className="w-4 h-4" />}
                        tone="indigo"
                        note={`${report.grades.stats.subjects.length} ${t('مادة')}`}
                    >
                        {report.grades.stats.subjects.length === 0 ? (
                            <Nothing message="لا توجد درجات مسجلة" />
                        ) : (
                            <div className="px-4 pb-4 space-y-2.5">
                                {report.grades.stats.subjects.map((s: any) => (
                                    <Meter key={s.subject} label={s.subject} value={s.percentage} />
                                ))}
                            </div>
                        )}
                    </Panel>

                    <Panel
                        title={t('الامتحانات القادمة')}
                        icon={<ClipboardList className="w-4 h-4" />}
                        tone="amber"
                        note={exams.length === 0 ? t('لا شيء قريب') : `${exams.length} ${t('امتحان')}`}
                    >
                        {exams.length === 0 ? (
                            <Nothing message="لا توجد امتحانات قادمة" />
                        ) : (
                            <Rows>
                                {exams.slice(0, 5).map((exam) => (
                                    <Row
                                        key={exam.id}
                                        icon={<ClipboardList className="w-4 h-4" />}
                                        tone="bg-amber-50 text-amber-600"
                                        title={`${exam.subject} — ${exam.kind}`}
                                        subtitle={`${exam.date}${exam.time ? ` · ${exam.time}` : ''}`}
                                    />
                                ))}
                            </Rows>
                        )}
                    </Panel>

                    <Panel
                        title={t('الواجبات المطلوبة')}
                        icon={<GraduationCap className="w-4 h-4" />}
                        tone="sky"
                        note={`${upcoming.length} ${t('واجب')}`}
                    >
                        {upcoming.length === 0 ? (
                            <Nothing message="لا توجد واجبات مطلوبة حالياً" />
                        ) : (
                            <Rows>
                                {upcoming.slice(0, 6).map((task) => (
                                    <Row
                                        key={task.id}
                                        title={task.title}
                                        subtitle={`${task.subject}${task.due_date ? ` · ${t('التسليم')} ${task.due_date}` : ''}`}
                                        tone="bg-brand-50 text-brand-700"
                                        icon={<GraduationCap className="w-4 h-4" />}
                                    />
                                ))}
                            </Rows>
                        )}
                    </Panel>

                    <Panel
                        title={t('السلوك والملاحظات')}
                        icon={<Smile className="w-4 h-4" />}
                        tone="rose"
                        note={`${report.behavior.conduct_score}/100`}
                    >
                        {report.behavior.notes.length === 0 ? (
                            <Nothing message="لا توجد ملاحظات سلوكية" />
                        ) : (
                            <Rows>
                                {report.behavior.notes.slice(0, 5).map((note: any) => (
                                    <Row
                                        key={note.id}
                                        title={note.title}
                                        subtitle={`${note.date} · ${note.category}`}
                                        tone={note.type === 'positive' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}
                                        icon={<Smile className="w-4 h-4" />}
                                        trailing={
                                            <Badge tone={note.type === 'positive' ? 'emerald' : 'rose'}>
                                                {note.type === 'positive' ? t('إيجابية') : t('سلبية')}
                                            </Badge>
                                        }
                                    />
                                ))}
                            </Rows>
                        )}
                    </Panel>

                    <Section title="حسابه" className="lg:col-span-2" />

                    <Panel
                        title={t('الرسوم')}
                        icon={<Wallet className="w-4 h-4" />}
                        tone="emerald"
                        note={`${t('المسدد')} ${formatMoney(report.finance.total_paid)} ${t('من')} ${formatMoney(report.finance.total_billed)}`}
                    >
                        {report.finance.invoices.length === 0 ? (
                            <Nothing message="لا توجد رسوم مسجلة" />
                        ) : (
                            <Rows>
                                {report.finance.invoices.map((invoice: any) => (
                                    <Row
                                        key={invoice.id}
                                        title={invoice.title}
                                        subtitle={invoice.due_date ? `${t('الاستحقاق')} ${invoice.due_date}` : t('بدون موعد استحقاق')}
                                        tone={invoice.remaining > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}
                                        icon={<Wallet className="w-4 h-4" />}
                                        trailing={
                                            <div className="text-left shrink-0">
                                                <p className="text-xs font-black text-slate-800">
                                                    {formatMoney(invoice.net_amount)}
                                                </p>
                                                {invoice.remaining > 0 && (
                                                    <p className="text-[10px] font-black text-rose-600">
                                                        {t('متبقي')} {formatMoney(invoice.remaining)}
                                                    </p>
                                                )}
                                            </div>
                                        }
                                    />
                                ))}
                            </Rows>
                        )}
                        <p className="text-[10px] text-slate-400 font-medium px-4 pb-4">
                            {t('للتسديد أو الاستفسار راجع محاسب المدرسة.')}
                        </p>
                    </Panel>
                    </Split>
                </>
            )}
        </Page>
    );
};
