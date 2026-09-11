import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { t } from '../../i18n';

/**
 * The pieces every screen is built from.
 *
 * The application had grown a different arrangement of cards on every page —
 * each one reinvented its own header, its own idea of a statistic and its own
 * spacing — so it read as several applications sharing a colour. These are the
 * shapes the parent and student screens are now assembled from, and the reason
 * they look like one product.
 *
 * The rule the second draft added: a screen must have a loudest thing. The
 * first version gave every block the same white card and the same weight, so a
 * parent's eye had nowhere to land and the whole page read as filler however
 * much real information was on it. Headline figures are now solid colour, the
 * quiet blocks are genuinely quiet, and captions break the column into parts.
 */

/* ------------------------------------------------------------------ *
 * Page furniture
 * ------------------------------------------------------------------ */

export const Page: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`p-4 md:p-6 space-y-3.5 max-w-3xl lg:max-w-5xl mx-auto ${className}`}>{children}</div>
);

export const PageTitle: React.FC<{
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
    <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 font-bold mt-0.5">{subtitle}</p>}
        </div>
        {action}
    </div>
);

/**
 * A caption over a group of blocks.
 *
 * Without these the parent screen was one undifferentiated column of cards.
 * They cost a line of text each and turn it into three short lists.
 */
export const Section: React.FC<{ title: string; action?: React.ReactNode; className?: string }> = ({
    title,
    action,
    className = '',
}) => (
    <div className={`flex items-center gap-2.5 pt-2 px-1 ${className}`}>
        <span className="w-1 h-3.5 rounded-full bg-brand-500 shrink-0" />
        <h3 className="text-[11px] font-black text-slate-500 tracking-wide">{t(title)}</h3>
        <span className="flex-1 h-px bg-slate-900/[0.06]" />
        {action}
    </div>
);

/**
 * Two columns of panels, from a large screen up.
 *
 * A column of cards designed for a phone, shown unchanged in the middle of a
 * monitor, is the thing that made the desktop look unfinished. Above the large
 * breakpoint the same panels sit in two columns; a Section inside one spans
 * both, so the captions still divide the page rather than becoming a cell in
 * it. Below that width nothing changes at all.
 */
export const Split: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="space-y-3.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">{children}</div>
);

/* ------------------------------------------------------------------ *
 * The hero
 * ------------------------------------------------------------------ */

/**
 * The coloured band at the top of a personal screen.
 *
 * It carries the one fact the page is about — whose day this is — so the rest
 * of the screen can be quiet.
 */
export const Hero: React.FC<{
    title: string;
    subtitle?: string;
    badge?: string;
    initial?: string;
    action?: React.ReactNode;
    children?: React.ReactNode;
}> = ({ title, subtitle, badge, initial, action, children }) => (
    <div className="relative overflow-hidden rounded-[2rem] bg-brand-800 text-white p-5 pb-5 shadow-[0_20px_50px_-20px_rgba(7,21,83,0.85)] rise">
        {/*
         * Four soft lights rather than one flat gradient: it gives the band a
         * sense of depth at any width, and keeps its corners from going muddy
         * on a wide screen the way a two-stop gradient does.
         */}
        <div className="absolute -left-16 -top-24 w-64 h-64 bg-brand-500/55 rounded-full blur-3xl" />
        <div className="absolute right-0 -top-16 w-52 h-52 bg-brand-400/45 rounded-full blur-3xl" />
        <div className="absolute -right-12 -bottom-24 w-56 h-56 bg-gold-500/28 rounded-full blur-3xl" />
        <div className="absolute left-1/3 -bottom-6 w-44 h-32 bg-gold-400/18 rounded-full blur-3xl" />

        {/* A barely-there grid, so the colour has a texture instead of being a slab. */}
        <div
            className="absolute inset-0 opacity-[0.14]"
            style={{
                backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                backgroundSize: '26px 26px',
                maskImage: 'radial-gradient(120% 90% at 80% 0%, black, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(120% 90% at 80% 0%, black, transparent 70%)',
            }}
        />

        <div className="relative flex items-center gap-3.5">
            {initial && (
                <div className="w-16 h-16 rounded-[1.35rem] bg-white/15 ring-1 ring-white/30 backdrop-blur flex items-center justify-center text-2xl font-black shrink-0 shadow-lg shadow-black/20">
                    {initial}
                </div>
            )}
            <div className="min-w-0 flex-1">
                {badge && (
                    <span className="inline-block bg-white/15 ring-1 ring-white/25 rounded-full px-2.5 py-0.5 text-[10px] font-black mb-1.5">
                        {badge}
                    </span>
                )}
                <h2 className="text-[22px] font-black leading-tight truncate tracking-tight">{title}</h2>
                {subtitle && <p className="text-[11px] text-brand-200 font-bold mt-1 truncate">{subtitle}</p>}
            </div>
            {action}
        </div>

        {children && <div className="relative mt-4">{children}</div>}
    </div>
);

