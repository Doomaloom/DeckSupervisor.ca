import {
    ActionButton,
    Card,
    EmptyState,
    Notice,
    PageShell,
} from "../../general-components";
import { Link } from "react-router-dom";
import useInstructorClasses, { sessionLabel } from "./useInstructorClasses";
import TimeRail from "../schematic/components/TimeRail";
import {
    HEADER_HEIGHT_REM,
    SLOT_HEIGHT_REM,
    SLOT_MINUTES,
} from "../schematic/constants";
import { buildTimeLabels, timeToMinutes } from "../schematic/utils/time";

export default function MyClasses() {
    const { session, classes, loading, error, refresh } =
        useInstructorClasses();
    const start = classes.length
        ? Math.floor(
            Math.min(...classes.map((c) => timeToMinutes(c.start_time))) /
                SLOT_MINUTES,
        ) * SLOT_MINUTES
        : 0;
    const end = classes.length
        ? Math.max(...classes.map((c) => timeToMinutes(c.end_time)))
        : 0;
    const clock = (minutes: number) =>
        `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${
            String(minutes % 60).padStart(2, "0")
        }`;
    const labels = buildTimeLabels(clock(start), clock(end));
    const assignments = Array.from(
        new Set(classes.map((c) => c.assignment_id)),
    );
    return (
        <PageShell>
            <Card className="flex min-w-0 flex-col gap-6">
                <h2 className="text-2xl font-semibold">My Classes</h2>
                {loading && <p role="status">Loading linked classes…</p>}
                {error && (
                    <Notice tone="danger" role="alert">
                        {error}{" "}
                        <ActionButton onClick={refresh}>Retry</ActionButton>
                    </Notice>
                )}
                {!loading && !error && !classes.length && (
                    <EmptyState>
                        No classes are linked to your account for this session.
                        Ask your supervisor to link your staff account to a
                        saved schematic column.
                    </EmptyState>
                )}
                {!loading && !error && classes.length > 0 && (
                    <>
                        <p>{session && sessionLabel(session)}</p>
                        <div
                            className="flex overflow-x-auto border border-black bg-white text-black"
                            aria-label="Your class schematic"
                        >
                            <TimeRail
                                labels={labels}
                                headerHeightRem={HEADER_HEIGHT_REM}
                                slotHeightRem={SLOT_HEIGHT_REM}
                                className="min-w-24 shrink-0 text-sm"
                            />
                            {assignments.map((id) => (
                                <div
                                    key={id}
                                    className="min-w-52 flex-1 border-l border-black"
                                >
                                    <div
                                        className="flex items-center justify-center border-b border-black bg-accent p-2"
                                        style={{
                                            height: `${HEADER_HEIGHT_REM}rem`,
                                        }}
                                    >
                                        {classes.find((c) =>
                                            c.assignment_id === id
                                        )?.instructor}
                                    </div>
                                    <div
                                        className="relative"
                                        style={{
                                            height: `${
                                                labels.length * SLOT_HEIGHT_REM
                                            }rem`,
                                        }}
                                    >
                                        {labels.map((_, i) => (
                                            <div
                                                key={i}
                                                className="border-b border-black/20"
                                                style={{
                                                    height:
                                                        `${SLOT_HEIGHT_REM}rem`,
                                                }}
                                            />
                                        ))}
                                        {classes.filter((c) =>
                                            c.assignment_id === id
                                        ).map((c) => (
                                            <Link
                                                key={c.id}
                                                to={`/instructor/lesson-plans?session=${
                                                    encodeURIComponent(
                                                        c.session_id,
                                                    )
                                                }&class=${
                                                    encodeURIComponent(c.id)
                                                }`}
                                                aria-label={`Plan ${c.level}, ${
                                                    c.start_time.slice(0, 5)
                                                } to ${
                                                    c.end_time.slice(0, 5)
                                                }, ${c.code}`}
                                                className="absolute left-0 right-0 flex flex-col justify-center overflow-auto border border-black bg-accent p-2 text-sm hover:bg-white focus:ring-2 focus:ring-primary"
                                                style={{
                                                    top: `${
                                                        (timeToMinutes(
                                                            c.start_time,
                                                        ) - start) /
                                                        SLOT_MINUTES *
                                                        SLOT_HEIGHT_REM
                                                    }rem`,
                                                    height: `${
                                                        (timeToMinutes(
                                                            c.end_time,
                                                        ) -
                                                            timeToMinutes(
                                                                c.start_time,
                                                            )) /
                                                        SLOT_MINUTES *
                                                        SLOT_HEIGHT_REM
                                                    }rem`,
                                                }}
                                            >
                                                <strong>{c.level}</strong>
                                                <span>
                                                    {c.start_time.slice(
                                                        0,
                                                        5,
                                                    )}–{c.end_time.slice(0, 5)}
                                                </span>
                                                <span>{c.code}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Card>
        </PageShell>
    );
}
