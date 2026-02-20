import type { TabConfig, TabKey } from '../types'

type TabBarProps = {
  visibleTabs: TabConfig[]
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
}

const tabButtonClass = (tabKey: TabKey, activeTab: TabKey) =>
  [
    'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
    tabKey === activeTab
      ? 'border-secondary bg-secondary text-accent'
      : 'border-secondary/30 bg-bg text-secondary hover:bg-accent',
  ].join(' ')

function TabBar({ visibleTabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {visibleTabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          className={tabButtonClass(tab.key, activeTab)}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default TabBar
