import { maximum, minimum, useDurationPickerLogic } from "./DurationPicker.logic";
export default function DurationPicker(props: {
    value: number;
    onChange: (value: number) => void;
    rowNumber: number;
}) {
    const viewModel = useDurationPickerLogic(props);
    const { controls, rowNumber, value, onChange } = viewModel;
    const button = ({ step, Icon, label, disabled, onClick }: typeof controls[number]) => (
        <button
            key={step}
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            className="flex h-7 w-full items-center justify-center bg-bg text-secondary transition-colors hover:bg-primary hover:text-accent focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg disabled:hover:text-secondary"
            onClick={onClick}
        >
            <Icon className="h-5 w-5" aria-hidden="true" />
        </button>
    );
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

