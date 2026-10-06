import type React from "react";
import { cn } from "../classNames";

export type SegmentedTabItem<T extends string> = {
    key: T;
    label: React.ReactNode;
    disabled?: boolean;
};

export type SegmentedTabsProps<T extends string> = {
    items: SegmentedTabItem<T>[];
    activeKey: T;
    onChange: (key: T) => void;
    shape?: "pill" | "rounded";
    size?: "sm" | "md";
    className?: string;
};

const shapeClasses: Record<
    NonNullable<SegmentedTabsProps<string>["shape"]>,
    string
> = {
    pill: "rounded-full",
    rounded: "rounded-2xl",
};

const sizeClasses: Record<
    NonNullable<SegmentedTabsProps<string>["size"]>,
    string
> = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-2 text-sm",
};

export function SegmentedTabs<T extends string>({
    items,
    activeKey,
    onChange,
    shape = "rounded",
    size = "md",
    className,
}: SegmentedTabsProps<T>) {
    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            {items.map((item) => {
                const isActive = item.key === activeKey;

                return (
                    <button
                        key={item.key}
                        type="button"
                        className={cn(
                            "border font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                            shapeClasses[shape],
                            sizeClasses[size],
                            isActive
                                ? "border-secondary bg-secondary text-accent"
                                : "border-secondary/30 bg-bg text-secondary hover:bg-accent",
                        )}
                        onClick={() => onChange(item.key)}
                        disabled={item.disabled}
                        aria-pressed={isActive}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}
