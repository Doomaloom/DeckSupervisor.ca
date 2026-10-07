import {
    ChevronDoubleDownIcon,
    ChevronDoubleUpIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from "@heroicons/react/24/outline";

const minimum = 1;
const maximum = 240;

export default function DurationPicker({
    value,
    onChange,
    rowNumber,
}: {
    value: number;
    onChange: (value: number) => void;
    rowNumber: number;
}) {
    const controls = [
        { step: 5, Icon: ChevronDoubleUpIcon },
        { step: 1, Icon: ChevronUpIcon },
        { step: -1, Icon: ChevronDownIcon },
        { step: -5, Icon: ChevronDoubleDownIcon },
    ];
    const button = ({ step, Icon }: typeof controls[number]) => {
        const label = `${step < 0 ? "Decrease" : "Increase"} duration by ${
            Math.abs(step)
        } ${Math.abs(step) === 1 ? "minute" : "minutes"} for row ${rowNumber}`;
        return (
            <button
                key={step}
                type="button"
                aria-label={label}
                title={label}
                disabled={step < 0 ? value <= minimum : value >= maximum}
                className="flex h-7 w-full items-center justify-center bg-bg text-secondary transition-colors hover:bg-primary hover:text-accent focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg disabled:hover:text-secondary"
                onClick={() => onChange(Math.min(
                    maximum,
                    Math.max(minimum, (Number.isFinite(value) ? value : minimum) + step),
                ))}
            >
                <Icon className="h-5 w-5" aria-hidden="true" />
            </button>
        );
    };

    return (
        <div className="inline-flex w-24 flex-col divide-y divide-secondary/30 overflow-hidden rounded-2xl border-2 border-secondary bg-bg">
            {controls.slice(0, 2).map(button)}
            <input
                aria-label={`Duration (minutes) ${rowNumber}`}
                className="h-10 w-full min-w-0 bg-accent px-1 text-center text-base font-semibold text-secondary [appearance:textfield] focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                type="number"
                min={minimum}
                max={maximum}
                step={1}
                required
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
            {controls.slice(2).map(button)}
        </div>
    );
}
