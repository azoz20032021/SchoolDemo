import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { Role } from '../../types';
import { PRIMARY, SECONDARY } from '../../lib/nav';
import { t } from '../../i18n';

/**
 * The bar along the bottom.
 *
 * It floats rather than being welded to the edge of the screen, so it reads as
 * part of the application instead of part of the phone, and the destination you
 * are on is a filled pill in the school's blue — legible at a glance in a way a
 * tinted icon is not.
 *
 * "المزيد" used to open a sheet that slid over the screen. It is now a link to
 * a page like any other, because a sheet cannot be returned to, cannot be
 * linked to, and disappears the moment attention moves.
 */
export const Navbar: React.FC<{ role: Role }> = ({ role }) => {
    const primary = PRIMARY[role] || PRIMARY.student;
    const hasMore = (SECONDARY[role] || []).length > 0;

    const style = ({ isActive }: { isActive: boolean }) =>
        `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
            isActive
                ? 'bg-brand-700 text-white shadow-lg shadow-brand-700/35'
                : 'text-slate-400 hover:text-brand-700'
        }`;

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-1 print:hidden pointer-events-none">
            <div className="pointer-events-auto max-w-md mx-auto bg-white/90 backdrop-blur-xl ring-1 ring-slate-900/[0.07] shadow-[0_10px_36px_-10px_rgba(7,21,83,0.35)] rounded-[1.4rem] px-2 py-2 flex justify-around items-center">
                {primary.map(({ to, label, icon: Icon }) => (
                    <NavLink key={to} to={to} end={to === '/'} className={style}>
                        <Icon className="w-[18px] h-[18px]" />
                        <span className="text-[9px] font-black leading-none">{t(label)}</span>
                    </NavLink>
                ))}

                {hasMore && (
                    <NavLink to="/more" className={style}>
                        <LayoutGrid className="w-[18px] h-[18px]" />
                        <span className="text-[9px] font-black leading-none">{t('المزيد')}</span>
                    </NavLink>
                )}
            </div>
        </nav>
    );
};
