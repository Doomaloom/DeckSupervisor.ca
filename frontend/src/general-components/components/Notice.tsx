import type React from "react";
import { cn } from "../classNames";

export type NoticeTone = "info" | "success" | "warning" | "danger";

export type NoticeProps = React.HTMLAttributes<HTMLDivElement> & {
    tone?: NoticeTone;
};

const toneClasses: Record<NoticeTone, string> = {
    info: "border-secondary/20 bg-bg text-secondary",
    success: "border-primary/30 bg-bg text-primary",
    warning: "border-header/30 bg-bg text-header",
    danger: "border-danger/30 bg-danger/10 text-danger",
};

export function Notice({ tone = "info", className, ...props }: NoticeProps) {
    return (
        <div
            className={cn(
                "rounded-2xl border px-4 py-3 text-sm font-semibold",
                toneClasses[tone],
                className,
            )}
            {...props}
        />
    );
}
