import { useState } from "react";
import { ActionButton } from "../../../../../general-components";

export const equipmentChoices = [
    "Kickboards", "Noodles", "Pull buoys", "Fins", "PFDs", "Diving rings",
    "Sinking toys", "Balls", "Floating mats", "5 lb weights", "10 lb weights",
    "20 lb weights",
];

export default function EquipmentPicker({ value = [], rowNumber, onChange }: {
    value?: string[];
    rowNumber: number;
    onChange: (value: string[]) => void;
}) {
    const [custom, setCustom] = useState("");
    const choices = [...new Set([...equipmentChoices, ...value])];
    function addCustom() {
        const item = custom.trim();
        if (item && !value.some(v => v.toLowerCase() === item.toLowerCase())) {
            onChange([...value, item]);
        }
        setCustom("");
    }
    return (
        <details className="min-w-44 text-left text-sm">
            <summary className="cursor-pointer rounded-2xl border-2 border-secondary p-2">
                {value.length ? value.join(", ") : "Select equipment"}
            </summary>
            <fieldset
                aria-label={`Equipment required ${rowNumber}`}
                className="mt-2 flex min-w-44 flex-col gap-2 text-left text-sm"
            >
                <legend className="sr-only">Equipment required</legend>
                {choices.map(item => (
                    <label key={item} className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={value.includes(item)}
                            disabled={!value.includes(item) && value.length >= 50}
                            onChange={e => onChange(e.target.checked
                                ? [...value, item]
                                : value.filter(v => v !== item))}
                        />
                        {item}
                    </label>
                ))}
                <input
                    aria-label={`Custom equipment ${rowNumber}`}
                    className="rounded border p-2"
                    maxLength={100}
                    value={custom}
                    onChange={e => setCustom(e.target.value)}
                    placeholder="Custom equipment"
                />
                <ActionButton
                    size="sm"
                    variant="outline"
                    disabled={!custom.trim() || value.length >= 50}
                    onClick={addCustom}
                >
                    Add equipment
                </ActionButton>
            </fieldset>
        </details>
    );
}
