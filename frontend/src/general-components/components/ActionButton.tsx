import type React from "react";
import { cn } from "../classNames";

export type ActionButtonVariant =
    | "primary"
    | "secondary"
    | "outline"
    | "danger"
    | "ghost";
export type ActionButtonSize = "sm" | "md" | "lg";

export type ActionButtonProps =
    & React.ButtonHTMLAttributes<HTMLButtonElement>
    & {
        variant?: ActionButtonVariant;
        size?: ActionButtonSize;
        fullWidth?: boolean;
    };

const variantClasses: Record<ActionButtonVariant, string> = {
    primary: "bg-primary text-white hover:bg-secondary",
    secondary: "bg-secondary text-accent hover:bg-accent hover:text-secondary",
    outline: "border border-secondary/40 text-secondary hover:bg-bg",
    danger: "bg-danger text-accent hover:bg-dangerHover",
    ghost: "text-secondary hover:bg-bg",
};

const sizeClasses: Record<ActionButtonSize, string> = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2 text-base",
};

export function ActionButton({
    variant = "secondary",
    size = "md",
    fullWidth = false,
    type = "button",
    className,
    ...props
}: ActionButtonProps) {
    return (
        <button
            type={type}
            className={cn(
                "rounded-2xl font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60",
                variantClasses[variant],
                sizeClasses[size],
                fullWidth && "w-full",
                className,
            )}
            {...props}
        />
    );
}
