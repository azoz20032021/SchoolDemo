import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { UserData } from '../types';
import { Page, PageTitle, Section } from '../components/ui/shell';
import { NAV_TONES, groupsFor } from '../lib/nav';
import { roleLabel } from '../lib/roles';
import { t } from '../i18n';

/**
 * Everything that does not fit in the bottom bar.
 *
 * This was a sheet that slid up over whatever you were reading and closed
 * itself the moment you looked away, which is a poor way to present a dozen
 * destinations: nothing could be titled, nothing could be grouped, and there
 * was no way back to it. As a page the same links can be sorted into the parts
 * of the day they belong to, each one saying what it actually opens.
 */
export const More: React.FC<{ user: UserData }> = ({ user }) => {
    const groups = groupsFor(user.role);

    return (
        <Page>
            <PageTitle title={t('كل الأقسام')} subtitle={t(roleLabel(user.role))} />

            {groups.map((group) => (
                <div key={group.title} className="space-y-3">
                    <Section title={group.title} />

                    <div className="grid grid-cols-2 gap-3">
                        {group.items.map(({ to, label, note, icon: Icon, tone = 'slate' }) => (
                            <Link
                                key={to}
                                to={to}
                                className="group bg-white rounded-[1.35rem] ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-18px_rgba(15,23,42,0.3)] p-4 flex flex-col gap-2.5 active:scale-[0.98] transition-transform rise"
                            >
                                <div
                                    className={`w-11 h-11 rounded-2xl ring-1 flex items-center justify-center ${NAV_TONES[tone]}`}
                                >
                                    <Icon className="w-5 h-5" />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-[13px] font-black text-slate-900 leading-tight">{t(label)}</p>
                                    {note && (
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 leading-snug line-clamp-2">
                                            {t(note)}
                                        </p>
                                    )}
                                </div>

                                <ChevronLeft className="w-4 h-4 text-slate-300 mt-auto group-hover:text-brand-600 transition-colors" />
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </Page>
    );
};
