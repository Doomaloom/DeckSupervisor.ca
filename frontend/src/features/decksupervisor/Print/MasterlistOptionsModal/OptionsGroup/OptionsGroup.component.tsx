import React from "react";
import { useOptionsGroupLogic } from "./OptionsGroup.logic";

export function OptionsGroup(props: {
    title: string;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    const viewModel = useOptionsGroupLogic(props);
    const { open, title, onToggle, children } = viewModel;
    return (
        <section
            className={`w-full shrink-0 overflow-hidden rounded-2xl border-2 border-secondary ${open ? "" : "h-12"
                }`}
            data-options-group={title}
        >
            <button
                type="button"
                className="flex h-11 w-full items-center justify-between px-4 text-left text-xs font-semibold text-secondary transition hover:bg-bg"
                aria-expanded={open}
                onClick={onToggle}
            >
                <span>{title}</span>
                <span
                    aria-hidden="true"
                    className="text-base leading-none text-primary"
                >
                    {open ? "−" : "+"}
                </span>
            </button>
            {open
                ? (
                    <div className="flex flex-col gap-2 border-t border-secondary/20 p-3">
                        {children}
                    </div>
                )
                : null}
        </section>
    );
}
