type TimeRailProps = {
    labels: string[];
    headerHeightRem: number;
    slotHeightRem: number;
    className?: string;
    keyPrefix?: string;
    rowBorderClassName?: string;
    headerClassName?: string;
    headerHeight?: string;
    slotHeight?: string;
};

function TimeRail(
    {
        labels,
        headerHeightRem,
        slotHeightRem,
        className,
        keyPrefix = "rail",
        rowBorderClassName = "border-black/40",
        headerClassName,
        headerHeight,
        slotHeight,
    }: TimeRailProps,
) {
    return (
        <div className={className}>
            <div
                className={headerClassName}
                style={{ height: headerHeight ?? `${headerHeightRem}rem` }}
            />
            {labels.map((label) => (
                <div
                    className={`flex items-center justify-center border-b last:border-b-0 ${rowBorderClassName}`}
                    key={`${keyPrefix}-${label}`}
                    style={{ height: slotHeight ?? `${slotHeightRem}rem` }}
                >
                    {label}
                </div>
            ))}
        </div>
    );
}

export default TimeRail;
