import React, { useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { inputClass, labelClass } from '../ui';
import { t } from '../../i18n';

/**
 * The gate an account opened with a temporary password must pass.
 *
 * A parent's account is created for them with their own telephone number as
 * both the sign-in name and the first password — nothing to deliver, nothing to
 * write down. That number is not a secret, so the account goes no further until
 * a real password replaces it: this screen is all there is until it does.
 */
export const PasswordSetup: React.FC<{ name: string; onLogout: () => void }> = ({ name, onLogout }) => {
    const { refresh } = useAuth();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            setError(t('كلمتا المرور غير متطابقتين'));
            return;
        }

        setBusy(true);
        setError('');
        try {
            await api.post('/api/set-initial-password', { newPassword: password });
            // Re-reading the account clears the flag and lets the app through.
            await refresh();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر حفظ كلمة المرور'));
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5 font-sans">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-7">
                <div className="w-16 h-16 bg-brand-50 text-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <ShieldCheck className="w-8 h-8" />
                </div>

                <h1 className="text-xl font-black text-slate-900 tracking-tight text-center">{t('اختر كلمة مرور خاصة بك')}</h1>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mt-2 text-center">
                    {t('أهلاً {name}، دخلت برقم هاتفك. لأن هذا الرقم يعرفه غيرك، اختر كلمة مرور خاصة بك قبل المتابعة.', { name })}
                </p>

                <form onSubmit={submit} className="space-y-3 mt-6">
                    <div>
                        <label className={labelClass}>{t('كلمة المرور الجديدة')}</label>
                        <input
                            type="password"
                            autoComplete="new-password"
                            className={inputClass}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('8 أحرف على الأقل، وتحتوي على حروف وأرقام')}
                            required
                        />
                    </div>

                    <div>
                        <label className={labelClass}>{t('تأكيد كلمة المرور')}</label>
                        <input
                            type="password"
                            autoComplete="new-password"
                            className={inputClass}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <p className="text-red-600 text-xs text-center bg-red-50 border border-red-100 rounded-xl py-2 px-3">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full bg-gradient-to-l from-brand-700 to-brand-500 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-brand-700/30 active:scale-[0.99] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        <KeyRound className="w-4 h-4" />
                        {busy ? t('جاري الحفظ...') : t('حفظ ومتابعة')}
                    </button>
                </form>

                <button
                    onClick={onLogout}
                    className="w-full mt-2 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                    <LogOut className="w-3.5 h-3.5" />
                    {t('تسجيل الخروج')}
                </button>
            </div>
        </div>
    );
};
