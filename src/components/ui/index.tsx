import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Inbox, Loader2, X } from 'lucide-react';
import { t } from '../../i18n';

/**
 * Small shared building blocks. The dashboards were repeating the same card,
 * modal and empty-state markup a dozen times each; collecting them here keeps
 * the screens consistent and much shorter.
 *
 * They are also the reason the rest of the application can be restyled at all.
 * The parent and student screens were rebuilt on ./shell, but every other page
 * — homework, the timetable, conduct, subjects, settings — draws its card, its
 * field and its empty state from here, so these definitions are what decide
 * whether the application looks like one piece of work. They now match the
 * shell: a hairline ring instead of a grey border, a shadow with some depth to
 * it, and fields that sit slightly recessed rather than outlined.
 */

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
    className = '',
    children,
}) => (
    <div
        className={`bg-white rounded-[1.5rem] ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-18px_rgba(15,23,42,0.25)] rise ${className}`}
    >
        {children}
    </div>
);

export const SectionTitle: React.FC<{
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
    <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
            <h3 className="font-black text-slate-900 text-[15px] tracking-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400 font-bold mt-0.5">{subtitle}</p>}
        </div>
        {action}
    </div>
);

export const StatCard: React.FC<{
    label: string;
    value: React.ReactNode;
    hint?: string;
    tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
    icon?: React.ReactNode;
    onClick?: () => void;
}> = ({ label, value, hint, tone = 'slate', icon, onClick }) => {
    const tones = {
        indigo: 'from-brand-50 to-brand-100/40 text-brand-800 ring-brand-100',
        emerald: 'from-emerald-50 to-emerald-100/40 text-emerald-800 ring-emerald-100',
        amber: 'from-amber-50 to-amber-100/40 text-amber-800 ring-amber-100',
        rose: 'from-rose-50 to-rose-100/40 text-rose-800 ring-rose-100',
        slate: 'from-white to-slate-50 text-slate-900 ring-slate-900/[0.06]',
    } as const;

    const Element = onClick ? 'button' : 'div';
    return (
        <Element
            onClick={onClick}
            className={`${tones[tone]} bg-gradient-to-b ring-1 rounded-2xl p-4 text-right w-full shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] rise ${
                onClick ? 'hover:brightness-[0.99] transition-all active:scale-[0.98]' : ''
            }`}
        >
            <div className="flex items-center justify-between mb-1.5 gap-2">
                <p className="text-[10px] font-black tracking-wide opacity-70 truncate">{label}</p>
                <span className="opacity-60 shrink-0">{icon}</span>
            </div>
            <p className="text-[22px] font-black leading-tight tabular">{value}</p>
            {hint && <p className="text-[10px] opacity-60 font-bold mt-1">{hint}</p>}
        </Element>
    );
};

export const Badge: React.FC<{
    tone?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
    children: React.ReactNode;
}> = ({ tone = 'slate', children }) => {
    const tones = {
        emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
        amber: 'bg-amber-50 text-amber-700 ring-amber-200/70',
        rose: 'bg-rose-50 text-rose-700 ring-rose-200/70',
        indigo: 'bg-brand-50 text-brand-700 ring-brand-200/70',
        slate: 'bg-slate-50 text-slate-600 ring-slate-200/70',
    } as const;
    return (
        <span
            className={`${tones[tone]} ring-1 text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap`}
        >
            {children}
        </span>
    );
};

export const Modal: React.FC<{
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    wide?: boolean;
}> = ({ open, onClose, title, subtitle, children, wide }) => (
    <AnimatePresence>
        {open && (
            <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                    onClick={onClose}
                />
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40 }}
                    className={`relative bg-white w-full ${
                        wide ? 'md:max-w-3xl' : 'md:max-w-md'
                    } rounded-t-[1.75rem] md:rounded-[1.75rem] shadow-[0_24px_64px_-16px_rgba(4,13,51,0.45)] max-h-[92vh] flex flex-col overflow-hidden`}
                >
                    {/* A grab handle: on a phone this panel rises from the edge. */}
                    <div className="md:hidden pt-2.5 flex justify-center shrink-0">
                        <span className="w-10 h-1 rounded-full bg-slate-200" />
                    </div>

                    <div className="flex items-start justify-between gap-4 p-5 pb-4 border-b border-slate-900/[0.06] shrink-0">
                        <div className="min-w-0">
                            <h3 className="font-black text-slate-900 tracking-tight">{title}</h3>
                            {subtitle && <p className="text-[11px] text-slate-400 font-bold mt-0.5">{subtitle}</p>}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
                            aria-label={t('إغلاق')}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-5 overflow-y-auto">{children}</div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
);

export const EmptyState: React.FC<{ message: string; hint?: string }> = ({ message, hint }) => (
    <div className="py-12 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 ring-1 ring-slate-900/[0.05] flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-black text-slate-500">{message}</p>
        {hint && <p className="text-[11px] text-slate-400 font-bold mt-1">{hint}</p>}
    </div>
);

export const Spinner: React.FC<{ label?: string }> = ({ label }) => (
    <div className="py-12 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
        {label && <p className="text-xs text-slate-400 font-bold">{label}</p>}
    </div>
);

export const ErrorBanner: React.FC<{ message: string; onDismiss?: () => void }> = ({ message, onDismiss }) => (
    <div className="bg-rose-50 ring-1 ring-rose-200/70 text-rose-700 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs shadow-[0_8px_24px_-16px_rgba(190,18,60,0.6)]">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="flex-1 font-bold leading-relaxed">{message}</p>
        {onDismiss && (
            <button onClick={onDismiss} className="opacity-60 hover:opacity-100" aria-label={t('إخفاء')}>
                <X className="w-3.5 h-3.5" />
            </button>
        )}
    </div>
);

/**
 * One field style for the whole application.
 *
 * Recessed rather than outlined: a page of outlined boxes reads as a form to be
 * endured, and the ring keeps the box from moving by a pixel when it is focused
 * the way a thickening border does.
 */
export const inputClass =
    'w-full px-4 py-2.5 rounded-xl bg-slate-50 ring-1 ring-slate-900/[0.07] text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all placeholder:font-medium placeholder:text-slate-400';

export const labelClass = 'block text-[11px] font-black text-slate-600 mb-1.5';

/** The application's one button. Pages were each inventing their own. */
export const buttonClass =
    'bg-gradient-to-l from-brand-700 to-brand-500 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-brand-700/30 flex items-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:shadow-none';
