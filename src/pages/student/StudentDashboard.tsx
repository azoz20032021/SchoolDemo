import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookMarked, Bus, CalendarDays, GraduationCap, Phone, QrCode, Smile, Wallet,
} from 'lucide-react';
import { ClassData, UserData } from '../../types';
import { api, formatMoney } from '../../lib/api';
import { Badge, Spinner } from '../../components/ui';
import {
    Headline, Hero, HeroStats, Meter, Nothing, Page, Panel, Row, Rows, Section, Split,
} from '../../components/ui/shell';
import { AttendanceCalendar } from '../../components/AttendanceCalendar';
import { StudentBadge } from '../../components/StudentBadge';
import { t } from '../../i18n';

/**
 * The student's own screen.
 *
 * Built from the same pieces as their parent's, so the family sees one product
 * rather than two, and answering the same four questions: how am I doing, am I
 * attending, what is due, and what do I owe. The old version showed a bare
 * attendance count and a list of classes, which answered none of them.
 */

interface Assignment {
    id: string;
    subject: string;
    title: string;
    due_date?: string | null;
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
}

const today = () => new Date().toISOString().slice(0, 10);

export const StudentDashboard: React.FC<{ user: UserData }> = ({ user }) => {
    const navigate = useNavigate();

    const [report, setReport] = useState<any>(null);
    const [homework, setHomework] = useState<Assignment[]>([]);
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [bus, setBus] = useState<BusLine | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get<any>(`/api/reports/student/${user.id}`).catch(() => null),
            api.get<Assignment[]>(`/api/student/${user.id}/homework`).catch(() => []),
            api.get<ClassData[]>(`/api/student/classes/${user.id}`).catch(() => []),
            api.get<BusLine | null>(`/api/student/${user.id}/bus`).catch(() => null),
        ])
            .then(([full, tasks, myClasses, line]) => {
                setReport(full);
                setHomework(Array.isArray(tasks) ? tasks : []);
                setClasses(myClasses || []);
                setBus(line);
            })
            .finally(() => setLoading(false));
    }, [user.id]);

    if (loading) return <div className="p-6"><Spinner label={t('جاري التحميل')} /></div>;

    const upcoming = homework.filter((a) => !a.due_date || a.due_date >= today());
    const className = report?.student?.class_name || classes[0]?.name || '';

    return (
        <Page>
            <Hero
                initial={user.name.charAt(0)}
                title={user.name}
                subtitle={`${className}${className ? ' · ' : ''}${user.uid}`}
                badge={t('أهلاً بك')}
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Headline
                    label={t('الواجبات المطلوبة')}
                    value={upcoming.length}
                    hint={upcoming.length === 0 ? t('لا شيء مطلوب منك') : t('اضغط للتفاصيل')}
                    tone="indigo"
                    icon={<BookMarked className="w-4 h-4" />}
                    onClick={() => navigate('/homework')}
                />
                <Headline
                    label={t('المتبقي عليك')}
                    value={report ? formatMoney(report.finance.outstanding) : '—'}
                    hint={report?.finance?.is_clear ? t('لا توجد مستحقات') : t('راجع المحاسب للتسديد')}
                    tone={report?.finance?.is_clear ? 'emerald' : 'rose'}
                    icon={<Wallet className="w-4 h-4" />}
                    onClick={() => navigate('/finance')}
                />
            </div>

            <Split>
            <Section title="يومي الدراسي" className="lg:col-span-2" />

            <Panel title={t('بطاقتي')} icon={<QrCode className="w-4 h-4" />} tone="violet" note={t('للدخول من بوابة المدرسة')}>
                <StudentBadge uid={user.uid} name={user.name} />
            </Panel>

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
                                <p className="text-xs font-black text-slate-700" dir="ltr">{bus.departure_time || '—'}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl py-2">
                                <p className="text-[10px] font-bold text-slate-400">{t('العودة')}</p>
                                <p className="text-xs font-black text-slate-700" dir="ltr">{bus.return_time || '—'}</p>
                            </div>
                        </div>
                        {bus.driver_phone && (
                            <a
                                href={`tel:${bus.driver_phone}`}
                                className="mt-3 w-full bg-slate-800 text-white py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2"
                            >
                                <Phone className="w-3.5 h-3.5" />
                                {t('اتصل بالسائق')}
                            </a>
                        )}
                    </div>
                </Panel>
            )}

            {report && (
                <>
                    <Section title="دراستي" className="lg:col-span-2" />

                    <Panel
                        title={t('الواجبات المطلوبة')}
                        icon={<BookMarked className="w-4 h-4" />}
                        tone="sky"
                        note={`${upcoming.length} ${t('واجب')}`}
                    >
                        {upcoming.length === 0 ? (
                            <Nothing message="لا توجد واجبات مطلوبة حالياً" />
                        ) : (
                            <Rows>
                                {upcoming.slice(0, 5).map((task) => (
                                    <Row
                                        key={task.id}
                                        icon={<BookMarked className="w-4 h-4" />}
                                        tone="bg-brand-50 text-brand-700"
                                        title={task.title}
                                        subtitle={`${task.subject}${task.due_date ? ` · ${t('التسليم')} ${task.due_date}` : ''}`}
                                    />
                                ))}
                            </Rows>
                        )}
                    </Panel>

                    <Panel
                        title={t('الحضور')}
                        icon={<CalendarDays className="w-4 h-4" />}
                        tone="emerald"
                        note={`${report.attendance.stats.absent} ${t('يوم غياب')} · ${report.attendance.stats.late} ${t('تأخير')}`}
                    >
                        <AttendanceCalendar records={report.attendance.records || []} />
                    </Panel>

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
                                        icon={<Smile className="w-4 h-4" />}
                                        tone={note.type === 'positive' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}
                                        title={note.title}
                                        subtitle={`${note.date} · ${note.category}`}
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
                </>
            )}
            </Split>
        </Page>
    );
};