/**
 * The row of headline figures that sits inside the hero.
 *
 * One glass strip divided into columns, rather than four separate tiles: it
 * reads as a single statement about the child instead of four small boxes
 * competing with the name above them.
 */
export const HeroStats: React.FC<{ items: { label: string; value: React.ReactNode }[] }> = ({ items }) => (
    <div className="bg-white/[0.13] ring-1 ring-white/20 backdrop-blur-sm rounded-2xl flex overflow-hidden">
        {items.map((item, index) => (
            <div
                key={item.label}
                className={`flex-1 py-3 text-center min-w-0 ${index > 0 ? 'border-r border-white/15' : ''}`}
            >
                <p className="text-lg font-black leading-none tabular">{item.value}</p>
                <p className="text-[9px] font-bold text-brand-200 mt-1.5 truncate px-1">{t(item.label)}</p>
            </div>
        ))}
    </div>
);

/* ------------------------------------------------------------------ *
 * Numbers
 * ------------------------------------------------------------------ */

/** A single figure, sized for a row of four on a phone. */
export const Metric: React.FC<{
    label: string;
    value: React.ReactNode;
    hint?: string;
    tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
    icon?: React.ReactNode;
    onClick?: () => void;
}> = ({ label, value, hint, tone = 'indigo', icon, onClick }) => {
    const tones = {
        indigo: 'text-brand-800 from-brand-50 to-brand-100/40 ring-brand-100 shadow-brand-100/50',
        emerald: 'text-emerald-800 from-emerald-50 to-emerald-100/40 ring-emerald-100 shadow-emerald-100/50',
        amber: 'text-amber-800 from-amber-50 to-amber-100/40 ring-amber-100 shadow-amber-100/50',
        rose: 'text-rose-800 from-rose-50 to-rose-100/40 ring-rose-100 shadow-rose-100/50',
        sky: 'text-sky-800 from-sky-50 to-sky-100/40 ring-sky-100 shadow-sky-100/50',
    } as const;

    const Element = onClick ? 'button' : 'div';
    return (
        <Element
            onClick={onClick}
            className={`${tones[tone]} bg-gradient-to-b ring-1 rounded-2xl p-3.5 text-center w-full shadow-lg rise ${
                onClick ? 'active:scale-[0.97] hover:brightness-[0.99] transition-all' : ''
            }`}
        >
            {icon && <div className="flex justify-center mb-1.5 opacity-50">{icon}</div>}
            <p className="text-xl font-black leading-none tabular">{value}</p>
            <p className="text-[10px] font-bold opacity-70 mt-1.5 leading-tight">{label}</p>
            {hint && <p className="text-[9px] opacity-50 font-bold mt-0.5">{hint}</p>}
        </Element>
    );
};

/**
 * A figure that matters enough to be shouted.
 *
 * Solid colour, white type, and the number set large. The two things a parent
 * opens the application for — what is owed and whether the school has written
 * to them — are these; everything below them is a pale card on purpose.
 */
export const Headline: React.FC<{
    label: string;
    value: React.ReactNode;
    hint?: string;
    tone?: 'indigo' | 'emerald' | 'rose' | 'slate';
    icon?: React.ReactNode;
    badge?: React.ReactNode;
    onClick?: () => void;
}> = ({ label, value, hint, tone = 'indigo', icon, badge, onClick }) => {
    const tones = {
        indigo: 'from-brand-600 to-brand-400 shadow-brand-700/35',
        emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/35',
        rose: 'from-rose-500 to-red-600 shadow-rose-500/35',
        slate: 'from-slate-700 to-slate-900 shadow-slate-900/30',
    } as const;

    const Element = onClick ? 'button' : 'div';
    return (
        <Element
            onClick={onClick}
            className={`relative overflow-hidden bg-gradient-to-br ${tones[tone]} text-white rounded-[1.35rem] p-4 w-full text-right shadow-lg rise ${
                onClick ? 'active:scale-[0.98] transition-transform' : ''
            }`}
        >
            <div className="absolute -left-6 -bottom-10 w-28 h-28 bg-white/10 rounded-full blur-xl" />
            <div className="relative flex items-center gap-2 mb-2.5">
                {icon && (
                    <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                        {icon}
                    </span>
                )}
                <span className="text-[11px] font-black opacity-90 truncate">{label}</span>
                {badge}
            </div>
            <p className="relative text-[22px] font-black leading-none tabular truncate">{value}</p>
            {hint && <p className="relative text-[10px] font-bold opacity-75 mt-1.5 truncate">{hint}</p>}
        </Element>
    );
};

/* ------------------------------------------------------------------ *
 * Blocks
 * ------------------------------------------------------------------ */

const PANEL_TONES = {
    slate: 'bg-slate-100 text-slate-500',
    // "brand" is the name the rest of the palette uses; "indigo" is kept so the
    // screens written before the recolour keep working.
    brand: 'bg-brand-50 text-brand-700',
    indigo: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
} as const;

