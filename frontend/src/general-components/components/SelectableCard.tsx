import type React from "react";
import { cn } from "../classNames";

export type SelectableCardProps =
    & React.ButtonHTMLAttributes<HTMLButtonElement>
    & {
        selected?: boolean;
    };

export function SelectableCard({
    selected = false,
    type = "button",
    className,
    ...props
}: SelectableCardProps) {
    return (
        <button
            type={type}
            className={cn(
                "rounded-2xl border p-4 text-left font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                selected
                    ? "border-secondary bg-secondary text-accent"
                    : "border-secondary/20 bg-bg text-secondary hover:-translate-y-0.5 hover:border-secondary",
                className,
            )}
            {...props}
        />
    );
}
