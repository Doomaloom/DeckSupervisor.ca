import type { TabConfig, TabKey } from "../types";

type TabBarProps = {
    visibleTabs: TabConfig[];
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
};

const tabButtonClass = (tabKey: TabKey, activeTab: TabKey) =>
    [
        "min-h-11 rounded-2xl border-2 px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        tabKey === activeTab
            ? "border-secondary bg-secondary text-accent shadow-sm"
            : "border-secondary/20 bg-accent text-secondary hover:border-primary hover:shadow-sm",
    ].join(" ");

function TabBar({ visibleTabs, activeTab, onTabChange }: TabBarProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {visibleTabs.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    aria-pressed={tab.key === activeTab}
                    className={tabButtonClass(tab.key, activeTab)}
                    onClick={() => onTabChange(tab.key)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export default TabBar;
