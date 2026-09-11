import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Camera, CameraOff, CheckCircle2, DoorOpen, LogIn, LogOut, ScanLine, Trash2, UserRoundCheck,
    XCircle,
} from 'lucide-react';
import { UserData } from '../../types';
import { api, ApiError } from '../../lib/api';
import { Badge, ErrorBanner, inputClass } from '../../components/ui';
import { Chips, Nothing, Panel, Row, Rows, Section } from '../../components/ui/shell';
import { FaceEnroll } from '../../components/FaceEnroll';
import { FaceProfile, describeFace, loadFaceEngine, matchFace } from '../../lib/face';
import { t } from '../../i18n';

/**
 * The tablet at the school door.
 *
 * It reads a student two ways and the school may use either or both.
 *
 * The card is the reliable one: whatever produces the number — the tablet's own
 * camera on a QR code, a barcode gun, an RFID pad — ends up typing it, so the
 * screen listens for a number arriving however it arrives. The keyboard field is
 * deliberately always focused, because a scanner is a keyboard that types very
 * fast and presses Enter, and if the focus is anywhere else the scan is lost.
 *
 * The face is the convenient one, and it is deliberately the second option
 * rather than the only one. It runs entirely on this tablet, it refuses to
 * guess between two similar faces, and when it refuses the child shows their
 * card — which is why the card never goes away.
 *
 * Either way the number reaches /gate/scan, so both share every rule about
 * duplicate reads, marking the register and telling the parent at home.
 */

interface Scanned {
    ok: boolean;
    name: string;
    detail: string;
    duplicate?: boolean;
}

interface Enrolled {
    student_id: string;
    student_name: string;
    samples: number;
    enrolled_by: 'admin' | 'student';
}

interface GateEvent {
    id: string;
    student_name: string;
    class_name: string;
    direction: 'in' | 'out';
    method?: string;
    at?: { seconds?: number };
}

