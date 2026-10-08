export type SchematicScaleControlProps = {
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    onReset: () => void;
    compact?: boolean;
};
export function useSchematicScaleControlLogic({
    value,
    min,
    max,
    step,
    onChange,
    onReset,
    compact = false,
}: SchematicScaleControlProps) {
    const handleChange = (nextValue: string) => {
        const parsed = Number(nextValue);
        if (Number.isFinite(parsed)) {
            onChange(parsed);
        }
    };

    return {
        view: "ready" as const,
        value,
        compact,
        min,
        max,
        step,
        onChange,
        handleChange,
        onReset,
    };

}
