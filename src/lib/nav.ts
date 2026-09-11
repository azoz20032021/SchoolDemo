import React from 'react';
import {
    BookMarked, BookOpen, Bus, Calendar, CalendarCheck, CheckCircle, DoorOpen, FileBarChart,
    ClipboardList, Home, IdCard, MessageCircle, Settings as SettingsIcon, Smile, UserCheck, Wallet,
} from 'lucide-react';
import { Role } from '../types';

/**
 * Where each role can go.
 *
 * This lived inside the bottom bar, which meant the only way to reach anything
 * that did not fit in five slots was a sheet that slid up over the screen and
 * vanished when you looked away. A destination is not a menu item — it is a
 * place — so the same map now feeds both the bar and a real page at /more,
 * where everything is laid out, grouped and titled.
 */

export interface NavItem {
    to: string;
    label: string;
    /** One line saying what is behind the link, shown on the /more page. */
    note?: string;
    icon: React.ElementType;
    /** The colour of its tile. Keeps a grid of twelve links readable. */
    tone?: 'brand' | 'gold' | 'emerald' | 'rose' | 'sky' | 'violet' | 'slate';
    /** Which group it belongs to on the /more page. */
    group?: string;
}

export const PRIMARY: Record<Role, NavItem[]> = {
    student: [
        { to: '/', label: 'الرئيسية', icon: Home },
        { to: '/grades', label: 'الدرجات', icon: CheckCircle },
        { to: '/homework', label: 'الواجبات', icon: BookMarked },
        { to: '/schedule', label: 'الجدول', icon: Calendar },
    ],
    teacher: [
        { to: '/', label: 'الرئيسية', icon: Home },
        { to: '/grades', label: 'رصد الدرجات', icon: CheckCircle },
        { to: '/homework', label: 'الواجبات', icon: BookMarked },
        { to: '/messages', label: 'الرسائل', icon: MessageCircle },
    ],
    // Everything a parent needs is on their one page, so there is nowhere else
    // for them to go.
    guardian: [
        { to: '/', label: 'أبنائي', icon: Home },
        { to: '/messages', label: 'الرسائل', icon: MessageCircle },
        { to: '/settings', label: 'الإعدادات', icon: SettingsIcon },
    ],
    // A teacher records marks and conduct; the printed statements are the
    // office's business, so /reports is deliberately absent from both lists.
    admin: [
        { to: '/', label: 'الرئيسية', icon: Home },
        { to: '/registrations', label: 'الطلبات', icon: UserCheck },
        { to: '/finance', label: 'المالية', icon: Wallet },
        { to: '/reports', label: 'التقارير', icon: FileBarChart },
    ],
    assistant_admin: [
        { to: '/', label: 'الرئيسية', icon: Home },
        { to: '/registrations', label: 'الطلبات', icon: UserCheck },
        { to: '/finance', label: 'المالية', icon: Wallet },
        { to: '/reports', label: 'التقارير', icon: FileBarChart },
    ],
};

