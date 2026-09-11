import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, isStaff } from './context/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserData } from './types';
import { I18nProvider, useI18n } from './i18n';

/**
 * Wraps dynamic imports with automatic recovery when a new build is deployed.
 * If the server replaced chunk hashes, it forces one fresh page reload instead of crashing.
 */
function lazyRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>
) {
  return lazy(async () => {
    const hasRefreshed = sessionStorage.getItem('chunk_retry') === 'true';
    try {
      const module = await factory();
      sessionStorage.removeItem('chunk_retry');
      return 'default' in module ? module : { default: module };
    } catch (error) {
      if (!hasRefreshed) {
        sessionStorage.setItem('chunk_retry', 'true');
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem('chunk_retry');
      throw error;
    }
  });
}

/**
 * Everything past the login screen is loaded on demand. A student's phone no
 * longer downloads the admin dashboard, the finance ledger and the report
 * builder just to see their own grades.
 */
const Register = lazyRetry(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const RegistrationStatus = lazyRetry(() => import('./pages/RegistrationStatus').then((m) => ({ default: m.RegistrationStatus })));
const AdminDashboard = lazyRetry(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const Registrations = lazyRetry(() => import('./pages/admin/Registrations').then((m) => ({ default: m.Registrations })));
const Attendance = lazyRetry(() => import('./pages/admin/Attendance').then((m) => ({ default: m.Attendance })));
const Gate = lazyRetry(() => import('./pages/admin/Gate').then((m) => ({ default: m.Gate })));
const Buses = lazyRetry(() => import('./pages/admin/Buses').then((m) => ({ default: m.Buses })));
const StudentCards = lazyRetry(() => import('./pages/admin/StudentCards').then((m) => ({ default: m.StudentCards })));
const Messages = lazyRetry(() => import('./pages/Messages').then((m) => ({ default: m.Messages })));
const Exams = lazyRetry(() => import('./pages/Exams').then((m) => ({ default: m.Exams })));
const Finance = lazyRetry(() => import('./pages/admin/Finance').then((m) => ({ default: m.Finance })));
const TeacherDashboard = lazyRetry(() => import('./pages/teacher/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard })));
const StudentDashboard = lazyRetry(() => import('./pages/student/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const GuardianDashboard = lazyRetry(() => import('./pages/guardian/GuardianDashboard').then((m) => ({ default: m.GuardianDashboard })));
const StudentFinance = lazyRetry(() => import('./pages/student/StudentFinance').then((m) => ({ default: m.StudentFinance })));
const StudentGrades = lazyRetry(() => import('./pages/student/StudentGrades').then((m) => ({ default: m.StudentGrades })));
const Subjects = lazyRetry(() => import('./pages/Subjects').then((m) => ({ default: m.Subjects })));
const Schedule = lazyRetry(() => import('./pages/Schedule').then((m) => ({ default: m.Schedule })));
const GradesManagement = lazyRetry(() => import('./pages/GradesManagement').then((m) => ({ default: m.GradesManagement })));
const Behavior = lazyRetry(() => import('./pages/Behavior').then((m) => ({ default: m.Behavior })));
const Homework = lazyRetry(() => import('./pages/Homework').then((m) => ({ default: m.Homework })));
const Reports = lazyRetry(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const Settings = lazyRetry(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const More = lazyRetry(() => import('./pages/More').then((m) => ({ default: m.More })));

const FullPageSpinner = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-brand-700 border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Landing page depends on who is signed in. */
const RootRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (isStaff(user.role)) return <AdminDashboard />;
  if (user.role === 'teacher') return <TeacherDashboard user={user} />;
  if (user.role === 'guardian') return <GuardianDashboard user={user} />;
  return <StudentDashboard user={user} />;
};

/**
 * Students read their own grades. Recording them is limited to the full admin
 * and to teachers — assistant admins are excluded, matching the API.
 */
const GradesRoute = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'student') return <StudentGrades user={user} />;
  if (user.role === 'assistant_admin' || user.role === 'guardian') return <Navigate to="/" replace />;
  return <GradesManagement user={user} />;
};

/** Students see their own dues; staff see the whole ledger. */
const FinanceRoute = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'student') return <StudentFinance user={user} />;
  if (isStaff(user.role)) return <Finance />;
  return <Navigate to="/" replace />;
};

/**
 * Blocks a route for roles that must not reach it. The API enforces the same
 * rules — this only keeps the UI from offering a screen that would fail.
 */
const RequireRole: React.FC<{ allow: UserData['role'][]; children: React.ReactNode }> = ({ allow, children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

/** Passes the signed-in user down to a page that requires one. */
const WithUser: React.FC<{ render: (user: UserData) => React.ReactElement }> = ({ render }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return render(user);
};

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner />;

  return (
    <ErrorBoundary>
    <Suspense fallback={<FullPageSpinner />}>
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />
      <Route path="/register/status" element={<RegistrationStatus />} />

      <Route element={<Layout />}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/grades" element={<GradesRoute />} />
        <Route path="/finance" element={<FinanceRoute />} />
        <Route path="/subjects" element={<WithUser render={(u) => <Subjects user={u} />} />} />
        <Route path="/schedule" element={<WithUser render={(u) => <Schedule user={u} />} />} />
        {/* Conduct and homework follow the class, so an assistant is not offered them. */}
        <Route
          path="/behavior"
          element={
            <RequireRole allow={['admin', 'teacher', 'student']}>
              <WithUser render={(u) => <Behavior user={u} />} />
            </RequireRole>
          }
        />
        <Route
          path="/homework"
          element={
            <RequireRole allow={['admin', 'teacher', 'student']}>
              <WithUser render={(u) => <Homework user={u} />} />
            </RequireRole>
          }
        />
        {/* Staff and students only: a teacher has no printed statements to make. */}
        <Route
          path="/reports"
          element={
            <RequireRole allow={['admin', 'assistant_admin', 'student']}>
              <WithUser render={(u) => <Reports user={u} />} />
            </RequireRole>
          }
        />
        <Route path="/more" element={<WithUser render={(u) => <More user={u} />} />} />
        <Route path="/settings" element={<WithUser render={(u) => <Settings user={u} />} />} />
        {/* Announced before they happen — a parent's most asked-for screen. */}
        <Route
          path="/exams"
          element={
            <RequireRole allow={['admin', 'teacher', 'student']}>
              <WithUser render={(u) => <Exams user={u} />} />
            </RequireRole>
          }
        />
        {/* Home and school, talking directly. Students are not part of it. */}
        <Route
          path="/messages"
          element={
            <RequireRole allow={['guardian', 'teacher', 'admin', 'assistant_admin']}>
              <WithUser render={(u) => <Messages user={u} />} />
            </RequireRole>
          }
        />
        <Route
          path="/buses"
          element={
            <RequireRole allow={['admin', 'assistant_admin']}>
              <Buses />
            </RequireRole>
          }
        />
        {/* What the tablet at the door reads. */}
        <Route
          path="/cards"
          element={
            <RequireRole allow={['admin', 'assistant_admin']}>
              <StudentCards />
            </RequireRole>
          }
        />
        {/* The tablet at the door. */}
        <Route
          path="/gate"
          element={
            <RequireRole allow={['admin', 'assistant_admin']}>
              <WithUser render={(u) => <Gate user={u} />} />
            </RequireRole>
          }
        />
        {/* Taking the register from the office, for a class whose teacher is away. */}
        <Route
          path="/attendance"
          element={
            <RequireRole allow={['admin']}>
              <Attendance />
            </RequireRole>
          }
        />
        <Route
          path="/registrations"
          element={
            <RequireRole allow={['admin', 'assistant_admin']}>
              <Registrations />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Remounting on language change keeps every call site a plain `t(...)` instead
 * of a hook, at the cost of resetting screen state — acceptable for an action
 * taken once per session.
 */
function LocalisedApp() {
  const { lang } = useI18n();
  return (
    <AuthProvider key={lang}>
      <AppRoutes />
    </AuthProvider>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <Router>
        <LocalisedApp />
      </Router>
    </I18nProvider>
  );
}
