import React from 'react'
import { tabButtonClass } from '../utils'

type RosterTab = 'default' | 'custom'

type RostersTabsProps = {
    activeTab: RosterTab
    onChange: (tab: RosterTab) => void
}

function RostersTabs({ activeTab, onChange }: RostersTabsProps) {
    return (
        <div className="flex w-full gap-3">
            <button type="button" className={tabButtonClass(activeTab === 'default')} onClick={() => onChange('default')}>
                Rosters
            </button>
            <button type="button" className={tabButtonClass(activeTab === 'custom')} onClick={() => onChange('custom')}>
                Custom Rosters
            </button>
        </div>
    )
}

export default RostersTabs
