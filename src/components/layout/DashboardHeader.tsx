import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { UserData } from '../../types';
import { api, formatDateTime } from '../../lib/api';
import { roleLabel } from '../../lib/roles';
import { t } from '../../i18n';

interface DashboardHeaderProps {
    user: UserData;
    onLogout: () => void;
}

/**
 * How often the badge is refreshed.
 *
 * This poll runs in every open tab in the school, so its cost is multiplied by
 * everyone signed in. It now asks the server for a single number rather than
 * for twenty notifications, and asks less often: together that is roughly a
 * sixtieth of the database reads the old one-minute list poll cost. Three
 * minutes is still fast enough that nobody notices a delay on a school
 * announcement.
 */
const POLL_INTERVAL_MS = 180_000;

/**
 * The bar across the top of every screen.
 *
 * It used to be a white strip carrying five grey icons — a settings cog, a
 * language switch, a sign-out button — which is a toolbar, not a masthead: it
 * told you nothing about where you were and it was the first thing anyone saw.
 * It is now the school's own blue with the crest in it, and it says whose
 * school this is and who is signed in. The four utilities moved to the settings
 * page, which is where a person goes looking for them anyway, leaving one
 * control here: the bell.
 */
export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ user }) => {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingList, setLoadingList] = useState(false);
    const [showNotifs, setShowNotifs] = useState(false);
    const timerRef = useRef<number | null>(null);

    /** The poll: one number, nothing else. */
    const fetchUnreadCount = useCallback(async () => {
        try {
            const res = await api.get<{ count: number }>(`/api/notifications/${user.id}/unread-count`);
            setUnreadCount(res?.count ?? 0);
        } catch {
            // A failed poll is not worth interrupting the user for.
        }
    }, [user.id]);

    /** The list, fetched only when someone actually opens the panel. */
    const fetchNotifications = useCallback(async () => {
        setLoadingList(true);
        try {
            const data = await api.get<any[]>(`/api/notifications/${user.id}`);
            const rows = Array.isArray(data) ? data : [];
            setNotifications(rows);
            // The list is authoritative while it is on screen.
            setUnreadCount(rows.filter((n) => !n.isRead).length);
        } catch {
            /* the panel keeps whatever it already had */
        } finally {
            setLoadingList(false);
        }
    }, [user.id]);

    const openNotifications = () => {
        const opening = !showNotifs;
        setShowNotifs(opening);
        if (opening) fetchNotifications();
    };

    /**
     * Poll only while the tab is visible. The previous version kept a 30s timer
     * running in every background tab, so a class of students left open all day
     * generated a steady stream of pointless requests.
     */
    useEffect(() => {
        const start = () => {
            if (timerRef.current !== null) return;
            fetchUnreadCount();
            timerRef.current = window.setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
        };
        const stop = () => {
            if (timerRef.current === null) return;
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        };
        const onVisibility = () => (document.hidden ? stop() : start());

        if (!document.hidden) start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            stop();
        };
    }, [fetchUnreadCount]);

    const markAsRead = async (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
        try {
            await api.post(`/api/notifications/read/${id}`);
        } catch {
            fetchNotifications(); // put the badge back if the server disagreed
        }
    };

    const markAllRead = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        try {
            await api.post('/api/notifications/read-all');
        } catch {
            fetchNotifications();
        }
    };

    return (
        <header className="sticky top-0 z-[100] print:hidden">
            <div className="relative overflow-hidden bg-brand-900 text-white rounded-b-[1.75rem] shadow-[0_10px_30px_-14px_rgba(7,21,83,0.8)]">
                {/* The crest's blue, lit rather than flat. */}
                <div className="absolute -left-16 -top-20 w-56 h-56 bg-brand-500/50 rounded-full blur-3xl" />
                <div className="absolute right-1/4 -top-24 w-52 h-52 bg-brand-400/30 rounded-full blur-3xl" />
                <div className="absolute -right-10 -bottom-16 w-44 h-44 bg-gold-500/20 rounded-full blur-3xl" />

                <div className="relative px-4 md:px-6 py-3 flex items-center justify-between gap-3 max-w-3xl lg:max-w-5xl mx-auto">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="lg:hidden w-11 h-11 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-brand-950/30 ring-1 ring-gold-300/40 overflow-hidden">
                            <img
                                src="/logo.png"
                                alt={t('شعار المدرسة')}
                                className="w-full h-full object-contain p-1"
                            />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-[13px] font-black leading-tight truncate">{user.name}</h2>
                            <p className="text-[10px] font-bold text-gold-300 mt-0.5 truncate">
                                {t(roleLabel(user.role))}
                                <span className="text-brand-200"> · {t('ثانوية المعالي الأهلية')}</span>
                            </p>
                        </div>
                    </div>

                    <div className="relative shrink-0">
                        <button
                            onClick={openNotifications}
                            className={`p-2.5 rounded-xl transition-all relative ring-1 ${
                                showNotifs
                                    ? 'bg-white/25 ring-white/30 text-white'
                                    : 'bg-white/10 ring-white/15 text-white/90 hover:bg-white/20'
                            }`}
                            aria-label={t('الإشعارات')}
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gold-400 text-brand-950 text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-brand-900">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        <AnimatePresence>
                            {showNotifs && (
                                <>
                                    <div className="fixed inset-0 z-[190]" onClick={() => setShowNotifs(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        /*
                                         * On a phone the panel is pinned near the top of the
                                         * screen. From small screens up it hangs under the bell —
                                         * and for that it has to be positioned against the bell
                                         * rather than the window: "top: 100%" on a fixed element
                                         * means a full screen height down, which put the whole
                                         * panel below the fold where nobody could see it.
                                         */
                                        className="fixed inset-x-3 top-20 sm:absolute sm:inset-x-auto sm:top-full sm:mt-3 ltr:sm:right-0 rtl:sm:left-0 sm:w-80 max-h-[80vh] sm:max-h-[32rem] bg-white rounded-[1.5rem] shadow-[0_24px_64px_-16px_rgba(4,13,51,0.45)] ring-1 ring-slate-900/[0.06] overflow-hidden z-[200] flex flex-col"
                                    >
                                        <div className="p-4 border-b border-slate-900/[0.06] flex justify-between items-center shrink-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-black text-slate-900 text-sm">{t('الإشعارات')}</h4>
                                                {unreadCount > 0 && (
                                                    <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-[10px] font-black">
                                                        {unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {unreadCount > 0 && (
                                                    <button
                                                        onClick={markAllRead}
                                                        className="text-[10px] font-black text-brand-600 flex items-center gap-1 hover:underline"
                                                    >
                                                        <CheckCheck className="w-3 h-3" />
                                                        {t('تعليم الكل كمقروء')}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setShowNotifs(false)}
                                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg sm:hidden transition-colors"
                                                    aria-label={t('إغلاق')}
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="overflow-y-auto overscroll-contain py-1 flex-1 max-h-[calc(80vh-70px)] sm:max-h-96">
                                            {loadingList && notifications.length === 0 ? (
                                                <p className="py-10 text-center text-xs font-bold text-slate-400">
                                                    {t('جاري التحميل...')}
                                                </p>
                                            ) : notifications.length > 0 ? (
                                                notifications.map((n) => (
                                                    <div
                                                        key={n.id}
                                                        className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors flex gap-3 ${
                                                            !n.isRead ? 'bg-brand-50/50' : ''
                                                        }`}
                                                    >
                                                        <div
                                                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                                                n.type === 'absence'
                                                                    ? 'bg-rose-50 text-rose-500'
                                                                    : n.type === 'invoice' || n.type === 'payment'
                                                                        ? 'bg-gold-50 text-gold-600'
                                                                        : 'bg-emerald-50 text-emerald-500'
                                                            }`}
                                                        >
                                                            <Bell className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 space-y-1 min-w-0">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <p className="text-xs font-black text-slate-800">{n.title}</p>
                                                                {!n.isRead && (
                                                                    <button
                                                                        onClick={() => markAsRead(n.id)}
                                                                        className="p-1 hover:bg-white rounded-md transition-colors shrink-0"
                                                                        aria-label={t('تعليم كمقروء')}
                                                                    >
                                                                        <Check className="w-3 h-3 text-emerald-500" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                                                {n.message}
                                                            </p>
                                                            <p className="text-[9px] text-slate-300 font-bold">
                                                                {formatDateTime(n.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-10 text-center">
                                                    <p className="text-xs text-slate-400 font-bold">
                                                        {t('لا توجد إشعارات حالياً')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* The crest's second colour, closing the blue. */}
                <div className="gold-rule h-px w-full" />
            </div>
        </header>
    );
};
