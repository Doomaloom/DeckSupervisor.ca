import { formatLevelName } from "../../../../shared/levels/formatLevelName";
import { levelOptionGroups, selectClass } from "../constants";

type LevelSelectProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
};

function LevelSelect(
    { value, onChange, placeholder, disabled = false }: LevelSelectProps,
) {
    // Store and show the spaced name the dropdown offers ("Splash 5"), and
    // show older compact values ("Splash5") the same way.
    const selected = formatLevelName(value);
    return (
        <select
            data-component="level-select"
            className={selectClass}
            value={selected}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
        >
            {placeholder
                ? <option value="">{placeholder}</option>
                : <option value={selected}>{selected}</option>}
            {levelOptionGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                        <option
                            key={`${group.label}-${option.value}`}
                            value={option.label}
                        >
                            {option.label}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}

export default LevelSelect;
