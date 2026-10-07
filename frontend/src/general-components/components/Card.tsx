import type React from "react";
import { cn } from "../classNames";

export type CardVariant = "panel" | "subtle" | "interactive" | "plain";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
    variant?: CardVariant;
};

const variantClasses: Record<CardVariant, string> = {
    plain: "text-secondary",
    panel:
        "rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md",
    subtle: "rounded-2xl border border-secondary/20 bg-bg p-4 text-secondary",
    interactive:
        "rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md transition hover:-translate-y-0.5 hover:border-secondary",
};

export function Card({ variant = "panel", className, ...props }: CardProps) {
    return (
        <div
            className={cn(variantClasses[variant], className)}
            {...props}
        />
    );
}
