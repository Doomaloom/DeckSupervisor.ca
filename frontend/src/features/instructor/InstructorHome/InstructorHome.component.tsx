import { ActionButton, EmptyState, Notice, PageShell, } from "../../../general-components";

import { sessionLabel } from "../session/useInstructorClasses";

import { groupInstructorSessions, useInstructorHomeLogic } from "./InstructorHome.logic";
export default function InstructorHome() {
    const viewModel = useInstructorHomeLogic();
    const { state, navigate } = viewModel;
    return (
        <PageShell className="min-w-0">
            <header className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold">Home</h2>
                <p className="text-sm text-secondary/75">Select a session</p>
            </header>
            {state.sessionsLoading && (
                <p role="status">
                    Loading sessions…
                </p>
            )}
            {state.sessionError && (
                <Notice tone="danger" role="alert">
                    {state.sessionError}{" "}
                    <ActionButton onClick={state.refresh}>
                        Retry sessions
                    </ActionButton>
                </Notice>
            )}
            {!state.sessionsLoading && !state.sessionError &&
                (state.sessions.length
                    ? groupInstructorSessions(state.sessions).map((
                        group,
                    ) => (
                        <section key={group.day} className="min-w-0">
                            <h3 className="mb-3 text-lg font-semibold">
                                {group.label}
                            </h3>
                            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                                {group.sessions.map((session) => (
                                    <button
                                        key={session.id}
                                        type="button"
                                        aria-pressed={state.sessionId ===
                                            session.id}
                                        onClick={() => {
                                            state.selectSession(session.id);
                                            navigate(
                                                `/instructor/my-classes?session=${encodeURIComponent(
                                                    session.id,
                                                )
                                                }`,
                                            );
                                        }}
                                        className={`flex w-full min-w-0 flex-col gap-2 break-words rounded-2xl border-2 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${state.sessionId === session.id
                                            ? "border-secondary bg-secondary text-accent shadow-sm"
                                            : "border-secondary/20 bg-accent text-secondary shadow-sm hover:border-primary"
                                            }`}
                                    >
                                        <span className="text-lg font-semibold">
                                            {sessionLabel(session)}
                                        </span>
                                        <span>
                                            {session.start_date ||
                                                "Start date not set"} –{" "}
                                            {session.end_date ||
                                                "End date not set"}
                                        </span>
                                        <span className={`text-sm ${state.sessionId === session.id
                                            ? "text-accent/80"
                                            : "text-secondary/70"
                                            }`}>
                                            {session.location ||
                                                "No location set"}
                                        </span>
                                        {state.sessionId === session.id && (
                                            <span className="w-fit rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-xs font-semibold">
                                                Current session
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))
                    : (
                        <EmptyState>
                            No sessions are linked to your account. Ask your
                            supervisor to link your staff account to a saved
                            schematic column.
                        </EmptyState>
                    ))}
        </PageShell>
    );
}

export { groupInstructorSessions } from "./InstructorHome.logic";
