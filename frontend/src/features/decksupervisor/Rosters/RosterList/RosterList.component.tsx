import RosterCard from "../RosterCard/RosterCard.component";
import type { CardSaveState } from "../hooks/useRosterEdits";
import type { RosterListItem } from "../types";

type RosterListProps = {
    rosters: RosterListItem[];
    emptyMessage: string;
    onPrintRoster: (roster: RosterListItem["roster"]) => void;
    canEdit: boolean;
    saveStates: Record<string, CardSaveState>;
    onClassLevelChange: (code: string, level: string) => void;
    onSetAllToLevel: (code: string, level: string) => void;
    onCustomRosterLevelChange: (id: string, level: string) => void;
    onStudentLevelChange: (studentId: string, level: string) => void;
    onRetrySave: (code: string, target: string) => void;
};

function RosterList({
    rosters,
    emptyMessage,
    onPrintRoster,
    canEdit,
    saveStates,
    onClassLevelChange,
    onSetAllToLevel,
    onCustomRosterLevelChange,
    onStudentLevelChange,
    onRetrySave,
}: RosterListProps) {
    return (
        <div
            id="roster-list"
            data-component="roster-list"
            className="flex flex-col gap-4"
        >
            <div
                data-component="roster-list-content"
                className="flex flex-col gap-6"
            >
                {rosters.length === 0 && (
                    <p className="text-secondary">{emptyMessage}</p>
                )}
                {rosters.map((item) => (
                    <RosterCard
                        key={item.roster.code}
                        roster={item.roster}
                        isCustom={item.isCustom}
                        onPrint={onPrintRoster}
                        canEdit={canEdit}
                        saveState={saveStates[item.roster.code]}
                        onClassLevelChange={onClassLevelChange}
                        onSetAllToLevel={onSetAllToLevel}
                        onCustomRosterLevelChange={onCustomRosterLevelChange}
                        onStudentLevelChange={onStudentLevelChange}
                        onRetrySave={onRetrySave}
                    />
                ))}
            </div>
        </div>
    );
}

export default RosterList;
