import React, { useEffect, useState } from 'react';
import {
    BadgeCheck, Check, Fingerprint, Globe, KeyRound, LogOut, Moon, ScrollText, ShieldCheck, Sun,
    User as UserIcon,
} from 'lucide-react';
import { AuditEntry, UserData } from '../types';
import { api, ApiError, formatDateTime } from '../lib/api';
import { isAdmin, useAuth } from '../context/AuthContext';
import { Badge, EmptyState, ErrorBanner, Spinner, inputClass, labelClass } from '../components/ui';
import { Page, PageTitle, Panel, Row, Rows, Section } from '../components/ui/shell';
import { useI18n } from '../i18n';
import { roleLabel } from '../lib/roles';
import { t } from '../i18n';

/**
 * The last page in the application, and the one that collects everything about
 * the person using it rather than about the school.
 *
 * The language switch and the sign-out button used to live as grey icons in the
 * header, where they were both permanently in the way and impossible to find if
 * you did not already know what the icons meant. They belong here, with the
 * profile and the password, in the order a person looks for them: who am I,
 * how does it look, how do I keep it safe, how do I leave.
 */

const ACTION_LABEL: Record<string, string> = {
    login: 'تسجيل دخول',
    login_failed: 'محاولة دخول فاشلة',
    password_change: 'تغيير كلمة مرور',
    password_reset: 'إعادة تعيين كلمة مرور',
    create: 'إضافة',
    update: 'تعديل',
    delete: 'حذف',
    approve: 'موافقة',
    reject: 'رفض',
    enroll: 'تسجيل بصف',
    attendance: 'تسجيل حضور',
    broadcast: 'إشعار جماعي',
    payment: 'دفعة مالية',
};

const ACTION_TONE: Record<string, 'emerald' | 'rose' | 'amber' | 'indigo' | 'slate'> = {
    delete: 'rose',
    reject: 'rose',
    login_failed: 'rose',
    approve: 'emerald',
    payment: 'emerald',
    create: 'indigo',
    update: 'amber',
};

/** Remembered per device; the school's screens are read in daylight and at 11pm. */
const THEME_KEY = 'school_theme';