const clock = (at?: { seconds?: number }) =>
    at?.seconds ? new Date(at.seconds * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';

/** The face loop's interval. Fast enough to feel instant, slow enough not to cook the tablet. */
const FACE_TICK_MS = 500;

/** After a face is accepted, ignore that same face for a moment. */
const FACE_COOLDOWN_MS = 5000;

export const Gate: React.FC<{ user: UserData }> = ({ user }) => {
    const [direction, setDirection] = useState<'in' | 'out'>('in');
    const [mode, setMode] = useState<'code' | 'face'>('code');
    const [code, setCode] = useState('');
    const [last, setLast] = useState<Scanned | null>(null);
    const [events, setEvents] = useState<GateEvent[]>([]);
    const [counts, setCounts] = useState({ arrived: 0, departed: 0, inside: 0 });
    const [camera, setCamera] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    /* face */
    const [faceStatus, setFaceStatus] = useState('');
    const [faceReady, setFaceReady] = useState(false);
    const [profiles, setProfiles] = useState<FaceProfile[]>([]);
    const [showEnrol, setShowEnrol] = useState(false);
    const [enrolled, setEnrolled] = useState<Enrolled[]>([]);

    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const cooldownRef = useRef<Map<string, number>>(new Map());

    const isAdmin = user.role === 'admin';

    const loadToday = useCallback(async () => {
        try {
            const res = await api.get<{ events: GateEvent[]; arrived: number; departed: number; inside: number }>(
                '/api/gate/today'
            );
            setEvents(res.events || []);
            setCounts({ arrived: res.arrived, departed: res.departed, inside: res.inside });
        } catch {
            /* the running list is supplementary; scanning still works */
        }
    }, []);

    useEffect(() => { loadToday(); }, [loadToday]);

    /*
     * The list of enrolled faces, and who put each one there.
     *
     * Letting students enrol themselves is what makes face entry possible at
     * two hundred children, but a student enrolling at home is a student nobody
     * watched — so the office needs to be able to see which faces those are and
     * remove one. Marking them and then never showing the mark would have been
     * a safeguard in name only.
     */
    const loadEnrolled = useCallback(async () => {
        if (user.role !== 'admin') return;
        try {
            setEnrolled(await api.get<Enrolled[]>('/api/faces/enrolled'));
        } catch {
            /* the list is supplementary; the door still works without it */
        }
    }, [user.role]);

    useEffect(() => { loadEnrolled(); }, [loadEnrolled]);

    const forgetFace = async (studentId: string, name: string) => {
        if (!confirm(`${t('حذف بصمة وجه')} ${name}?`)) return;
        try {
            await api.del(`/api/faces/${studentId}`);
            loadEnrolled();
            api.get<FaceProfile[]>('/api/faces').then(setProfiles).catch(() => undefined);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر الحذف'));
        }
    };

    const submitCode = useCallback(async (raw: string, method: string = 'scan') => {
        const value = raw.trim();
        if (!value || busy) return;

        setBusy(true);
        setError('');
        try {
            const res = await api.post<{ duplicate: boolean; notified: number; student: { name: string; class_name: string } }>(
                '/api/gate/scan',
                { code: value, direction, method }
            );

            setLast({
                ok: true,
                name: res.student.name,
                detail: res.duplicate
                    ? t('سُجّل قبل قليل')
                    : res.notified > 0
                        ? `${res.student.class_name} · ${t('تم إشعار ولي الأمر')}`
                        : res.student.class_name,
                duplicate: res.duplicate,
            });
            loadToday();
        } catch (err) {
            setLast({ ok: false, name: t('لم يُقرأ'), detail: err instanceof ApiError ? err.message : t('تعذر التسجيل') });
        } finally {
            setCode('');
            setBusy(false);
            if (mode === 'code') inputRef.current?.focus();
            // Clear the confirmation so the next child sees their own result.
            setTimeout(() => setLast(null), 6000);
        }
    }, [direction, busy, loadToday, mode]);

    /* ------------------------------ the camera ------------------------------ */

    useEffect(() => {
        if (!camera) {
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            return;
        }

        let stopped = false;

        const start = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: mode === 'face' ? 'user' : 'environment' },
                });
                if (stopped) { stream.getTracks().forEach((tr) => tr.stop()); return; }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } catch {
                setCameraError(t('تعذر فتح الكاميرا — تأكد من السماح للموقع باستخدامها'));
                setCamera(false);
            }
        };

        start();
        return () => {
            stopped = true;
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        };
    }, [camera, mode]);

    /* --------------------------- reading a barcode --------------------------- */

    useEffect(() => {
        if (!camera || mode !== 'code') return;

        let stopped = false;
        let timer: number;

        const Detector = (window as any).BarcodeDetector;
        if (!Detector) {
            setCameraError(t('هذا المتصفح لا يدعم قراءة الرموز بالكاميرا — استخدم قارئاً أو أدخل الرقم يدوياً'));
            return;
        }

        const detector = new Detector({ formats: ['qr_code', 'code_128', 'ean_13'] });

        const tick = async () => {
            if (stopped || !videoRef.current) return;
            try {
                const found = await detector.detect(videoRef.current);
                if (found.length > 0 && found[0].rawValue) {
                    await submitCode(String(found[0].rawValue), 'barcode');
                    // Long enough that one card is not read twice over.
                    timer = window.setTimeout(tick, 2500);
                    return;
                }
            } catch {
                /* a frame that could not be read is not worth reporting */
            }
            timer = window.setTimeout(tick, 350);
        };

        tick();
        return () => { stopped = true; window.clearTimeout(timer); };
    }, [camera, mode, submitCode]);

    /* ---------------------------- reading a face ---------------------------- */

    /** Load the models and the enrolled descriptors, once, when face mode opens. */
    useEffect(() => {
        if (mode !== 'face' || faceReady) return;

        let cancelled = false;

        (async () => {
            try {
                await loadFaceEngine((message) => { if (!cancelled) setFaceStatus(t(message)); });
                if (cancelled) return;

                setFaceStatus(t('جاري تحميل الوجوه المسجلة...'));
                const rows = await api.get<FaceProfile[]>('/api/faces');
                if (cancelled) return;

                setProfiles(rows);
                setFaceReady(true);
                setFaceStatus(
                    rows.length === 0
                        ? t('لا توجد وجوه مسجلة بعد — سجّل الطلاب أولاً')
                        : `${t('جاهز')} — ${rows.length} ${t('وجه مسجل')}`
                );
            } catch (err) {
                if (cancelled) return;
                setFaceStatus('');
                setError(err instanceof ApiError ? err.message : t('تعذر تحميل نظام التعرف على الوجه'));
                setMode('code');
            }
        })();

        return () => { cancelled = true; };
    }, [mode, faceReady]);

    /** The loop: look, match, submit. */
    useEffect(() => {
        if (mode !== 'face' || !camera || !faceReady || profiles.length === 0) return;

        let stopped = false;
        let timer: number;

        const tick = async () => {
            if (stopped || !videoRef.current) return;

            try {
                const face = await describeFace(videoRef.current);
                if (face) {
                    const match = matchFace(face.descriptor, profiles);

                    if (match) {
                        const until = cooldownRef.current.get(match.profile.student_id) || 0;
                        if (Date.now() > until) {
                            cooldownRef.current.set(match.profile.student_id, Date.now() + FACE_COOLDOWN_MS);
                            await submitCode(match.profile.uid, 'face');
                        }
                    }
                }
            } catch {
                /* one bad frame is not worth a message at a door */
            }

            if (!stopped) timer = window.setTimeout(tick, FACE_TICK_MS);
        };

        tick();
        return () => { stopped = true; window.clearTimeout(timer); };
    }, [mode, camera, faceReady, profiles, submitCode]);

    /* A scanner types into whatever holds the focus, so it must be that field. */
    useEffect(() => {
        if (mode !== 'code') return;
        const keep = () => inputRef.current?.focus();
        const timer = window.setInterval(keep, 1500);
        keep();
        return () => window.clearInterval(timer);
    }, [mode]);

    /* ------------------------------------------------------------------ */

    const selfEnrolled = enrolled.filter((row) => row.enrolled_by === 'student').length;

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-3xl lg:max-w-5xl mx-auto">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('بوابة المدرسة')}</h2>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">
                        {mode === 'face'
                            ? t('اجعل الطالب ينظر إلى الكاميرا')
                            : t('امسح بطاقة الطالب أو أدخل رقمه التعريفي')}
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setDirection('in')}
                        className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ring-1 transition-colors ${
                            direction === 'in'
                                ? 'bg-emerald-600 text-white ring-emerald-600 shadow-lg shadow-emerald-500/25'
                                : 'bg-white text-slate-500 ring-slate-900/[0.07]'
                        }`}
                    >
                        <LogIn className="w-4 h-4" />
                        {t('دخول')}
                    </button>
                    <button
                        onClick={() => setDirection('out')}
                        className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ring-1 transition-colors ${
                            direction === 'out'
                                ? 'bg-brand-900 text-white ring-brand-900 shadow-lg shadow-brand-900/25'
                                : 'bg-white text-slate-500 ring-slate-900/[0.07]'
                        }`}
                    >
                        <LogOut className="w-4 h-4" />
                        {t('خروج')}
                    </button>
                </div>
            </div>

            {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
            {cameraError && <ErrorBanner message={cameraError} onDismiss={() => setCameraError('')} />}

            {/* Which reader is in charge. Both stay available at all times. */}
            <Chips
                items={[
                    { key: 'code', label: t('بطاقة / باركود') },
                    { key: 'face', label: t('التعرف على الوجه') },
                ]}
                active={mode}
                onPick={(key) => {
                    setMode(key as 'code' | 'face');
                    setCameraError('');
                    setLast(null);
                }}
            />

            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'دخلوا اليوم', value: counts.arrived, tone: 'text-emerald-700 bg-emerald-50 ring-emerald-100' },
                    { label: 'داخل المدرسة', value: counts.inside, tone: 'text-brand-700 bg-brand-50 ring-brand-100' },
                    { label: 'غادروا', value: counts.departed, tone: 'text-slate-700 bg-slate-50 ring-slate-200' },
                ].map((item) => (
                    <div key={item.label} className={`${item.tone} ring-1 rounded-2xl p-3 text-center`}>
                        <p className="text-2xl font-black leading-none tabular">{item.value}</p>
                        <p className="text-[10px] font-bold opacity-70 mt-1">{t(item.label)}</p>
                    </div>
                ))}
            </div>

            {/* The confirmation the child at the door looks at. */}
            <div
                className={`rounded-[1.5rem] p-6 text-center transition-colors ring-1 ${
                    !last
                        ? 'bg-white ring-slate-900/[0.06] border-dashed'
                        : last.ok
                            ? last.duplicate
                                ? 'bg-amber-50 ring-amber-200'
                                : 'bg-emerald-50 ring-emerald-200'
                            : 'bg-rose-50 ring-rose-200'
                }`}
            >
                {!last ? (
                    <>
                        <DoorOpen className="w-10 h-10 mx-auto text-slate-200 mb-2" />
                        <p className="text-sm font-black text-slate-400">
                            {mode === 'face' ? t('بانتظار وجه...') : t('بانتظار المسح...')}
                        </p>
                    </>
                ) : (
                    <>
                        {last.ok ? (
                            <CheckCircle2 className={`w-12 h-12 mx-auto mb-2 ${last.duplicate ? 'text-amber-500' : 'text-emerald-600'}`} />
                        ) : (
                            <XCircle className="w-12 h-12 mx-auto mb-2 text-rose-600" />
                        )}
                        <p className="text-2xl font-black text-slate-900">{last.name}</p>
                        <p className="text-xs font-bold text-slate-500 mt-1">{last.detail}</p>
                    </>
                )}
            </div>

            {/* The number, always available — it is what a doorman falls back on. */}
            <form onSubmit={(e) => { e.preventDefault(); submitCode(code, 'manual'); }} className="flex gap-2">
                <input
                    ref={inputRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={`${inputClass} text-center text-lg font-black tracking-widest`}
                    placeholder={t('الرقم التعريفي')}
                    dir="ltr"
                    autoComplete="off"
                    inputMode="numeric"
                />
                <button
                    type="submit"
                    disabled={busy || !code.trim()}
                    className="bg-brand-700 text-white px-6 rounded-xl text-sm font-black shrink-0 disabled:opacity-50"
                >
                    {t('تسجيل')}
                </button>
            </form>

            <button
                onClick={() => { setCameraError(''); setCamera((on) => !on); }}
                className={`w-full py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 ring-1 transition-colors ${
                    camera ? 'bg-brand-900 text-white ring-brand-900' : 'bg-white text-slate-600 ring-slate-900/[0.07]'
                }`}
            >
                {camera ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                {camera
                    ? t('إيقاف الكاميرا')
                    : mode === 'face' ? t('تشغيل التعرف على الوجه') : t('المسح بالكاميرا')}
            </button>

            {mode === 'face' && faceStatus && (
                <p className="text-[11px] font-bold text-slate-500 text-center flex items-center justify-center gap-1.5">
                    <ScanLine className="w-3.5 h-3.5 shrink-0" />
                    {faceStatus}
                </p>
            )}

            {camera && (
                <div className="rounded-[1.5rem] overflow-hidden bg-black relative">
                    <video
                        ref={videoRef}
                        className={`w-full max-h-80 object-cover ${mode === 'face' ? 'scale-x-[-1]' : ''}`}
                        muted
                        playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div
                            className={`border-4 border-white/70 ${
                                mode === 'face' ? 'w-44 h-56 rounded-[50%]' : 'w-40 h-40 rounded-2xl'
                            }`}
                        />
                    </div>
                </div>
            )}

            {isAdmin && (
                <>
                    <Section title="إدارة الوجوه" />

                    <Panel>
                        <Rows>
                            <Row
                                icon={<UserRoundCheck className="w-4 h-4" />}
                                tone="bg-brand-50 text-brand-700"
                                title={t('تسجيل وجه طالب')}
                                subtitle={t('ثلاث لقطات من زوايا مختلفة، تُخزَّن كأرقام لا كصور')}
                                onClick={() => setShowEnrol(true)}
                            />
                        </Rows>

                        <p className="text-[10px] text-slate-400 font-bold px-4 pb-4 leading-relaxed">
                            {t('لا تُحفظ أي صورة للطالب. يُحوَّل الوجه إلى 128 رقماً لا يمكن إعادتها إلى صورة، وتتم المطابقة على هذا الجهاز وحده.')}
                        </p>
                    </Panel>

                    <Panel
                        title={t('الوجوه المسجلة')}
                        icon={<ScanLine className="w-4 h-4" />}
                        tone="violet"
                        note={
                            selfEnrolled > 0
                                ? `${enrolled.length} ${t('طالب')} · ${selfEnrolled} ${t('سجّلوا بأنفسهم')}`
                                : `${enrolled.length} ${t('طالب')}`
                        }
                    >
                        {enrolled.length === 0 ? (
                            <Nothing
                                message="لا توجد وجوه مسجلة بعد"
                                hint="سيظهر هنا كل طالب سجّل وجهه، ومن سجّله"
                            />
                        ) : (
                            <div className="max-h-80 overflow-y-auto">
                                <Rows>
                                    {enrolled.map((row) => (
                                        <Row
                                            key={row.student_id}
                                            icon={<UserRoundCheck className="w-4 h-4" />}
                                            tone={
                                                row.enrolled_by === 'student'
                                                    ? 'bg-amber-50 text-amber-600'
                                                    : 'bg-emerald-50 text-emerald-600'
                                            }
                                            title={row.student_name || row.student_id}
                                            subtitle={`${row.samples} ${t('لقطة')}`}
                                            trailing={
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge tone={row.enrolled_by === 'student' ? 'amber' : 'emerald'}>
                                                        {row.enrolled_by === 'student' ? t('سجّله الطالب') : t('سجّلته الإدارة')}
                                                    </Badge>
                                                    <button
                                                        onClick={() => forgetFace(row.student_id, row.student_name)}
                                                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                        aria-label={t('حذف')}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            }
                                        />
                                    ))}
                                </Rows>
                            </div>
                        )}

                        {selfEnrolled > 0 && (
                            <p className="text-[10px] text-amber-700 bg-amber-50 ring-1 ring-amber-200/70 rounded-xl font-bold mx-4 mb-4 px-3 py-2 leading-relaxed">
                                {t('الوجوه التي سجّلها الطلاب بأنفسهم لم يشهدها أحد من الإدارة. راجعها إذا شككت في واحدة واحذفها.')}
                            </p>
                        )}
                    </Panel>
                </>
            )}

            <Panel title={t('آخر الحركات')} note={`${events.length}`}>
                {events.length === 0 ? (
                    <Nothing message="لم يُسجّل أحد بعد اليوم" />
                ) : (
                    <Rows>
                        {events.map((event) => (
                            <Row
                                key={event.id}
                                icon={event.direction === 'in' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                                tone={event.direction === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}
                                title={event.student_name}
                                subtitle={`${event.class_name}${event.method === 'face' ? ` · ${t('بالوجه')}` : ''}`}
                                trailing={
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge tone={event.direction === 'in' ? 'emerald' : 'slate'}>
                                            {event.direction === 'in' ? t('دخول') : t('خروج')}
                                        </Badge>
                                        <span className="text-[11px] font-black text-slate-500 tabular" dir="ltr">
                                            {clock(event.at)}
                                        </span>
                                    </div>
                                }
                            />
                        ))}
                    </Rows>
                )}
            </Panel>

            {showEnrol && (
                <FaceEnroll
                    mode="admin"
                    onClose={() => setShowEnrol(false)}
                    onDone={() => {
                        setShowEnrol(false);
                        // The tablet must pick up the new face without a reload.
                        api.get<FaceProfile[]>('/api/faces').then(setProfiles).catch(() => undefined);
                        loadEnrolled();
                    }}
                />
            )}
        </div>
    );
};
