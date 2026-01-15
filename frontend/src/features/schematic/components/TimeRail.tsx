import React from 'react'

type TimeRailProps = {
    labels: string[]
    headerHeightRem: number
    className?: string
    keyPrefix?: string
}

function TimeRail({ labels, headerHeightRem, className, keyPrefix = 'rail' }: TimeRailProps) {
    return (
        <div className={className}>
            <div style={{ height: `${headerHeightRem}rem` }} />
            {labels.map(label => (
                <div className="py-2" key={`${keyPrefix}-${label}`}>
                    {label}
                </div>
            ))}
        </div>
    )
}

export default TimeRail
