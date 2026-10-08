import { formatTimeLabel, SchematicPrintTableProps, useSchematicPrintTableLogic } from "./SchematicPrintTable.logic";
function SchematicPrintTable(props: SchematicPrintTableProps) {
    const viewModel = useSchematicPrintTableLogic(props);
    const {
        totalColumns,
        title,
        dateRange,
        leftSpan,
        deckSupervisorName,
        rightSpan,
        weeksLabel,
        columnCount,
        instructors,
        slots,
        grid,
    } = viewModel;
    return (
        <table className="schematic-print-table">
            <thead>
                <tr>
                    <th colSpan={totalColumns} className="schematic-title">
                        {title}
                    </th>
                </tr>
                <tr>
                    <th colSpan={totalColumns} className="schematic-subtitle">
                        {dateRange}
                    </th>
                </tr>
                <tr>
                    <th colSpan={leftSpan} className="schematic-meta">
                        Deck Supervisor:{deckSupervisorName
                            ? ` ${deckSupervisorName}`
                            : ""}
                    </th>
                    <th colSpan={rightSpan} className="schematic-meta">
                        Cancelled Dates:
                        <div className="schematic-meta-sub">{weeksLabel}</div>
                    </th>
                </tr>
                <tr>
                    <th rowSpan={2} className="schematic-time-header">
                        TIME
                    </th>
                    <th
                        colSpan={columnCount}
                        className="schematic-column-header"
                    >
                        Instructors / Level
                    </th>
                    <th rowSpan={2} className="schematic-time-header">
                        TIME
                    </th>
                </tr>
                <tr>
                    {Array.from({ length: columnCount }).map((_, index) => (
                        <th
                            key={`instructor-${index}`}
                            className="schematic-instructor-header"
                        >
                            {instructors[index] || `Instructor ${index + 1}`}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {slots.map((slot, rowIndex) => (
                    <tr key={`row-${slot}`}>
                        <td className="schematic-time-cell">
                            {formatTimeLabel(slot)}
                        </td>
                        {Array.from({ length: columnCount }).map(
                            (_, colIndex) => {
                                const key = `${rowIndex}-${colIndex}`;
                                if (grid.skipMap.has(key)) {
                                    return null;
                                }
                                const cell = grid.cellMap.get(key);
                                if (!cell) {
                                    return (
                                        <td
                                            key={key}
                                            className="schematic-empty-cell"
                                        />
                                    );
                                }
                                const colorClass =
                                    cell.capacityClass.includes("rose")
                                        ? "schematic-capacity-red"
                                        : cell.capacityClass.includes("amber")
                                            ? "schematic-capacity-yellow"
                                            : "schematic-capacity-green";
                                return (
                                    <td
                                        key={key}
                                        rowSpan={cell.rowSpan}
                                        className="schematic-course-cell"
                                    >
                                        <div className="schematic-cell-inner">
                                            <span className="schematic-corner" />
                                            <div className="schematic-course-name">
                                                {cell.course.level}
                                            </div>
                                            <div className="schematic-course-code">
                                                {cell.course.code}
                                            </div>
                                            <div
                                                className={`schematic-capacity ${colorClass}`}
                                            >
                                                {cell.course.studentCount} of
                                                {" "}
                                                {cell.capacity}
                                            </div>
                                        </div>
                                    </td>
                                );
                            },
                        )}
                        <td className="schematic-time-cell">
                            {formatTimeLabel(slot)}
                        </td>
                    </tr>
                ))}
                {slots.length === 0 && (
                    <tr>
                        <td
                            colSpan={totalColumns}
                            className="schematic-empty-state"
                        >
                            No schedule data available.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}

export default SchematicPrintTable;

