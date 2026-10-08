import type { PrintOption } from "../types";

export type PrintOptionButtonProps = {
    option: PrintOption;
    isInfoOpen: boolean;
    onOpen: () => void;
    onToggleInfo: () => void;
    onCloseInfo: () => void;
};
export function usePrintOptionButtonLogic({
    option,
    isInfoOpen,
    onOpen,
    onToggleInfo,
    onCloseInfo,
}: PrintOptionButtonProps) {
    const Icon = option.icon;

    return {
        view: "ready" as const,
        option,
        onOpen,
        Icon,
        onToggleInfo,
        isInfoOpen,
        onCloseInfo,
    };

}