/** A titled white block. The workhorse of every screen. */
export const Panel: React.FC<{
    title?: string;
    note?: string;
    icon?: React.ReactNode;
    tone?: keyof typeof PANEL_TONES;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}> = ({ title, note, icon, tone = 'slate', action, children, className = '' }) => (
    <section
        className={`bg-white rounded-[1.5rem] ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-18px_rgba(15,23,42,0.25)] rise ${className}`}
    >
        {title && (
            <div className="flex items-center gap-2.5 px-4 pt-4 pb-2.5">
                {icon && (
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${PANEL_TONES[tone]}`}>
                        {icon}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-black text-slate-900 truncate tracking-tight">{title}</h3>
                    {note && <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">{note}</p>}
                </div>
                {action}
            </div>
        )}
        {children}
    </section>
);

/** A tappable row: icon, two lines of text, something on the left. */
export const Row: React.FC<{
    icon?: React.ReactNode;
    title: string;
    subtitle?: string;
    trailing?: React.ReactNode;
    onClick?: () => void;
    tone?: string;
}> = ({ icon, title, subtitle, trailing, onClick, tone = 'bg-slate-50 text-slate-500' }) => {
    const Element = onClick ? 'button' : 'div';
    return (
        <Element
            onClick={onClick}
            className={`w-full text-right px-4 py-3 flex items-center gap-3 ${
                onClick ? 'hover:bg-slate-50/70 transition-colors' : ''
            }`}
        >
            {icon && (
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${tone}`}>{icon}</div>
            )}
            <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-800 truncate">{title}</p>
                {subtitle && <p className="text-[11px] text-slate-400 font-bold mt-0.5 truncate">{subtitle}</p>}
            </div>
            {trailing}
            {onClick && !trailing && <ChevronLeft className="w-4 h-4 text-slate-300 shrink-0" />}
        </Element>
    );
};

/** Divides the rows inside a Panel. */
export const Rows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="divide-y divide-slate-100">{children}</div>
);

/**
 * A horizontal progress bar, used for a mark out of a hundred.
 *
 * The figure sits in a tinted pill rather than as loose text: at five subjects
 * stacked, a column of bare percentages was the hardest thing on the screen to
 * read, and the pill gives the eye the same colour cue as the bar.
 */
export const Meter: React.FC<{ value: number; label?: string }> = ({ value, label }) => {
    const clamped = Math.max(0, Math.min(100, value));
    const bar =
        clamped >= 70
            ? 'from-emerald-400 to-emerald-600'
            : clamped >= 50
                ? 'from-amber-400 to-amber-600'
                : 'from-rose-400 to-rose-600';
    const pill =
        clamped >= 70
            ? 'bg-emerald-50 text-emerald-700'
            : clamped >= 50
                ? 'bg-amber-50 text-amber-700'
                : 'bg-rose-50 text-rose-700';

    return (
        <div className="flex items-center gap-3">
            {label && <span className="text-xs font-black text-slate-700 w-24 shrink-0 truncate">{label}</span>}
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden ring-1 ring-slate-900/[0.04]">
                <div
                    className={`h-full rounded-full bg-gradient-to-l ${bar} transition-all duration-500`}
                    style={{ width: `${clamped}%` }}
                />
            </div>
            <span className={`text-[11px] font-black px-2 py-1 rounded-lg shrink-0 tabular ${pill}`}>{clamped}%</span>
        </div>
    );
};

/** Nothing here yet — said kindly, and in the middle of its block. */
export const Nothing: React.FC<{ message: string; hint?: string; icon?: React.ReactNode }> = ({
    message,
    hint,
    icon,
}) => (
    <div className="py-8 text-center px-4">
        {icon && <div className="flex justify-center mb-2 text-slate-200">{icon}</div>}
        <p className="text-xs font-bold text-slate-400">{t(message)}</p>
        {hint && <p className="text-[10px] text-slate-300 font-bold mt-1">{t(hint)}</p>}
    </div>
);

/** A row of chips used to switch between children, days or filters. */
export const Chips: React.FC<{
    items: { key: string; label: string; badge?: number }[];
    active: string;
    onPick: (key: string) => void;
}> = ({ items, active, onPick }) => (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {items.map((item) => (
            <button
                key={item.key}
                onClick={() => onPick(item.key)}
                className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    active === item.key
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                        : 'bg-white text-slate-500 ring-1 ring-slate-900/[0.06] hover:text-slate-700'
                }`}
            >
                {item.label}
                {item.badge ? (
                    <span
                        className={`min-w-4 h-4 px-1 rounded-full text-[9px] flex items-center justify-center ${
                            active === item.key ? 'bg-white/25' : 'bg-rose-500 text-white'
                        }`}
                    >
                        {item.badge > 9 ? '9+' : item.badge}
                    </span>
                ) : null}
            </button>
        ))}
    </div>
);
