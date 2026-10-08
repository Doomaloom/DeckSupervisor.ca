import { ChevronDoubleDownIcon, ChevronDoubleUpIcon, ChevronDownIcon, ChevronUpIcon, } from "@heroicons/react/24/outline";

export const minimum = 1;

export const maximum = 240;
export function useDurationPickerLogic({
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
    ].map(({ step, Icon }) => ({
        step,
        Icon,
        label: `${step < 0 ? "Decrease" : "Increase"} duration by ${Math.abs(step)} ${Math.abs(step) === 1 ? "minute" : "minutes"} for row ${rowNumber}`,
        disabled: step < 0 ? value <= minimum : value >= maximum,
        onClick: () => onChange(Math.min(
            maximum,
            Math.max(minimum, (Number.isFinite(value) ? value : minimum) + step),
        )),
    }));

    return {
        view: "ready" as const,
        controls,
        rowNumber,
        value,
        onChange,
    };

}
