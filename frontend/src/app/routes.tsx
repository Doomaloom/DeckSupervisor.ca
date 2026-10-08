import ForgotPasswordPage from "../shared/pages/ForgotPassword/ForgotPassword.component";
import ResetPasswordPage from "../shared/pages/ResetPassword/ResetPassword.component";
import PrintPlans from "../features/instructor/PrintPlans/PrintPlans.component";
import ActivityLibrary from "../features/instructor/ActivityLibrary/ActivityLibrary.component";
import LessonPlans from "../features/instructor/LessonPlans/LessonPlans.component";
import InstructorHome from "../features/instructor/InstructorHome/InstructorHome.component";
import MyClasses from "../features/instructor/MyClasses/MyClasses.component";
import InstructorPlaceholder from "../features/instructor/Attendance/Attendance.component";
import { Route, Routes } from "react-router-dom";
import DashboardPage from "../features/decksupervisor/Dashboard/Dashboard.component";
import ManageSessionsPage from "../features/decksupervisor/ManageSessions/ManageSessions.component";
import DeviceExportPage from "../features/decksupervisor/DeviceExport/DeviceExport.component";
import PrintPage from "../features/decksupervisor/Print/Print.component";
import RostersPage from "../features/decksupervisor/Rosters/Rosters.component";
import SchematicPage from "../features/decksupervisor/Schematic/Schematic.component";
import ReportCardsPage from "../features/decksupervisor/ReportCards/ReportCards.component";
import StaffNotesPage from "../features/decksupervisor/StaffNotes/StaffNotes.component";
import FullTimerToolsPage from "../features/decksupervisor/FullTimerTools/FullTimerTools.component";
import RequestsPage from "../features/decksupervisor/Requests/Requests.component";
import SignInPage from "../shared/pages/SignIn/SignIn.component";
import AccountPage from "../shared/pages/Account/Account.component";
import TeamPage from "../features/decksupervisor/Team/Team.component";
import SessionPlanningPage from "../features/decksupervisor/SessionPlanning/SessionPlanning.component";
import { useAuth } from "./AuthContext";

function RequireFullTime({ children }: { children: JSX.Element }) {
    const { accountType, isGuest } = useAuth();
    if (isGuest) {
        return <SignInPage />;
    }
    if (accountType !== "full_time") {
        return (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <h2 className="text-xl font-semibold">
                        Full-time access only
                    </h2>
                    <p className="mt-2 text-sm text-secondary/70">
                        This page is only available to full-time accounts. If
                        you need access, contact an administrator.
                    </p>
                </div>
            </div>
        );
    }
    return children;
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/instructor" element={<InstructorHome />} />
            <Route path="/instructor/my-classes" element={<MyClasses />} />
            <Route
                path="/instructor/activity-library"
                element={<ActivityLibrary />}
            />
            <Route path="/instructor/lesson-plans" element={<LessonPlans />} />
            <Route
                path="/instructor/attendance"
                element={<InstructorPlaceholder title="Attendance" />}
            />
            <Route path="/instructor/print" element={<PrintPlans />} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/" element={<DashboardPage />} />
            <Route path="/manage-sessions" element={<ManageSessionsPage />} />
            <Route path="/device-exports" element={<DeviceExportPage />} />
            <Route path="/print" element={<PrintPage />} />
            <Route path="/rosters" element={<RostersPage />} />
            <Route path="/schematic" element={<SchematicPage />} />
            <Route path="/report-cards" element={<ReportCardsPage />} />
            <Route path="/staff-notes" element={<StaffNotesPage />} />
            <Route path="/session-planning" element={<SessionPlanningPage />} />
            <Route
                path="/requests"
                element={
                    <RequireFullTime>
                        <RequestsPage />
                    </RequireFullTime>
                }
            />
            <Route
                path="/full-timer-tools"
                element={
                    <RequireFullTime>
                        <FullTimerToolsPage />
                    </RequireFullTime>
                }
            />
        </Routes>
    );
}

export default AppRoutes;
