import React from "react";
export function useOptionsGroupLogic({
    title,
    open,
    onToggle,
    children,
}: {
    title: string;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return {
        view: "ready" as const,
        open,
        title,
        onToggle,
        children,
    };

}