export const Settings: React.FC<{ user: UserData }> = ({ user }) => {
    const { logout } = useAuth();
    const { lang, toggleLang } = useI18n();

    const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [theme, setTheme] = useState<'light' | 'dim'>(() => {
        try {
            return localStorage.getItem(THEME_KEY) === 'dim' ? 'dim' : 'light';
        } catch {
            return 'light';
        }
    });

    const [audit, setAudit] = useState<AuditEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState('');

    /**
     * "Dim" softens the page's brightness rather than inverting the interface:
     * a true dark mode would need every screen restated, and this is the thing
     * people actually ask for — a screen that does not glare at night.
     */
    useEffect(() => {
        document.documentElement.classList.toggle('dim', theme === 'dim');
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch {
            /* private browsing keeps the choice for this tab only */
        }
    }, [theme]);

    useEffect(() => {
        if (!isAdmin(user.role)) return;
        setAuditLoading(true);
        api.get<AuditEntry[]>('/api/admin/audit?limit=100')
            .then(setAudit)
            .catch((err) => setAuditError(err instanceof ApiError ? err.message : t('تعذر تحميل سجل العمليات')))
            .finally(() => setAuditLoading(false));
    }, [user.role]);

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (form.newPassword !== form.confirmPassword) {
            setError(t('كلمتا المرور الجديدتان غير متطابقتين'));
            return;
        }

        setBusy(true);
        try {
            await api.post('/api/change-password', {
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
            });
            setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setMessage(t('تم تغيير كلمة المرور بنجاح'));
            setShowPassword(false);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تغيير كلمة المرور'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Page>
            <PageTitle title={t('الإعدادات')} subtitle={t('ملفك، ولغة التطبيق، ومظهره، وأمان حسابك')} />

            {/* ------------------------------ the person ------------------------------ */}

            <div className="relative overflow-hidden rounded-[1.75rem] bg-brand-800 text-white p-5 shadow-[0_20px_50px_-20px_rgba(7,21,83,0.9)] rise">
                <div className="absolute -left-16 -top-20 w-56 h-56 bg-brand-500/50 rounded-full blur-3xl" />
                <div className="absolute -right-10 -bottom-20 w-52 h-52 bg-gold-500/25 rounded-full blur-3xl" />

                <div className="relative flex items-center gap-3.5">
                    <div className="w-16 h-16 rounded-[1.35rem] bg-white/15 ring-1 ring-white/30 backdrop-blur flex items-center justify-center text-2xl font-black shrink-0">
                        {user.name?.charAt(0) || <UserIcon className="w-6 h-6" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-black leading-tight truncate tracking-tight">{user.name}</h2>
                        <p className="text-[11px] font-bold text-gold-300 mt-1">{t(roleLabel(user.role))}</p>
                    </div>
                </div>

                <div className="relative mt-4 bg-white/[0.13] ring-1 ring-white/20 backdrop-blur-sm rounded-2xl flex overflow-hidden">
                    <div className="flex-1 py-3 text-center min-w-0">
                        <p className="text-sm font-black leading-none tabular" dir="ltr">{user.uid}</p>
                        <p className="text-[9px] font-bold text-brand-200 mt-1.5">{t('الرقم التعريفي')}</p>
                    </div>
                    <div className="flex-1 py-3 text-center min-w-0 border-r border-white/15">
                        <p className="text-sm font-black leading-none truncate px-2">
                            {user.status === 'suspended' ? t('موقوف') : t('نشط')}
                        </p>
                        <p className="text-[9px] font-bold text-brand-200 mt-1.5">{t('حالة الحساب')}</p>
                    </div>
                </div>
            </div>

            {/* ------------------------------ appearance ------------------------------ */}

            <Section title="اللغة والمظهر" />

            <Panel>
                <Rows>
                    <Row
                        icon={<Globe className="w-4 h-4" />}
                        tone="bg-brand-50 text-brand-700"
                        title={t('لغة التطبيق')}
                        subtitle={lang === 'ar' ? t('العربية') : 'English'}
                        onClick={toggleLang}
                        trailing={
                            <span className="text-[11px] font-black text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg shrink-0">
                                {lang === 'ar' ? 'English' : 'العربية'}
                            </span>
                        }
                    />
                    <Row
                        icon={theme === 'dim' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        tone="bg-gold-50 text-gold-600"
                        title={t('المظهر')}
                        subtitle={theme === 'dim' ? t('هادئ — أريح للعين ليلاً') : t('فاتح')}
                        trailing={
                            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
                                {(['light', 'dim'] as const).map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => setTheme(option)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                                            theme === option ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400'
                                        }`}
                                    >
                                        {option === 'light' ? t('فاتح') : t('هادئ')}
                                    </button>
                                ))}
                            </div>
                        }
                    />
                </Rows>
            </Panel>

            {/* -------------------------------- security -------------------------------- */}

            <Section title="أمان الحساب" />

            <Panel>
                <Rows>
                    <Row
                        icon={<KeyRound className="w-4 h-4" />}
                        tone="bg-violet-50 text-violet-600"
                        title={t('تغيير كلمة المرور')}
                        subtitle={t('8 أحرف على الأقل، وتحتوي على حروف وأرقام')}
                        onClick={() => setShowPassword((open) => !open)}
                    />
                </Rows>

                {showPassword && (
                    <form onSubmit={changePassword} className="px-4 pb-4 pt-1 space-y-3">
                        <div>
                            <label className={labelClass}>{t('كلمة المرور الحالية')}</label>
                            <input
                                type="password" autoComplete="current-password" className={inputClass}
                                value={form.currentPassword}
                                onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>{t('كلمة المرور الجديدة')}</label>
                            <input
                                type="password" autoComplete="new-password" className={inputClass}
                                value={form.newPassword}
                                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>{t('تأكيد كلمة المرور الجديدة')}</label>
                            <input
                                type="password" autoComplete="new-password" className={inputClass}
                                value={form.confirmPassword}
                                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                                required
                            />
                        </div>

                        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

                        <button
                            type="submit"
                            disabled={busy}
                            className="w-full bg-gradient-to-l from-brand-700 to-brand-500 text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-brand-700/30 disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                            <KeyRound className="w-4 h-4" />
                            {busy ? t('جاري الحفظ...') : t('تغيير كلمة المرور')}
                        </button>
                    </form>
                )}

                {message && !showPassword && (
                    <p className="mx-4 mb-4 bg-emerald-50 ring-1 ring-emerald-200/70 text-emerald-700 rounded-2xl p-3 text-xs font-black flex items-center gap-2">
                        <Check className="w-4 h-4 shrink-0" />
                        {message}
                    </p>
                )}
            </Panel>

            {/* ------------------------------ the audit log ------------------------------ */}

            {isAdmin(user.role) && (
                <>
                    <Section title="سجل العمليات" />

                    <Panel
                        title={t('آخر 100 عملية')}
                        icon={<ScrollText className="w-4 h-4" />}
                        tone="slate"
                        note={t('من فعلها ومتى')}
                    >
                        {auditError && <div className="px-4 pb-4"><ErrorBanner message={auditError} /></div>}

                        {auditLoading ? (
                            <Spinner />
                        ) : audit.length === 0 ? (
                            <EmptyState message={t('لا توجد عمليات مسجلة بعد')} />
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
                                {audit.map((entry) => (
                                    <div key={entry.id} className="px-4 py-3.5 flex items-start gap-3">
                                        <Badge tone={ACTION_TONE[entry.action] || 'slate'}>
                                            {t(ACTION_LABEL[entry.action] || entry.action)}
                                        </Badge>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                                {entry.summary}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-1">
                                                {entry.actor_name} ({t(roleLabel(entry.actor_role))})
                                                {' · '}{formatDateTime(entry.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </>
            )}

            {/* --------------------------------- the exit --------------------------------- */}

            <Section title="عن التطبيق" />

            <Panel>
                <Rows>
                    <Row
                        icon={<BadgeCheck className="w-4 h-4" />}
                        tone="bg-emerald-50 text-emerald-600"
                        title={t('ثانوية المعالي الأهلية')}
                        subtitle={t('نظام إدارة شؤون الطلاب')}
                        trailing={<span className="text-[10px] font-black text-slate-300 tabular">v2.0</span>}
                    />
                    <Row
                        icon={<ShieldCheck className="w-4 h-4" />}
                        tone="bg-sky-50 text-sky-600"
                        title={t('خصوصية بياناتك')}
                        subtitle={t('بياناتك محفوظة لدى المدرسة ولا تُشارك مع أي جهة')}
                    />
                    <Row
                        icon={<Fingerprint className="w-4 h-4" />}
                        tone="bg-slate-100 text-slate-500"
                        title={t('الجلسة الحالية')}
                        subtitle={t('تنتهي تلقائياً بعد فترة من عدم الاستخدام')}
                    />
                </Rows>

                <div className="p-4 pt-2">
                    <button
                        onClick={logout}
                        className="w-full bg-rose-50 ring-1 ring-rose-200/70 text-rose-600 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        {t('تسجيل الخروج')}
                    </button>
                </div>
            </Panel>
        </Page>
    );
};
