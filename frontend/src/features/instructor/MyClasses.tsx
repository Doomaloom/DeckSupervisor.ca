import {
    ActionButton,
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

const slotHeight = "clamp(2.5rem, 2.8vw, 3.75rem)";
const headerHeight = "clamp(4.95rem, 5.5vw, 7.4rem)";

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
        <PageShell className="min-w-0">
            <header className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold">My Classes</h2>
                {session && (
                    <p className="text-sm text-secondary/75">
                        {sessionLabel(session)}
                    </p>
                )}
            </header>
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
                <div
                    className="min-w-0 overflow-x-auto rounded-2xl border border-secondary/20 bg-accent text-secondary shadow-sm"
                    aria-label="Your class schematic"
                >
                    <div className="w-max min-w-full">
                        <div className="flex">
                            <TimeRail
                                labels={labels}
                                headerHeightRem={HEADER_HEIGHT_REM}
                                slotHeightRem={SLOT_HEIGHT_REM}
                                className="sticky left-0 z-10 min-w-[clamp(5rem,6.7vw,8rem)] shrink-0 bg-accent text-[clamp(0.75rem,1vw,1.125rem)] font-medium"
                                headerClassName="bg-primary"
                                headerHeight={headerHeight}
                                slotHeight={slotHeight}
                                rowBorderClassName="border-secondary/20"
                            />
                            {assignments.map((id) => (
                                <div
                                    key={id}
                                    className="min-w-[clamp(13rem,15vw,19rem)] flex-1"
                                >
                                    <div
                                        className="flex items-center justify-center border-b border-primary bg-primary px-4 py-2 text-center text-[clamp(1rem,1.15vw,1.375rem)] font-semibold text-accent"
                                        style={{
                                            height: headerHeight,
                                        }}
                                    >
                                        {classes.find((c) =>
                                            c.assignment_id === id
                                        )?.instructor}
                                    </div>
                                    <div
                                        className="relative border-l border-secondary/20"
                                        style={{
                                            height: `calc(${labels.length} * ${slotHeight})`,
                                        }}
                                    >
                                        {labels.map((_, i) => (
                                            <div
                                                key={i}
                                                className="border-b border-secondary/20 last:border-b-0"
                                                style={{
                                                    height: slotHeight,
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
                                                className="absolute inset-x-0 overflow-auto border border-secondary/50 bg-accent px-2 py-1 text-center text-[clamp(0.875rem,1.05vw,1.25rem)] leading-snug transition-colors hover:bg-primary/10 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                                                style={{
                                                    top: `calc(${
                                                        (timeToMinutes(
                                                            c.start_time,
                                                        ) - start) /
                                                        SLOT_MINUTES
                                                    } * ${slotHeight})`,
                                                    height: `calc(${
                                                        (timeToMinutes(
                                                            c.end_time,
                                                        ) -
                                                            timeToMinutes(
                                                                c.start_time,
                                                            )) /
                                                        SLOT_MINUTES
                                                    } * ${slotHeight})`,
                                                }}
                                            >
                                                <span className="flex min-h-full flex-col items-center justify-center">
                                                    <strong className="font-semibold">
                                                        {c.level}
                                                    </strong>
                                                    <span className="text-[clamp(0.75rem,0.9vw,1.05rem)] text-secondary/80">
                                                        {c.start_time.slice(
                                                            0,
                                                            5,
                                                        )}–{c.end_time.slice(0, 5)}
                                                    </span>
                                                    <span className="text-[clamp(0.75rem,0.9vw,1.05rem)] text-secondary/70">
                                                        {c.code}
                                                    </span>
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <div className="sticky right-0 z-10 shrink-0 bg-accent" aria-hidden="true">
                                <TimeRail
                                    labels={labels}
                                    headerHeightRem={HEADER_HEIGHT_REM}
                                    slotHeightRem={SLOT_HEIGHT_REM}
                                    className="min-w-[clamp(5rem,6.7vw,8rem)] bg-accent text-[clamp(0.75rem,1vw,1.125rem)] font-medium"
                                    headerClassName="bg-primary"
                                    headerHeight={headerHeight}
                                    slotHeight={slotHeight}
                                    rowBorderClassName="border-secondary/20 border-l"
                                    keyPrefix="right"
                                />
                            </div>
                        </div>
                        <div className="h-3 bg-primary" aria-hidden="true" />
                    </div>
                </div>
            )}
        </PageShell>
    );
}
