import type { DbSessionEntry, LocalSessionEntry } from "../types";
import { SessionSummaryCardProps, useSessionSummaryCardLogic } from "./SessionSummaryCard.logic";
function SessionSummaryCard(props: SessionSummaryCardProps) {
    const viewModel = useSessionSummaryCardLogic(props);
    if (viewModel.view === "hidden") {
        return null;
    }
    const { title, isGuest, currentSession, teamName, sourceLocations } = viewModel;
    return (
        <div className="mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p>
                {isGuest
                    ? (currentSession as LocalSessionEntry).startDate ||
                    "Start date"
                    : (currentSession as DbSessionEntry).start_date ||
                    "Start date"} - {isGuest
                        ? (currentSession as LocalSessionEntry).endDate ||
                        "End date"
                        : (currentSession as DbSessionEntry).end_date || "End date"}
            </p>
            <p>
                {isGuest
                    ? (currentSession as LocalSessionEntry).instructors.length
                    : (currentSession as DbSessionEntry).instructors?.length ??
                    0} instructors
            </p>
            {isGuest && (currentSession as LocalSessionEntry).rosterFileName
                ? (
                    <p>
                        Roster:{" "}
                        {(currentSession as LocalSessionEntry).rosterFileName}
                    </p>
                )
                : null}
            {!isGuest && teamName ? <p>Team: {teamName}</p> : null}
            {(currentSession as LocalSessionEntry | DbSessionEntry).location
                ? (
                    <p>
                        Location:{" "}
                        {(currentSession as LocalSessionEntry | DbSessionEntry)
                            .location}
                    </p>
                )
                : null}
            {sourceLocations.length > 1
                ? (
                    <p className="text-sm text-secondary/70">
                        Includes: {sourceLocations.join(", ")}
                    </p>
                )
                : null}
        </div>
    );
}

export default SessionSummaryCard;

