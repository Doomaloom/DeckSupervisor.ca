import { inputClass, selectClass } from "../constants";

type RosterFiltersBarProps = {
    instructorOptions: string[];
    levelOptions: string[];
    instructorFilter: string;
    levelFilter: string;
    searchQuery: string;
    onInstructorFilterChange: (value: string) => void;
    onLevelFilterChange: (value: string) => void;
    onSearchChange: (value: string) => void;
};

function RosterFiltersBar({
    instructorOptions,
    levelOptions,
    instructorFilter,
    levelFilter,
    searchQuery,
    onInstructorFilterChange,
    onLevelFilterChange,
    onSearchChange,
}: RosterFiltersBarProps) {
    return (
        <div
            id="roster-filters-bar"
            data-component="roster-filters-bar"
            className="grid min-w-0 gap-4 rounded-card border-2 border-secondary/20 bg-accent p-4 text-secondary shadow-md md:grid-cols-3 md:p-6"
        >
            <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">
                Instructor
                <select
                    className={selectClass}
                    value={instructorFilter}
                    onChange={(event) =>
                        onInstructorFilterChange(event.target.value)}
                >
                    <option value="">All instructors</option>
                    {instructorOptions.map((instructor) => (
                        <option key={instructor} value={instructor}>
                            {instructor}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">
                Service name
                <select
                    className={selectClass}
                    value={levelFilter}
                    onChange={(event) => onLevelFilterChange(event.target.value)}
                >
                    <option value="">All services</option>
                    {levelOptions.map((level) => (
                        <option key={level} value={level}>
                            {level}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">
                Search
                <input
                    className={inputClass}
                    type="search"
                    placeholder="Student or course code"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
            </label>
        </div>
    );
}

export default RosterFiltersBar;
