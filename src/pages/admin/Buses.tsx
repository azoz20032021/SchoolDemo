import React, { useCallback, useEffect, useState } from 'react';
import { Bus, MapPin, Phone, Plus, Trash2, Users } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { isAdmin, useAuth } from '../../context/AuthContext';
import { Badge, ErrorBanner, Modal, Spinner, inputClass, labelClass } from '../../components/ui';
import { Chips, Nothing, Page, PageTitle, Panel, Row, Rows } from '../../components/ui/shell';
import { StudentPicker } from '../../components/StudentPicker';
import { t } from '../../i18n';

/**
 * The school's transport, from the office.
 *
 * The status buttons are the part that earns its place: a supervisor taps "set
 * off" and every family on that route is told, instead of thirty of them
 * telephoning to ask where the bus is.
 */

interface BusLine {
    id: string;
    name: string;
    plate?: string;
    driver_name?: string;
    driver_phone?: string;
    supervisor_name?: string;
    supervisor_phone?: string;
    capacity?: number;
    stops?: string[];
    departure_time?: string;
    return_time?: string;
    status: string;
    status_text: string;
    riders: number;
}

interface Rider {
    id: string;
    name: string;
    uid: string;
    class_name: string;
    stop: string;
    guardian_phone: string;
}

const STATUSES = [
    { key: 'idle', label: 'في الموقف' },
    { key: 'morning_route', label: 'انطلق صباحاً' },
    { key: 'at_school', label: 'وصل المدرسة' },
    { key: 'evening_route', label: 'انطلق للعودة' },
    { key: 'finished', label: 'أنهى اليوم' },
];

const EMPTY = {
    name: '', plate: '', driver_name: '', driver_phone: '',
    supervisor_name: '', supervisor_phone: '',
    capacity: '', stops: '', departure_time: '', return_time: '',
};

