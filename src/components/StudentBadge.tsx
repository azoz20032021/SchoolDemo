import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ScanLine } from 'lucide-react';
import { t } from '../i18n';

/**
 * The student's own card, on their phone.
 *
 * The same code that is printed on their plastic card, so a pupil who left it
 * at home holds up their screen at the gate instead of queueing at the office
 * for a replacement.
 *
 * It used to be a 160-pixel square in the middle of an otherwise empty block —
 * the largest thing on the home screen, for something looked at once a morning.
 * It is now a card: the code at the size a scanner needs and no larger, with
 * the number beside it, because the number is what the doorman types when the
 * scanner will not read a cracked screen.
 */
export const StudentBadge: React.FC<{ uid: string; name: string; className?: string }> = ({
    uid,
    name,
    className = '',
}) => {
    const [code, setCode] = useState('');

    useEffect(() => {
        let alive = true;
        QRCode.toDataURL(String(uid), {
            margin: 1,
            width: 240,
            errorCorrectionLevel: 'M',
            color: { dark: '#071553', light: '#ffffff' },
        })
            .then((url) => { if (alive) setCode(url); })
            .catch(() => { /* the number below still gets them through */ });
        return () => { alive = false; };
    }, [uid]);

    return (
        <div className={`px-4 pb-4 ${className}`}>
            <div className="relative overflow-hidden rounded-2xl bg-brand-900 text-white p-3.5 flex items-center gap-3.5">
                <div className="absolute -left-10 -bottom-12 w-32 h-32 bg-gold-500/20 rounded-full blur-2xl" />
                <div className="absolute -right-8 -top-12 w-28 h-28 bg-brand-500/40 rounded-full blur-2xl" />

                {code ? (
                    <img
                        src={code}
                        alt={uid}
                        className="relative w-[86px] h-[86px] rounded-xl bg-white p-1 shrink-0 ring-1 ring-gold-300/40"
                    />
                ) : (
                    <div className="relative w-[86px] h-[86px] rounded-xl bg-white/20 animate-pulse shrink-0" />
                )}

                <div className="relative min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-brand-200 truncate">{name}</p>
                    <p className="text-xl font-black tracking-[0.18em] mt-0.5 tabular" dir="ltr">{uid}</p>
                    <p className="text-[9px] font-bold text-gold-300 mt-1.5 flex items-center gap-1">
                        <ScanLine className="w-3 h-3 shrink-0" />
                        {t('اعرضه على بوابة المدرسة')}
                    </p>
                </div>
            </div>
        </div>
    );
};
