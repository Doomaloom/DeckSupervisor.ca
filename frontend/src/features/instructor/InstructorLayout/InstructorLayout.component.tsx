import { Card, PageShell } from "../../../general-components";
import { InstructorWorkspace } from "./InstructorWorkspace/InstructorWorkspace.component";

import { type ReactNode } from "react";

import { Link } from "react-router-dom";

import { InstructorSessionProvider } from "../session/InstructorSessionContext";

import { useInstructorLayoutLogic } from "./InstructorLayout.logic";
export default function InstructorLayout(props: { children: ReactNode }) {
    const viewModel = useInstructorLayoutLogic(props);
    if (viewModel.view === "loading") {
        return (
            <PageShell className="p-6">
                <Card role="status">Loading account…</Card>
            </PageShell>
        );
    }
    if (viewModel.view === "signedOut") {
        return (
            <main className="p-6">
                <PageShell maxWidth="xl">
                    <Card>
                        <h1 className="mb-4 text-xl font-semibold">
                            Sign in to Instructor View
                        </h1>
                        <Link to="/sign-in">Sign in</Link>
                    </Card>
                </PageShell>
            </main>
        );
    }
    if (viewModel.view === "unavailable") {
        return (
            <main className="p-6">
                <PageShell maxWidth="xl">
                    <Card>
                        <h1 className="mb-4 text-xl font-semibold">
                            Instructor access unavailable
                        </h1>
                        <Link to="/account">Account</Link>
                    </Card>
                </PageShell>
            </main>
        );
    }
    const { user, children } = viewModel;
    return (
        <InstructorSessionProvider key={user!.id}>
            <InstructorWorkspace>{children}</InstructorWorkspace>
        </InstructorSessionProvider>
    );
}