export const Buses: React.FC = () => {
    const { user } = useAuth();
    const canManage = isAdmin(user?.role);

    const [buses, setBuses] = useState<BusLine[]>([]);
    const [selected, setSelected] = useState<BusLine | null>(null);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY });

    const [assigning, setAssigning] = useState(false);
    const [assignStudent, setAssignStudent] = useState('');
    const [assignStop, setAssignStop] = useState('');

    const load = useCallback(async () => {
        try {
            setBuses(await api.get<BusLine[]>('/api/buses'));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تحميل خطوط الباص'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openBus = async (line: BusLine) => {
        setSelected(line);
        setRiders([]);
        try {
            setRiders(await api.get<Rider[]>(`/api/buses/${line.id}/students`));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تحميل قائمة الركاب'));
        }
    };

    const create = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await api.post('/api/admin/buses', {
                ...form,
                capacity: form.capacity ? Number(form.capacity) : 0,
                stops: form.stops.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean),
            });
            setShowForm(false);
            setForm({ ...EMPTY });
            await load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر إضافة الخط'));
        } finally {
            setBusy(false);
        }
    };

    const setStatus = async (line: BusLine, status: string) => {
        setBusy(true);
        try {
            const res = await api.post<{ notified: number }>(`/api/admin/buses/${line.id}/status`, { status });
            await load();
            if (selected?.id === line.id) {
                setSelected((prev) => (prev ? { ...prev, status } : prev));
            }
            if (res.notified > 0) alert(t('تم إشعار {count} شخص', { count: res.notified }));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تحديث الحالة'));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (line: BusLine) => {
        if (!confirm(t('حذف هذا الخط؟ سيُفصل عنه كل الركاب.'))) return;
        try {
            await api.del(`/api/admin/buses/${line.id}`);
            setSelected(null);
            await load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر حذف الخط'));
        }
    };

    const addRider = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected || !assignStudent) return;
        setBusy(true);
        try {
            await api.post(`/api/admin/students/${assignStudent}/bus`, {
                bus_id: selected.id,
                stop: assignStop || undefined,
            });
            setAssigning(false);
            setAssignStudent('');
            setAssignStop('');
            await openBus(selected);
            await load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر تعيين الطالب'));
        } finally {
            setBusy(false);
        }
    };

    const removeRider = async (rider: Rider) => {
        if (!selected || !confirm(t('فصل {name} عن هذا الخط؟', { name: rider.name }))) return;
        try {
            await api.post(`/api/admin/students/${rider.id}/bus`, { bus_id: '' });
            await openBus(selected);
            await load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('تعذر فصل الطالب'));
        }
    };

    if (loading) return <div className="p-6"><Spinner label={t('جاري تحميل خطوط الباص')} /></div>;

    /* ------------------------------- one line ------------------------------- */

    if (selected) {
        return (
            <Page>
                <PageTitle
                    title={selected.name}
                    subtitle={`${selected.riders} ${t('راكب')}${selected.plate ? ` · ${selected.plate}` : ''}`}
                    action={
                        <button
                            onClick={() => setSelected(null)}
                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-black"
                        >
                            {t('رجوع')}
                        </button>
                    }
                />

                {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

                <Panel title={t('حالة الخط')} icon={<Bus className="w-4 h-4" />} note={t('يصل إشعار لأولياء الأمور عند التغيير')}>
                    <div className="px-4 pb-4">
                        <Chips
                            items={STATUSES.map((s) => ({ key: s.key, label: t(s.label) }))}
                            active={selected.status}
                            onPick={(status) => !busy && setStatus(selected, status)}
                        />
                    </div>
                </Panel>

                <Panel title={t('بيانات الخط')}>
                    <Rows>
                        <Row icon={<Phone className="w-4 h-4" />} title={selected.driver_name || t('بدون سائق')} subtitle={selected.driver_phone || '—'} />
                        {selected.supervisor_name && (
                            <Row icon={<Users className="w-4 h-4" />} title={selected.supervisor_name} subtitle={selected.supervisor_phone || t('مشرف الخط')} />
                        )}
                        <Row
                            icon={<MapPin className="w-4 h-4" />}
                            title={t('المحطات')}
                            subtitle={(selected.stops || []).join(' ← ') || t('لم تُحدد محطات')}
                        />
                    </Rows>
                </Panel>

                <Panel
                    title={t('الركاب')}
                    note={`${riders.length}`}
                    action={
                        <button
                            onClick={() => setAssigning(true)}
                            className="bg-brand-700 text-white px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-1"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {t('إضافة راكب')}
                        </button>
                    }
                >
                    {riders.length === 0 ? (
                        <Nothing message="لا يوجد ركاب على هذا الخط" />
                    ) : (
                        <Rows>
                            {riders.map((rider) => (
                                <Row
                                    key={rider.id}
                                    icon={<Users className="w-4 h-4" />}
                                    title={rider.name}
                                    subtitle={`${rider.class_name}${rider.stop ? ` · ${rider.stop}` : ''}`}
                                    trailing={
                                        canManage ? (
                                            <button
                                                onClick={() => removeRider(rider)}
                                                className="p-1.5 text-slate-300 hover:text-rose-500 shrink-0"
                                                aria-label={t('فصل عن الخط')}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        ) : undefined
                                    }
                                />
                            ))}
                        </Rows>
                    )}
                </Panel>

                {canManage && (
                    <button
                        onClick={() => remove(selected)}
                        className="w-full py-3 rounded-2xl border border-rose-200 text-rose-600 text-xs font-black hover:bg-rose-50"
                    >
                        {t('حذف الخط')}
                    </button>
                )}

                <Modal open={assigning} onClose={() => setAssigning(false)} title={t('إضافة راكب')} subtitle={selected.name}>
                    <form onSubmit={addRider} className="space-y-3">
                        <StudentPicker
                            label={t('الطالب')}
                            required
                            value={assignStudent}
                            onChange={(id) => setAssignStudent(id)}
                        />
                        <div>
                            <label className={labelClass}>{t('المحطة')}</label>
                            <input
                                className={inputClass}
                                value={assignStop}
                                onChange={(e) => setAssignStop(e.target.value)}
                                placeholder={t('مثال: ساحة الأندلس')}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={busy || !assignStudent}
                            className="w-full bg-gradient-to-l from-brand-700 to-brand-500 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-brand-700/30 active:scale-[0.99] transition-transform disabled:opacity-60"
                        >
                            {busy ? t('جاري الحفظ...') : t('إضافة للخط')}
                        </button>
                    </form>
                </Modal>
            </Page>
        );
    }

    /* ------------------------------- every line ------------------------------- */

    return (
        <Page>
            <PageTitle
                title={t('الباصات')}
                subtitle={t('خطوط النقل المدرسي وركابها')}
                action={
                    canManage ? (
                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-gradient-to-l from-brand-700 to-brand-500 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-brand-700/30 active:scale-[0.98] transition-transform flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            {t('خط جديد')}
                        </button>
                    ) : undefined
                }
            />

            {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

            <Panel>
                {buses.length === 0 ? (
                    <Nothing
                        icon={<Bus className="w-10 h-10" />}
                        message="لا توجد خطوط باص بعد"
                        hint="أضف خطاً من الزر بالأعلى"
                    />
                ) : (
                    <Rows>
                        {buses.map((line) => (
                            <Row
                                key={line.id}
                                onClick={() => openBus(line)}
                                icon={<Bus className="w-4 h-4" />}
                                tone="bg-amber-50 text-amber-600"
                                title={line.name}
                                subtitle={`${line.riders} ${t('راكب')}${line.driver_name ? ` · ${line.driver_name}` : ''}`}
                                trailing={<Badge tone={line.status === 'idle' ? 'slate' : 'indigo'}>{line.status_text}</Badge>}
                            />
                        ))}
                    </Rows>
                )}
            </Panel>

            <Modal open={showForm} onClose={() => setShowForm(false)} title={t('خط باص جديد')}>
                <form onSubmit={create} className="space-y-3">
                    <div>
                        <label className={labelClass}>{t('اسم الخط')} <span className="text-red-500">*</span></label>
                        <input
                            className={inputClass}
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder={t('مثال: خط الكرادة')}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('اسم السائق')}</label>
                            <input className={inputClass} value={form.driver_name} onChange={(e) => setForm((f) => ({ ...f, driver_name: e.target.value }))} />
                        </div>
                        <div>
                            <label className={labelClass}>{t('هاتف السائق')}</label>
                            <input className={inputClass} dir="ltr" value={form.driver_phone} onChange={(e) => setForm((f) => ({ ...f, driver_phone: e.target.value }))} placeholder="07XXXXXXXXX" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('رقم المركبة')}</label>
                            <input className={inputClass} value={form.plate} onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))} />
                        </div>
                        <div>
                            <label className={labelClass}>{t('السعة')}</label>
                            <input type="number" min={0} className={inputClass} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('وقت الانطلاق')}</label>
                            <input type="time" dir="ltr" className={inputClass} value={form.departure_time} onChange={(e) => setForm((f) => ({ ...f, departure_time: e.target.value }))} />
                        </div>
                        <div>
                            <label className={labelClass}>{t('وقت العودة')}</label>
                            <input type="time" dir="ltr" className={inputClass} value={form.return_time} onChange={(e) => setForm((f) => ({ ...f, return_time: e.target.value }))} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>{t('المحطات')}</label>
                        <textarea
                            rows={2}
                            className={inputClass}
                            value={form.stops}
                            onChange={(e) => setForm((f) => ({ ...f, stops: e.target.value }))}
                            placeholder={t('افصل بين المحطات بفاصلة')}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full bg-gradient-to-l from-brand-700 to-brand-500 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-brand-700/30 active:scale-[0.99] transition-transform disabled:opacity-60"
                    >
                        {busy ? t('جاري الحفظ...') : t('إضافة الخط')}
                    </button>
                </form>
            </Modal>
        </Page>
    );
};
