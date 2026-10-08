import { tabButtonClass } from "../utils";

type RosterTab = "default" | "custom";

type RostersTabsProps = {
    activeTab: RosterTab;
    onChange: (tab: RosterTab) => void;
};

function RostersTabs({ activeTab, onChange }: RostersTabsProps) {
    return (
        <div
            id="rosters-tabs"
            data-component="rosters-tabs"
            className="flex w-full flex-wrap gap-3"
        >
            <button
                type="button"
                aria-pressed={activeTab === "default"}
                className={tabButtonClass(activeTab === "default")}
                onClick={() => onChange("default")}
            >
                Rosters
            </button>
            <button
                type="button"
                aria-pressed={activeTab === "custom"}
                className={tabButtonClass(activeTab === "custom")}
                onClick={() => onChange("custom")}
            >
                Custom Rosters
            </button>
        </div>
    );
}

export default RostersTabs;
