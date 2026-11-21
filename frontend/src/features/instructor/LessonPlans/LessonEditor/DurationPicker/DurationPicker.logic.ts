import { ChevronDoubleDownIcon, ChevronDoubleUpIcon, ChevronDownIcon, ChevronUpIcon, } from "@heroicons/react/24/outline";
import { useState } from "react";

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
    // While the box is empty or out of range the row keeps its last valid
    // duration; the typed text is held here until it is a whole number of
    // minutes the server accepts, and is dropped on blur.
    const [draft, setDraft] = useState<string | null>(null);
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
        onClick: () => {
            setDraft(null);
            onChange(Math.min(
                maximum,
                Math.max(minimum, (Number.isFinite(value) ? value : minimum) + step),
            ));
        },
    }));
    function type(text: string) {
        const next = Number(text);
        if (text.trim() && Number.isInteger(next) && next >= minimum && next <= maximum) {
            setDraft(null);
            onChange(next);
        } else setDraft(text);
    }

    return {
        view: "ready" as const,
        controls,
        rowNumber,
        value,
        text: draft ?? String(value),
        type,
        blur: () => setDraft(null),
    };

}