export const SECONDARY: Record<Role, NavItem[]> = {
    guardian: [],
    student: [
        { to: '/exams', label: 'الامتحانات', note: 'مواعيد امتحاناتك القادمة', icon: ClipboardList, tone: 'gold', group: 'دراستي' },
        { to: '/subjects', label: 'المواد الدراسية', note: 'موادك ومدرّسوها', icon: BookOpen, tone: 'brand', group: 'دراستي' },
        { to: '/behavior', label: 'السلوك والملاحظات', note: 'ملاحظات المدرسة عنك', icon: Smile, tone: 'rose', group: 'دراستي' },
        { to: '/reports', label: 'كشف درجاتي', note: 'كشف كامل قابل للطباعة', icon: FileBarChart, tone: 'violet', group: 'دراستي' },
        { to: '/finance', label: 'المالية', note: 'أقساطك وما تبقّى عليك', icon: Wallet, tone: 'emerald', group: 'حسابي' },
        { to: '/settings', label: 'الإعدادات', note: 'الملف، اللغة، المظهر، كلمة المرور', icon: SettingsIcon, tone: 'slate', group: 'حسابي' },
    ],
    teacher: [
        { to: '/exams', label: 'الامتحانات', note: 'إعلان امتحان لصفّك', icon: ClipboardList, tone: 'gold', group: 'صفوفي' },
        { to: '/schedule', label: 'الجدول الأسبوعي', note: 'حصصك خلال الأسبوع', icon: Calendar, tone: 'brand', group: 'صفوفي' },
        { to: '/behavior', label: 'السلوك والملاحظات', note: 'تسجيل ملاحظة على طالب', icon: Smile, tone: 'rose', group: 'صفوفي' },
        { to: '/settings', label: 'الإعدادات', note: 'الملف، اللغة، المظهر، كلمة المرور', icon: SettingsIcon, tone: 'slate', group: 'حسابي' },
    ],
    admin: [
        { to: '/gate', label: 'بوابة المدرسة', note: 'تسجيل الدخول من الباب بالباركود', icon: DoorOpen, tone: 'brand', group: 'اليوم الدراسي' },
        { to: '/attendance', label: 'تسجيل الحضور', note: 'حضور وغياب الصفوف', icon: CalendarCheck, tone: 'emerald', group: 'اليوم الدراسي' },
        { to: '/buses', label: 'الباصات', note: 'الخطوط والسائقون وحالة الرحلة', icon: Bus, tone: 'violet', group: 'اليوم الدراسي' },
        { to: '/messages', label: 'الرسائل', note: 'التواصل مع الأساتذة وأولياء الأمور', icon: MessageCircle, tone: 'sky', group: 'اليوم الدراسي' },
        { to: '/grades', label: 'رصد الدرجات', note: 'إدخال درجات الصفوف', icon: CheckCircle, tone: 'brand', group: 'الشؤون الدراسية' },
        { to: '/homework', label: 'الواجبات', note: 'الواجبات المنشورة للصفوف', icon: BookMarked, tone: 'sky', group: 'الشؤون الدراسية' },
        { to: '/exams', label: 'الامتحانات', note: 'إعلان الامتحانات القادمة', icon: ClipboardList, tone: 'gold', group: 'الشؤون الدراسية' },
        { to: '/behavior', label: 'السلوك والملاحظات', note: 'ملاحظات الطلاب السلوكية', icon: Smile, tone: 'rose', group: 'الشؤون الدراسية' },
        { to: '/subjects', label: 'المواد الدراسية', note: 'المواد وربطها بالصفوف', icon: BookOpen, tone: 'brand', group: 'الشؤون الدراسية' },
        { to: '/schedule', label: 'الجدول الأسبوعي', note: 'جدول الحصص وأوقات الدوام', icon: Calendar, tone: 'violet', group: 'الشؤون الدراسية' },
        { to: '/cards', label: 'بطاقات الطلاب', note: 'طباعة بطاقات الدخول', icon: IdCard, tone: 'gold', group: 'الإدارة' },
        { to: '/settings', label: 'الإعدادات وسجل العمليات', note: 'الملف، اللغة، المظهر، وسجل من فعل ماذا', icon: SettingsIcon, tone: 'slate', group: 'الإدارة' },
    ],
    // An assistant reviews applications, runs the finances, prints the
    // statements and keeps the timetable and subjects. Marks, conduct and
    // homework belong to whoever teaches the class; nobody's record is theirs
    // to change.
    assistant_admin: [
        { to: '/gate', label: 'بوابة المدرسة', note: 'تسجيل الدخول من الباب بالباركود', icon: DoorOpen, tone: 'brand', group: 'اليوم الدراسي' },
        { to: '/buses', label: 'الباصات', note: 'الخطوط والسائقون وحالة الرحلة', icon: Bus, tone: 'violet', group: 'اليوم الدراسي' },
        { to: '/messages', label: 'الرسائل', note: 'التواصل مع الأساتذة وأولياء الأمور', icon: MessageCircle, tone: 'sky', group: 'اليوم الدراسي' },
        { to: '/subjects', label: 'المواد الدراسية', note: 'المواد وربطها بالصفوف', icon: BookOpen, tone: 'brand', group: 'الشؤون الدراسية' },
        { to: '/schedule', label: 'الجدول الأسبوعي', note: 'جدول الحصص وأوقات الدوام', icon: Calendar, tone: 'violet', group: 'الشؤون الدراسية' },
        { to: '/cards', label: 'بطاقات الطلاب', note: 'طباعة بطاقات الدخول', icon: IdCard, tone: 'gold', group: 'الإدارة' },
        { to: '/settings', label: 'الإعدادات', note: 'الملف، اللغة، المظهر، كلمة المرور', icon: SettingsIcon, tone: 'slate', group: 'الإدارة' },
    ],
};

/** The tile colours, kept here so the bar and the page agree. */
export const NAV_TONES: Record<NonNullable<NavItem['tone']>, string> = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    gold: 'bg-gold-50 text-gold-600 ring-gold-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100',
    sky: 'bg-sky-50 text-sky-600 ring-sky-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200/70',
};

/** The /more page's sections, in the order a person looks for them. */
export function groupsFor(role: Role): { title: string; items: NavItem[] }[] {
    const items = SECONDARY[role] || [];
    const order: string[] = [];
    const byGroup = new Map<string, NavItem[]>();

    for (const item of items) {
        const key = item.group || 'المزيد';
        if (!byGroup.has(key)) {
            byGroup.set(key, []);
            order.push(key);
        }
        byGroup.get(key)!.push(item);
    }

    return order.map((title) => ({ title, items: byGroup.get(title)! }));
}
