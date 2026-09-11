import React, { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, GraduationCap, Star, TrendingUp } from 'lucide-react';
import { UserData } from '../../types';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui';
import { Chips, Meter, Metric, Nothing, Page, PageTitle, Panel, Section } from '../../components/ui/shell';
import { t } from '../../i18n';

/**
 * A student's own marks.
 *
 * Two things were wrong with the page this replaces, and only one of them was
 * how it looked. Its progress bars were coloured with class names built at run
 * time — `bg-${tone}-500` — and Tailwind decides what CSS to ship by reading the
 * source text, so those class names were never generated: every bar on the page
 * was drawn with no colour at all, and the one thing a mark most needs to say at
 * a glance — am I fine or am I not — was the thing it could not say. The tones
 * are written out in full here so they survive the build.
 *
 * The rest is the same shape as the other screens: the average said once and
 * loudly, then the subjects, each with its own average and the marks under it.
 */

interface Grade {
    subject: string;
    score: number;
    total: number;
    semester?: string;
    category?: string;
    date?: string;
}

const SEMESTERS = ['الكل', 'الفصل الأول', 'الفصل الثاني', 'نصف السنة', 'السعي السنوي'];

/**
 * Written out rather than composed, so Tailwind can see them.
 */
const BANDS = {
    high: { chip: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' },
    mid: { chip: 'bg-gold-50 text-gold-600', bar: 'bg-gold-400' },
    low: { chip: 'bg-rose-50 text-rose-700', bar: 'bg-rose-500' },
} as const;

const bandOf = (ratio: number) => (ratio >= 0.75 ? BANDS.high : ratio >= 0.5 ? BANDS.mid : BANDS.low);

/** The label a mark carries; the stored category is not always the useful one. */
function categoryLabel(grade: Grade): string {
    const category = grade.category || 'يومي';
    if (category === 'امتحان فصل') {
        return grade.semester === 'الفصل الثاني' ? 'درجة الفصل الثاني' : 'درجة الفصل الأول';
    }
    if (category === 'الكل') {
        return grade.semester === 'نصف السنة' ? 'درجة نصف السنة' : 'الدرجة السنوية';
    }
    return category;
}

function verdict(percentage: number): string {
    if (percentage >= 90) return 'ممتاز';
    if (percentage >= 80) return 'جيد جداً';
    if (percentage >= 70) return 'جيد';
    if (percentage >= 50) return 'مقبول';
    return 'يحتاج مجهوداً';
}

export const StudentGrades: React.FC<{ user: UserData }> = ({ user }) => {
    const [grades, setGrades] = useState<Grade[]>([]);
    const [semester, setSemester] = useState('الكل');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<Grade[]>(`/api/class/grades/student/${user.id}`)
            .then((rows) => setGrades(Array.isArray(rows) ? rows : []))
            .catch(() => setGrades([]))
            .finally(() => setLoading(false));
    }, [user.id]);

    const visible = useMemo(
        () => (semester === 'الكل' ? grades : grades.filter((g) => (g.semester || '').trim() === semester)),
        [grades, semester]
    );

    /** One entry per subject, with its own average, ready to render. */
    const subjects = useMemo(() => {
        const bySubject = new Map<string, Grade[]>();
        for (const grade of visible) {
            const list = bySubject.get(grade.subject) || [];
            list.push(grade);
            bySubject.set(grade.subject, list);
        }

        return [...bySubject.entries()]
            .map(([name, rows]) => {
                const ratio = rows.reduce((sum, g) => sum + (g.total ? g.score / g.total : 0), 0) / rows.length;
                return { name, rows, percentage: Math.round(ratio * 100) };
            })
            .sort((a, b) => b.percentage - a.percentage);
    }, [visible]);

    const average = useMemo(() => {
        if (visible.length === 0) return null;
        const ratio = visible.reduce((sum, g) => sum + (g.total ? g.score / g.total : 0), 0) / visible.length;
        return Math.round(ratio * 100);
    }, [visible]);

    const distinctions = visible.filter((g) => g.total && g.score / g.total >= 0.9).length;

    if (loading) return <div className="p-6"><Spinner label={t('جاري تحميل الدرجات')} /></div>;

    return (
        <Page>
            <PageTitle title={t('سجلي الأكاديمي')} subtitle={t('كل درجاتك، مرتبة حسب المادة')} />

            {/* The average, said once and loudly. */}
            <div className="relative overflow-hidden rounded-[1.75rem] bg-brand-800 text-white p-5 shadow-[0_20px_50px_-20px_rgba(7,21,83,0.9)] rise">
                <div className="absolute -left-16 -top-20 w-56 h-56 bg-brand-500/50 rounded-full blur-3xl" />
                <div className="absolute -right-10 -bottom-20 w-52 h-52 bg-gold-500/25 rounded-full blur-3xl" />

                <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-black text-brand-200">{t('المعدل العام')}</p>
                        <p className="text-5xl font-black leading-none mt-2 tabular">
                            {average === null ? '—' : `${average}%`}
                        </p>
                        {average !== null && (
                            <span className="inline-block mt-3 bg-white/15 ring-1 ring-white/25 rounded-full px-3 py-1 text-[11px] font-black">
                                {t(verdict(average))}
                            </span>
                        )}
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <Metric
                    label={t('المواد')}
                    value={subjects.length}
                    tone="indigo"
                    icon={<BookOpen className="w-4 h-4" />}
                />
                <Metric
                    label={t('الدرجات المرصودة')}
                    value={visible.length}
                    tone="sky"
                    icon={<GraduationCap className="w-4 h-4" />}
                />
                <Metric
                    label={t('درجات التفوق')}
                    value={distinctions}
                    hint={t('90% فأكثر')}
                    tone="amber"
                    icon={<Star className="w-4 h-4" />}
                />
            </div>

            <Chips
                items={SEMESTERS.map((s) => ({ key: s, label: t(s) }))}
                active={semester}
                onPick={setSemester}
            />

            {average !== null && average >= 90 && (
                <div className="rounded-[1.35rem] bg-gradient-to-l from-gold-500 to-gold-400 text-brand-950 p-4 flex items-center gap-3 shadow-lg shadow-gold-500/30 rise">
                    <div className="w-11 h-11 rounded-2xl bg-white/60 flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-black">{t('وسام التفوق الدراسي')}</p>
                        <p className="text-[11px] font-bold opacity-80">{t('معدلك 90% فأكثر — أحسنت.')}</p>
                    </div>
                </div>
            )}

            <Section title="المواد" />

            {subjects.length === 0 ? (
                <Panel>
                    <Nothing
                        icon={<GraduationCap className="w-10 h-10" />}
                        message="لا توجد درجات في هذا القسم"
                        hint="ستظهر نتائجك هنا فور رصدها من قبل المدرّسين"
                    />
                </Panel>
            ) : (
                <div className="space-y-3.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
                    {subjects.map((subject) => (
                        <Panel
                            key={subject.name}
                            title={subject.name}
                            icon={<BookOpen className="w-4 h-4" />}
                            tone="brand"
                            note={`${subject.rows.length} ${t('درجة مرصودة')}`}
                        >
                            <div className="px-4 pb-4 space-y-3">
                                <Meter value={subject.percentage} />

                                <div className="divide-y divide-slate-100">
                                    {subject.rows.map((grade, index) => {
                                        const ratio = grade.total ? grade.score / grade.total : 0;
                                        const band = bandOf(ratio);

                                        return (
                                            <div
                                                key={`${grade.subject}-${index}`}
                                                className="py-2.5 flex items-center gap-3"
                                            >
                                                <span
                                                    className={`${band.chip} text-[10px] font-black px-2 py-1 rounded-lg shrink-0`}
                                                >
                                                    {t(categoryLabel(grade))}
                                                </span>

                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-0">
                                                    <div
                                                        className={`h-full rounded-full ${band.bar} transition-all duration-500`}
                                                        style={{ width: `${Math.min(100, ratio * 100)}%` }}
                                                    />
                                                </div>

                                                <p className="text-xs font-black text-slate-800 shrink-0 tabular" dir="ltr">
                                                    {grade.score}
                                                    <span className="text-slate-300 font-bold"> / {grade.total}</span>
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Panel>
                    ))}
                </div>
            )}
        </Page>
    );
};
