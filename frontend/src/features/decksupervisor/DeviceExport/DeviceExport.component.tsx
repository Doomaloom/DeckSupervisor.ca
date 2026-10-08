import { EmptyState, PageShell } from "../../../general-components";
import { ExportSession } from "./ExportSession/ExportSession.component";

import { Link } from "react-router-dom";

import { useDeviceExportLogic } from "./DeviceExport.logic";
export default function DeviceExportPage() {
    const viewModel = useDeviceExportLogic();
    if (viewModel.view === "loading") {
        return <p role="status">Loading selected session…</p>;
    }
    if (viewModel.view === "empty") {
        return (
            <PageShell maxWidth="5xl" className="min-w-0">
                <header className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold text-secondary">
                        Device Exports
                    </h2>
                </header>
                <EmptyState>
                    Select a session and load its class data to export
                    instructor lessons. {" "}
                    <Link className="underline" to="/manage-sessions">
                        Manage sessions
                    </Link>
                </EmptyState>
            </PageShell>
        );
    }
    const { scope, sessionId, session, isGuest } = viewModel;
    return (
        <ExportSession
            key={`${scope}:${sessionId}`}
            session={session}
            isGuest={isGuest}
            scope={scope}
        />
    );
}

