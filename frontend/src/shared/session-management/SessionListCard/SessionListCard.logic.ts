import { getSessionListDisplayMeta } from "../utils/sessionCollections";

import type { SessionListItem } from "../types";

export type SessionListCardProps = {
    item: SessionListItem;
    isCurrent?: boolean;
    onClick: () => void;
};
export function useSessionListCardLogic({ item, isCurrent = false, onClick }: SessionListCardProps) {
    const meta = getSessionListDisplayMeta(item);
    const textClassName =
        "min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]";

    return {
        view: "ready" as const,
        isCurrent,
        onClick,
        textClassName,
        meta,
        item,
    };

}
