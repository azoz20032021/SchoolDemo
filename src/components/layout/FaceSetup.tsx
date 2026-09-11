import React, { useEffect, useState } from 'react';
import { ScanFace, ShieldCheck, SkipForward } from 'lucide-react';
import { api } from '../../lib/api';
import { FaceEnroll } from '../FaceEnroll';
import { t } from '../../i18n';

/**
 * Asking a student for their face the first time they sign in.
 *
 * It cannot be asked at registration: an applicant has no account yet, so there
 * is nothing to attach a face to, and the registration form is a public page —
 * putting the recogniser there would make every passer-by download seven
 * megabytes of models for a school they may never join. The first sign-in is
 * the first moment there is both an account and somebody proven to hold its
 * password, which is exactly what enrolment needs.
 *
 * It is a screen rather than a card because a card gets scrolled past. It is
 * skippable, though, and that is deliberate: a student whose phone has no
 * camera, or who is signing in on a school computer, must still be able to read
 * their own marks. Skipping lasts for that visit only, so the question comes
 * back tomorrow — and the office can always enrol them at the counter.
 */
export const FaceSetup: React.FC<{ name: string; onSkip: () => void; onDone: () => void }> = ({
    name,
    onSkip,
    onDone,
}) => {
    const [enrolling, setEnrolling] = useState(false);

    return (
        <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-5 font-sans relative overflow-hidden">
            <div className="absolute -left-24 -top-24 w-96 h-96 bg-brand-500/40 rounded-full blur-3xl" />
            <div className="absolute -right-20 top-10 w-80 h-80 bg-brand-400/30 rounded-full blur-3xl" />
            <div className="absolute right-1/4 -bottom-24 w-96 h-96 bg-gold-500/20 rounded-full blur-3xl" />

            <div className="relative w-full max-w-md bg-white rounded-[1.75rem] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.5)] p-7 ring-1 ring-white/10">
                <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center -mt-16 shadow-lg shadow-brand-700/30 ring-4 ring-white">
                        <ScanFace className="w-9 h-9" />
                    </div>

                    <h1 className="text-xl font-black text-slate-900 tracking-tight mt-4">
                        {t('أهلاً')} {name}
                    </h1>
                    <p className="text-[13px] font-bold text-slate-500 mt-2 leading-relaxed">
                        {t('سجّل وجهك مرة واحدة، وبعدها تدخل من بوابة المدرسة بدون بطاقة.')}
                    </p>
                </div>

                <div className="mt-5 space-y-2.5">
                    {[
                        ['ثلاث لقطات من كاميرا هاتفك', ScanFace],
                        ['لا تُحفظ أي صورة — يُحوَّل وجهك إلى أرقام فقط', ShieldCheck],
                    ].map(([label, Icon]: any) => (
                        <div key={label} className="flex items-center gap-3 bg-slate-50 ring-1 ring-slate-900/[0.06] rounded-2xl p-3">
                            <div className="w-9 h-9 rounded-xl bg-white ring-1 ring-slate-900/[0.06] text-brand-700 flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4" />
                            </div>
                            <p className="text-[11px] font-bold text-slate-600 leading-snug">{t(label)}</p>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => setEnrolling(true)}
                    className="mt-5 w-full bg-gradient-to-l from-brand-700 to-brand-500 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-brand-700/30 active:scale-[0.99] transition-transform"
                >
                    {t('سجّل وجهي الآن')}
                </button>

                <button
                    onClick={onSkip}
                    className="mt-2 w-full text-slate-400 py-2.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 hover:text-slate-600 transition-colors"
                >
                    <SkipForward className="w-3.5 h-3.5" />
                    {t('لاحقاً — ادخل بالبطاقة')}
                </button>
            </div>

            {enrolling && (
                <FaceEnroll mode="self" onClose={() => setEnrolling(false)} onDone={onDone} />
            )}
        </div>
    );
};

/**
 * Whether this student still needs to be asked.
 *
 * Enrolment is a one-way door, so once the answer is yes it is remembered on
 * the device and the server is never asked again — otherwise the question would
 * cost a database read every time any student opened the application.
 */
const DONE_KEY = 'school_face_done';
const SKIP_KEY = 'school_face_skipped';

export function useFaceSetup(userId: string, role: string): {
    needed: boolean;
    skip: () => void;
    complete: () => void;
} {
    const [enrolled, setEnrolled] = useState<boolean | null>(null);
    const [skipped, setSkipped] = useState(() => {
        try {
            return sessionStorage.getItem(SKIP_KEY) === userId;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        if (role !== 'student') {
            setEnrolled(true);
            return;
        }

        let known = false;
        try {
            known = localStorage.getItem(DONE_KEY) === userId;
        } catch {
            /* private browsing: ask the server, as before */
        }

        if (known) {
            setEnrolled(true);
            return;
        }

        api.get<{ enrolled: boolean }>('/api/faces/mine')
            .then((res) => {
                const yes = Boolean(res?.enrolled);
                setEnrolled(yes);
                if (yes) remember(userId);
            })
            // A school not using face entry answers an error; never block on it.
            .catch(() => setEnrolled(true));
    }, [userId, role]);

    return {
        // Never shown while the answer is still unknown: a blank blocking screen
        // on every sign-in would be worse than never asking at all.
        needed: enrolled === false && !skipped,
        skip: () => {
            setSkipped(true);
            try {
                sessionStorage.setItem(SKIP_KEY, userId);
            } catch {
                /* the question returns on the next navigation, which is acceptable */
            }
        },
        complete: () => {
            setEnrolled(true);
            remember(userId);
        },
    };
}

function remember(userId: string): void {
    try {
        localStorage.setItem(DONE_KEY, userId);
    } catch {
        /* private browsing: the question is asked again next time */
    }
}
