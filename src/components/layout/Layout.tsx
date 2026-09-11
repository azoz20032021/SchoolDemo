import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardHeader } from './DashboardHeader';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { PaymentLock } from './PaymentLock';
import { PasswordSetup } from './PasswordSetup';
import { FaceSetup, useFaceSetup } from './FaceSetup';

export const Layout: React.FC = () => {
    const { user, logout, loading } = useAuth();

    /*
     * Asked here rather than on the student's home screen, because a card on a
     * page is a card that gets scrolled past. The hook answers "not needed" for
     * everyone who is not a student and for anyone already enrolled, so this
     * costs nothing for the rest of the school.
     */
    const face = useFaceSetup(user?.id || '', user?.role || '');

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-700 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    /**
     * An account opened with a temporary password — a parent's, created for
     * them — goes no further until a real one replaces it.
     */
    if (user.must_change_password) {
        return <PasswordSetup name={user.name} onLogout={logout} />;
    }

    /**
     * A student whose fees have lapsed sees one screen and nothing else. The
     * flag is computed by the server and arrives with the account, so it cannot
     * be cleared by editing anything in the browser.
     */
    if (user.role === 'student' && user.dues?.blocked) {
        return <PaymentLock dues={user.dues} name={user.name} onLogout={logout} />;
    }

    /**
     * A student who has not enrolled a face is asked for one — after the money
     * and the password, because those two are conditions of using the school at
     * all and this is a convenience. It can be skipped for the visit, so a
     * broken camera never costs a child sight of their own marks.
     */
    if (face.needed) {
        return <FaceSetup name={user.name} onSkip={face.skip} onDone={face.complete} />;
    }

    return (
        <div className="min-h-screen font-sans print:min-h-0 print:bg-white">
            {/*
              * The sidebar exists only from a large screen up; below that the
              * bottom bar takes over. The page is inset by its width rather
              * than sitting under it, so nothing is ever hidden behind it.
              */}
            <Sidebar user={user} onLogout={logout} />

            <div className="lg:pr-72 print:pr-0">
                <DashboardHeader user={user} onLogout={logout} />
                <main className="pb-28 lg:pb-10 print:pb-0">
                    <Outlet />
                </main>
            </div>

            <Navbar role={user.role} />
        </div>
    );
};
