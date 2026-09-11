import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { IdCard, Printer } from 'lucide-react';
import { ClassData } from '../../types';
import { api, ApiError } from '../../lib/api';
import { ErrorBanner, Spinner, inputClass } from '../../components/ui';
import { Nothing, Page, PageTitle, Panel } from '../../components/ui/shell';
import { t } from '../../i18n';

/**
 * The cards the gate reads.
 *
 * A scanner at the door is useless without something to scan, so this is where
 * the school prints one card per student: their name, their class, and a QR
 * code carrying the identifying number the gate expects. Twelve to a sheet of
 * A4, cut apart, laminated, done.
 *
 * The code holds the plain UID and nothing else — no name, no link, nothing
 * that would matter if a card were dropped in the street. Losing one is losing
 * a number that is already printed on it in words.
 */

interface Student {
    id: string;
    name: string;
    uid: string;
    class_id: string | null;
    class_name: string;
}

const SCHOOL_NAME = 'ثانوية المعالي الأهلية';

export const StudentCards: React.FC = () => {
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [classId, setClassId] = useState('');
    const [students, setStudents] = useState<Student[]>([]);
    const [codes, setCodes] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [drawing, setDrawing] = useState(false);
    const [error, setError] = useState('');

    /** Draw a QR for each card. Done once per list, not once per render. */
    const drawCodes = useCallback(async (list: Student[]) => {
        setDrawing(true);
        try {
            const entries = await Promise.all(
                list.map(async (student) => [
                    student.id,
                    await QRCode.toDataURL(String(student.uid), {
                        margin: 1,
                        width: 220,
                        errorCorrectionLevel: 'M',
                    }),
                ] as const)
            );
            setCodes(Object.fromEntries(entries));
        } catch {
            setError(t('تعذر توليد رموز البطاقات'));
        } finally {
            setDrawing(false);
        }
    }, []);

    const load = useCallback(async (selectedClass: string) => {
        setError('');
        try {
            const params = new URLSearchParams({ limit: '200' });
            if (selectedClass) params.set('class_id', selectedClass);

            const res = await api.get<{ data: Student[] }>(`/api/admin/students?${params}`);
            const list = res.data || [];
            setStudents(list);
            await drawCodes(list);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تحميل قائمة الطلاب'));
        }
    }, [drawCodes]);

    useEffect(() => {
        api.get<ClassData[]>('/api/classes')
            .then(async (list) => {
                setClasses(list);
                const first = list[0]?.id || '';
                setClassId(first);
                await load(first);
            })
            .catch((err) => setError(err instanceof ApiError ? err.message : t('تعذر تحميل الصفوف')))
            .finally(() => setLoading(false));
    }, [load]);

    if (loading) return <div className="p-6"><Spinner label={t('جاري التحميل')} /></div>;

    return (
        <Page className="print:max-w-none print:p-0">
            <div className="print:hidden space-y-4">
                <PageTitle
                    title={t('بطاقات الطلاب')}
                    subtitle={t('اطبعها وقصّها — تُقرأ ببوابة المدرسة')}
                    action={
                        <button
                            onClick={() => window.print()}
                            disabled={students.length === 0 || drawing}
                            className="bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Printer className="w-4 h-4" />
                            {t('طباعة')}
                        </button>
                    }
                />

                {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

                <select
                    className={inputClass}
                    value={classId}
                    onChange={(e) => { setClassId(e.target.value); load(e.target.value); }}
                >
                    <option value="">{t('كل الصفوف')}</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                {drawing && <Spinner label={t('جاري تجهيز البطاقات')} />}
            </div>

            {students.length === 0 && !drawing ? (
                <Panel className="print:hidden">
                    <Nothing icon={<IdCard className="w-10 h-10" />} message="لا يوجد طلاب في هذا الصف" />
                </Panel>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
                    {students.map((student) => (
                        <div
                            key={student.id}
                            className="print-block bg-white border-2 border-slate-800 rounded-xl p-3 text-center break-inside-avoid"
                        >
                            <p className="text-[9px] font-black text-slate-500 border-b border-slate-200 pb-1 mb-2">
                                {t(SCHOOL_NAME)}
                            </p>

                            {codes[student.id] ? (
                                <img
                                    src={codes[student.id]}
                                    alt={student.uid}
                                    className="w-24 h-24 mx-auto"
                                />
                            ) : (
                                <div className="w-24 h-24 mx-auto bg-slate-50 rounded" />
                            )}

                            <p className="text-[11px] font-black text-slate-900 mt-2 leading-tight">{student.name}</p>
                            <p className="text-[9px] font-bold text-slate-500 mt-0.5">{student.class_name}</p>
                            <p className="text-xs font-black text-slate-800 tracking-widest mt-1" dir="ltr">
                                {student.uid}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </Page>
    );
};
