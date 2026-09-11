import React from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Role, UserData } from '../../types';
import { PRIMARY, SECONDARY, groupsFor } from '../../lib/nav';
import { roleLabel } from '../../lib/roles';
import { t } from '../../i18n';

/**
 * The desktop navigation.
 *
 * The application was drawn for a phone and then shown on a monitor: a narrow
 * column of cards marooned in the middle of a 1080p screen, with a floating pill
 * of five icons at the bottom edge — a thumb control a metre away from anyone's
 * thumb. On a desktop the office spends its whole day in this, so from a large
 * screen up the bar is replaced by a real sidebar that shows every destination
 * at once, grouped, with no "more" to open.
 *
 * Below that width it does not exist and the bottom bar takes over, so the
 * phone keeps the layout it was designed for.
 */
export const Sidebar: React.FC<{ user: UserData; onLogout: () => void }> = ({ user, onLogout }) => {
    const role = user.role as Role;
    const primary = PRIMARY[role] || PRIMARY.student;
    const groups = groupsFor(role);
    const hasSecondary = (SECONDARY[role] || []).length > 0;

    const style = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-black transition-all ${
            isActive
                ? 'bg-white text-brand-800 shadow-lg shadow-brand-950/30'
                : 'text-brand-100 hover:bg-white/10 hover:text-white'
        }`;

    return (
        <aside className="hidden lg:flex fixed inset-y-0 right-0 w-72 z-[110] print:hidden flex-col bg-brand-900 text-white">
            {/* The same lights the header and the heroes are built from. */}
            <div className="absolute -right-16 -top-20 w-64 h-64 bg-brand-500/40 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-16 bottom-1/3 w-56 h-56 bg-gold-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative px-5 pt-6 pb-5">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-brand-950/40 ring-1 ring-gold-300/40 overflow-hidden">
                        <img src="/logo.png" alt={t('شعار المدرسة')} className="w-full h-full object-contain p-1" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-black leading-tight">{t('ثانوية المعالي الأهلية')}</p>
                        <p className="text-[10px] font-bold text-gold-300 mt-0.5">{t('نظام إدارة شؤون الطلاب')}</p>
                    </div>
                </div>
            </div>

            <div className="gold-rule h-px mx-5" />

            <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {primary.map(({ to, label, icon: Icon }) => (
                    <NavLink key={to} to={to} end={to === '/'} className={style}>
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        <span className="truncate">{t(label)}</span>
                    </NavLink>
                ))}

                {hasSecondary &&
                    groups.map((group) => (
                        <div key={group.title} className="pt-4">
                            <p className="px-3 pb-1.5 text-[10px] font-black text-brand-300 tracking-wide">
                                {t(group.title)}
                            </p>
                            {group.items.map(({ to, label, icon: Icon }) => (
                                <NavLink key={to} to={to} className={style}>
                                    <Icon className="w-[18px] h-[18px] shrink-0" />
                                    <span className="truncate">{t(label)}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
            </nav>

            <div className="relative px-3 pb-4 pt-2 border-t border-white/10">
                <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center text-sm font-black shrink-0">
                        {user.name?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-black truncate">{user.name}</p>
                        <p className="text-[10px] font-bold text-brand-300 truncate">{t(roleLabel(user.role))}</p>
                    </div>
                </div>

                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-black text-rose-200 hover:bg-rose-500/20 transition-colors"
                >
                    <LogOut className="w-[18px] h-[18px] shrink-0" />
                    {t('تسجيل الخروج')}
                </button>
            </div>
        </aside>
    );
};
