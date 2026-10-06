import type React from "react";
import { cn } from "../classNames";

export type FieldProps = {
    label?: React.ReactNode;
    helperText?: React.ReactNode;
    error?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
};

export function Field(
    { label, helperText, error, children, className }: FieldProps,
) {
    return (
        <label className={cn("flex flex-col gap-2", className)}>
            {label
                ? (
                    <span className="text-sm font-semibold text-secondary">
                        {label}
                    </span>
                )
                : null}
            {children}
            {error
                ? (
                    <span className="text-xs font-semibold text-danger">
                        {error}
                    </span>
                )
                : helperText
                ? (
                    <span className="text-xs font-medium text-secondary/70">
                        {helperText}
                    </span>
                )
                : null}
        </label>
    );
}
