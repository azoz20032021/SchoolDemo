import React, { useEffect, useRef, useState } from 'react';
import { Camera, ShieldCheck, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { ErrorBanner, Modal } from './ui';
import { StudentPicker, PickableStudent } from './StudentPicker';
import { MATCH_THRESHOLD, describeFace, loadFaceEngine } from '../lib/face';
import { t } from '../i18n';

/**
 * Teaching the door a face.
 *
 * Three captures rather than one, because a single straight-on photograph fails
 * the moment the child tilts their head at the door. Each capture is turned
 * into numbers here in the browser and the picture is discarded before it has
 * been anywhere — what leaves this dialog is three arrays of 128 numbers.
 *
 * The same dialog serves two people. The office opens it to enrol anyone, and
 * picks the student first. A student opens it from their own screen to enrol
 * themselves, and there is nobody to pick.
 */

/** How many angles an enrolment captures. Three is enough and not tedious. */
export const ENROL_SAMPLES = 3;

export const FaceEnroll: React.FC<{
    /** "self" hides the picker and posts to the caller's own account. */
    mode: 'admin' | 'self';
    onClose: () => void;
    onDone: () => void;
}> = ({ mode, onClose, onDone }) => {
    const [studentId, setStudentId] = useState('');
    const [student, setStudent] = useState<PickableStudent | null>(null);
    const [samples, setSamples] = useState<number[][]>([]);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [ready, setReady] = useState(false);
    const [saving, setSaving] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const self = mode === 'self';
    const chosen = self || Boolean(studentId);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                await loadFaceEngine((message) => { if (!cancelled) setStatus(t(message)); });
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setReady(true);
                setStatus('');
            } catch {
                if (!cancelled) {
                    setStatus('');
                    setError(t('تعذر فتح الكاميرا أو تحميل النماذج — تأكد من السماح للموقع باستخدام الكاميرا'));
                }
            }
        })();

        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        };
    }, []);

    const capture = async () => {
        if (!videoRef.current) return;
        setError('');
        setStatus(t('جاري القراءة...'));

        const face = await describeFace(videoRef.current);
        if (!face) {
            setStatus('');
            setError(t('لم يُقرأ وجه واحد واضح — تأكد من وجود شخص واحد أمام الكاميرا وإضاءة جيدة'));
            return;
        }

        setSamples((prev) => [...prev, face.descriptor]);
        setStatus('');
    };

    const save = async () => {
        if (!chosen || samples.length === 0) return;
        setSaving(true);
        setError('');
        try {
            await api.post(self ? '/api/faces/mine' : `/api/faces/${studentId}`, { descriptors: samples });
            onDone();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر حفظ بصمة الوجه'));
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!studentId) return;
        if (!confirm(t('حذف بصمة وجه هذا الطالب؟'))) return;
        setSaving(true);
        try {
            await api.del(`/api/faces/${studentId}`);
            onDone();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر الحذف'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={self ? t('سجّل وجهك') : t('تسجيل وجه طالب')}
            subtitle={t('تُخزَّن أرقام فقط — لا تُحفظ أي صورة')}
        >
            <div className="space-y-4">
                {!self && (
                    <StudentPicker
                        value={studentId}
                        onChange={(id, picked) => { setStudentId(id); setStudent(picked); setSamples([]); }}
                        label={t('الطالب')}
                        placeholder={t('ابحث بالاسم أو الرقم')}
                        hint={t('اختر الطالب أولاً ثم التقط ثلاث لقطات')}
                    />
                )}

                {self && (
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed bg-slate-50 ring-1 ring-slate-900/[0.06] rounded-2xl p-3.5">
                        {t('انظر إلى الكاميرا والتقط ثلاث لقطات: واحدة من الأمام، وواحدة بإمالة بسيطة يميناً، وواحدة يساراً. بعدها تدخل من البوابة بوجهك.')}
                    </p>
                )}

                <div className="rounded-2xl overflow-hidden bg-black relative">
                    <video ref={videoRef} className="w-full max-h-64 object-cover scale-x-[-1]" muted playsInline />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-36 h-48 border-4 border-white/70 rounded-[50%]" />
                    </div>
                </div>

                {/* One dot per angle, so whoever is enrolling can see how far they are. */}
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: ENROL_SAMPLES }).map((_, i) => (
                        <span
                            key={i}
                            className={`w-2.5 h-2.5 rounded-full transition-colors ${
                                i < samples.length ? 'bg-emerald-500' : 'bg-slate-200'
                            }`}
                        />
                    ))}
                    <span className="text-[11px] font-black text-slate-500 mr-2 tabular">
                        {samples.length} / {ENROL_SAMPLES}
                    </span>
                </div>

                {status && <p className="text-[11px] font-bold text-slate-500 text-center">{status}</p>}
                {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={capture}
                        disabled={!ready || !chosen || samples.length >= ENROL_SAMPLES}
                        className="bg-white ring-1 ring-slate-900/[0.07] text-slate-700 py-3 rounded-xl text-xs font-black disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                        <Camera className="w-4 h-4" />
                        {t('التقاط لقطة')}
                    </button>
                    <button
                        onClick={() => setSamples([])}
                        disabled={samples.length === 0}
                        className="bg-white ring-1 ring-slate-900/[0.07] text-slate-500 py-3 rounded-xl text-xs font-black disabled:opacity-40"
                    >
                        {t('إعادة البدء')}
                    </button>
                </div>

                <button
                    onClick={save}
                    disabled={saving || !chosen || samples.length < ENROL_SAMPLES}
                    className="w-full bg-gradient-to-l from-brand-700 to-brand-500 text-white py-3.5 rounded-xl text-sm font-black shadow-lg shadow-brand-700/30 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <ShieldCheck className="w-4 h-4" />
                    {saving
                        ? t('جاري الحفظ...')
                        : student ? `${t('حفظ وجه')} ${student.name}` : t('حفظ')}
                </button>

                {!self && studentId && (
                    <button
                        onClick={remove}
                        disabled={saving}
                        className="w-full text-rose-600 py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 hover:bg-rose-50 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('حذف بصمة وجه هذا الطالب')}
                    </button>
                )}

                <p className="text-[10px] text-slate-400 font-bold leading-relaxed text-center">
                    {self
                        ? t('لا تُحفظ صورتك. يُحوَّل وجهك إلى 128 رقماً لا يمكن إعادتها إلى صورة.')
                        : t('يرفض النظام المطابقة إذا كان الوجهان متقاربين، فيُطلب من الطالب استخدام بطاقته.')}
                    {' '}
                    {!self && <>{t('حد التطابق')} {MATCH_THRESHOLD}</>}
                </p>
            </div>
        </Modal>
    );
};
