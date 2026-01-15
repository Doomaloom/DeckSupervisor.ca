import React from 'react'
import { levelOptionGroups, selectClass } from '../constants'

type LevelSelectProps = {
    value: string
    onChange: (value: string) => void
}

function LevelSelect({ value, onChange }: LevelSelectProps) {
    return (
        <select className={selectClass} value={value} onChange={event => onChange(event.target.value)}>
            <option value={value}>{value}</option>
            {levelOptionGroups.map(group => (
                <optgroup key={group.label} label={group.label}>
                    {group.options.map(option => (
                        <option key={`${group.label}-${option.value}`} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    )
}

export default LevelSelect
