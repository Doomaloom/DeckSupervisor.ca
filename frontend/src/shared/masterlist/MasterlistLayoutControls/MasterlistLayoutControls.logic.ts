import type { MasterlistAlphabeticalNameBasis, MasterlistLayout, } from "../../../types/app";

export type MasterlistLayoutControlsProps = {
    layout: MasterlistLayout;
    alphabeticalNameBasis: MasterlistAlphabeticalNameBasis;
    onChangeLayout: (layout: MasterlistLayout) => void;
    onChangeAlphabeticalNameBasis: (
        basis: MasterlistAlphabeticalNameBasis,
    ) => void;
    compact?: boolean;
};
export function useMasterlistLayoutControlsLogic({
    layout,
    alphabeticalNameBasis,
    onChangeLayout,
    onChangeAlphabeticalNameBasis,
    compact = false,
}: MasterlistLayoutControlsProps) {
    const spacing = compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm";
    const labelClass =
        `flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg font-semibold text-secondary ${spacing}`;
    const selectClass =
        "rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-primary";

    return {
        view: "ready" as const,
        labelClass,
        selectClass,
        layout,
        onChangeLayout,
        alphabeticalNameBasis,
        onChangeAlphabeticalNameBasis,
    };

}
