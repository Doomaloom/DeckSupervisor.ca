import React from 'react'

type TimeRailProps = {
    labels: string[]
    headerHeightRem: number
    slotHeightRem: number
    className?: string
    keyPrefix?: string
}

function TimeRail({ labels, headerHeightRem, slotHeightRem, className, keyPrefix = 'rail' }: TimeRailProps) {
    return (
        <div className={className}>
            <div style={{ height: `${headerHeightRem}rem` }} />
            {labels.map(label => (
                <div
                    className="flex items-center justify-center border-b border-black/40 last:border-b-0"
                    key={`${keyPrefix}-${label}`}
                    style={{ height: `${slotHeightRem}rem` }}
                >
                    {label}
                </div>
            ))}
        </div>
    )
}

export default TimeRail
