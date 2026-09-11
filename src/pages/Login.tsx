import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Heart, Loader2, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserData } from '../types';
import { signInAs } from '../demo/server';

/**
 * The demo's front door.
 *
 * The real system asks for an ID and a password like any school system does.
 * This build is a portfolio piece, and the commonest reason a demo goes unseen
 * is that the visitor has to find, copy and type credentials before they are
 * allowed to look at anything. So there are four buttons, one per role, and
 * each one puts you inside that person's version of the application.
 *
 * It also says plainly what this is: a demonstration, with invented people,
 * standing in for a system that runs in a real school.
 */

const ROLES = [
    {
        role: 'admin',
        title: 'Administrator',
        blurb: 'Applications, finance, reports, the gate tablet, and every class',
        icon: ShieldCheck,
        tone: 'from-brand-700 to-brand-500 shadow-brand-700/30',
    },
    {
        role: 'teacher',
        title: 'Teacher',
        blurb: 'Marks, homework, conduct notes and the register for their classes',
        icon: GraduationCap,
        tone: 'from-emerald-600 to-teal-500 shadow-emerald-600/30',
    },
    {
        role: 'student',
        title: 'Student',
        blurb: 'Their marks, attendance, homework, fees and the card the gate reads',
        icon: Users,
        tone: 'from-violet-600 to-fuchsia-500 shadow-violet-600/30',
    },
    {
        role: 'guardian',
        title: 'Parent',
        blurb: 'Follows their children, and messages their teachers',
        icon: Heart,
        tone: 'from-amber-600 to-orange-500 shadow-amber-600/30',
    },
] as const;

export const Login: React.FC = () => {
    const { login } = useAuth();
    const [busy, setBusy] = useState('');

    const enter = (role: string) => {
        setBusy(role);
        // A beat, so the button visibly responds before the screen changes.
        setTimeout(() => {
            const { token, user } = signInAs(role);
            login(token, user as UserData);
        }, 220);
    };

    return (
        <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-5 font-sans relative overflow-hidden">
            <div className="absolute -left-24 -top-24 w-96 h-96 bg-brand-500/40 rounded-full blur-3xl" />
            <div className="absolute -right-20 top-10 w-80 h-80 bg-brand-400/30 rounded-full blur-3xl" />
            <div className="absolute right-1/4 -bottom-24 w-96 h-96 bg-gold-500/20 rounded-full blur-3xl" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative w-full max-w-lg"
            >
                {/* What this is, before anything else. */}
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-2xl shadow-brand-950/50 ring-1 ring-gold-300/40 overflow-hidden p-2">
                        <img src="/logo.png" alt="School crest" className="w-full h-full object-contain" />
                    </div>

                    <h1 className="text-2xl font-black text-white tracking-tight mt-4">
                        School Management System
                    </h1>
                    <p className="text-[13px] font-bold text-brand-200 mt-1.5 leading-relaxed max-w-md">
                        Attendance, marks, fees, parent messaging and face recognition at the gate —
                        built for a secondary school and in use there every day.
                    </p>

                    <span className="mt-4 inline-flex items-center gap-2 bg-gold-400/15 ring-1 ring-gold-300/40 text-gold-200 rounded-full px-3.5 py-1.5 text-[11px] font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold-300 animate-pulse" />
                        Interactive demo — invented people, no real records
                    </span>
                </div>

                {/* One button per role. */}
                <div className="grid sm:grid-cols-2 gap-3">
                    {ROLES.map(({ role, title, blurb, icon: Icon, tone }) => (
                        <button
                            key={role}
                            onClick={() => enter(role)}
                            disabled={busy !== ''}
                            className={`bg-gradient-to-br ${tone} text-white rounded-[1.35rem] p-4 text-left shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 relative overflow-hidden group`}
                        >
                            <div className="absolute -right-6 -bottom-10 w-28 h-28 bg-white/10 rounded-full blur-xl" />

                            <div className="relative flex items-center gap-2.5 mb-2">
                                <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                    {busy === role
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Icon className="w-4 h-4" />}
                                </span>
                                <span className="text-sm font-black">{title}</span>
                            </div>

                            <p className="relative text-[11px] font-bold opacity-85 leading-snug">{blurb}</p>

                            <p className="relative text-[10px] font-black opacity-70 mt-2.5 group-hover:opacity-100 transition-opacity">
                                Enter as {title.toLowerCase()} →
                            </p>
                        </button>
                    ))}
                </div>

                <div className="mt-5 space-y-2 text-center">
                    <p className="text-[11px] font-bold text-brand-300 leading-relaxed">
                        Everything runs in your browser — there is no backend and no database.
                        <br className="hidden sm:block" />
                        Nothing is saved: refresh and the school goes back to how it started.
                    </p>

                    {/*
                      * Said plainly, because it explains the shape of everything
                      * a visitor is about to see. A parent checks their son's
                      * attendance on a phone at seven in the morning; the office
                      * is the only part of this that lives on a desktop.
                      */}
                    <p className="text-[11px] font-bold text-gold-300/90 leading-relaxed">
                        Designed for phones first — that is where parents and students actually use it.
                        <br className="hidden sm:block" />
                        The office screens are laid out for a desktop as well.
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
