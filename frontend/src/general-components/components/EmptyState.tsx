import type React from "react";
import { cn } from "../classNames";

export type EmptyStateProps = {
    title?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
};

export function EmptyState({ title, children, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                "rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary/70",
                className,
            )}
        >
            {title
                ? <p className="font-semibold text-secondary">{title}</p>
                : null}
            {children
                ? <div className={title ? "mt-2" : undefined}>{children}</div>
                : null}
        </div>
    );
}
