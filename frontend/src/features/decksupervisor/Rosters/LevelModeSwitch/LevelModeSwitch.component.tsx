export type LevelMode = "class" | "swimmer";

type LevelModeSwitchProps = {
    mode: LevelMode;
    onChange: (mode: LevelMode) => void;
    label?: string;
};

const options: Array<{ value: LevelMode; text: string }> = [
    { value: "class", text: "Whole class" },
    { value: "swimmer", text: "Each swimmer" },
];

function segmentClass(active: boolean) {
    return `whitespace-nowrap px-2 py-1.5 text-sm font-medium transition sm:px-3 ${active
        ? "bg-primary text-white"
        : "bg-bg text-secondary hover:bg-hover/30"
        }`;
}

// Two-part switch: whether the level applies to the whole class or to each
// swimmer. Placed in the card header, next to Print.
function LevelModeSwitch(
    { mode, onChange, label = "Level applies to" }: LevelModeSwitchProps,
) {
    return (
        <div
            data-component="level-mode-switch"
            role="radiogroup"
            aria-label={label}
            className="inline-flex overflow-hidden rounded-2xl border-2 border-secondary"
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={mode === option.value}
                    className={segmentClass(mode === option.value)}
                    onClick={() => {
                        if (mode !== option.value) {
                            onChange(option.value);
                        }
                    }}
                >
                    {option.text}
                </button>
            ))}
        </div>
    );
}

export default LevelModeSwitch;
