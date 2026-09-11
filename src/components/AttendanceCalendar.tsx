import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localeOf, t } from '../i18n';

/**
 * A month of attendance at a glance.
 *
 * A list of dates tells a parent nothing; a grid tells them "he was late three
 * Tuesdays running" without anyone having to work it out. Weekends are drawn
 * flat, days with no record stay blank, and the key sits above so the colours
 * need no explaining.
 */

interface Record_ {
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused' | string;
}

const TONE: Record<string, string> = {
    present: 'bg-emerald-500 text-white',
    absent: 'bg-rose-500 text-white',
    late: 'bg-amber-500 text-white',
    excused: 'bg-slate-400 text-white',
};

const KEY = [
    { status: 'present', label: 'حاضر' },
    { status: 'absent', label: 'غائب' },
    { status: 'late', label: 'متأخر' },
    { status: 'excused', label: 'بعذر' },
];

/** Sunday first, matching both the Iraqi school week and Date.getDay(). */
const WEEKDAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

const iso = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const AttendanceCalendar: React.FC<{ records: Record_[] }> = ({ records }) => {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());

    const byDate = useMemo(() => {
        const map = new Map<string, string>();
        records.forEach((r) => map.set(r.date, r.status));
        return map;
    }, [records]);

    const { cells, summary } = useMemo(() => {
        const first = new Date(year, month, 1).getDay();
        const days = new Date(year, month + 1, 0).getDate();

        const list: ({ day: number; date: string; status?: string } | null)[] = [];
        for (let i = 0; i < first; i++) list.push(null);
        for (let day = 1; day <= days; day++) {
            const date = iso(year, month, day);
            list.push({ day, date, status: byDate.get(date) });
        }

        const counts = { present: 0, absent: 0, late: 0, excused: 0 };
        list.forEach((cell) => {
            if (cell?.status && cell.status in counts) counts[cell.status as keyof typeof counts]++;
        });

        return { cells: list, summary: counts };
    }, [year, month, byDate]);

    const move = (delta: number) => {
        const next = new Date(year, month + delta, 1);
        setYear(next.getFullYear());
        setMonth(next.getMonth());
    };

    const monthName = new Date(year, month, 1).toLocaleDateString(localeOf(), { month: 'long', year: 'numeric' });

    return (
        <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={() => move(-1)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50"
                    aria-label={t('الشهر السابق')}
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
                <p className="text-xs font-black text-slate-700">{monthName}</p>
                <button
                    onClick={() => move(1)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50"
                    aria-label={t('الشهر التالي')}
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((day) => (
                    <div key={day} className="text-[9px] font-black text-slate-400 text-center py-1">
                        {t(day)}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, i) => {
                    if (!cell) return <div key={`blank-${i}`} />;

                    const weekend = new Date(year, month, cell.day).getDay() === 5;
                    const tone = cell.status ? TONE[cell.status] : '';

                    return (
                        <div
                            key={cell.date}
                            title={cell.date}
                            className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-black ${
                                tone || (weekend ? 'bg-slate-50 text-slate-300' : 'bg-slate-50/60 text-slate-400')
                            }`}
                        >
                            {cell.day}
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3">
                {KEY.map((item) => (
                    <div key={item.status} className="flex items-center gap-1">
                        <span className={`w-2.5 h-2.5 rounded ${TONE[item.status]}`} />
                        <span className="text-[10px] font-bold text-slate-500">
                            {t(item.label)}
                            {summary[item.status as keyof typeof summary] > 0 && (
                                <span className="text-slate-400"> {summary[item.status as keyof typeof summary]}</span>
                            )}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
