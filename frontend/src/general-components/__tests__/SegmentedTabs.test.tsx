import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "../../test/render";
import {
    type SegmentedTabItem,
    SegmentedTabs,
} from "../components/SegmentedTabs";

afterEach(cleanup);

type TestTab = "one" | "two" | "three";

const items: Array<SegmentedTabItem<TestTab>> = [
    { key: "one", label: "One" },
    { key: "two", label: "Two" },
    { key: "three", label: "Three", disabled: true },
];

describe("SegmentedTabs", () => {
    it("renders all tabs", () => {
        render(
            <SegmentedTabs
                items={items}
                activeKey="one"
                onChange={() => undefined}
            />,
        );

        expect(screen.getByRole("button", { name: "One" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Two" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Three" }))
            .toBeInTheDocument();
    });

    it("applies active styling to the active tab", () => {
        render(
            <SegmentedTabs
                items={items}
                activeKey="two"
                onChange={() => undefined}
            />,
        );

        expect(screen.getByRole("button", { name: "Two" })).toHaveClass(
            "border-secondary",
            "bg-secondary",
            "text-accent",
        );
    });

    it("calls onChange when a tab is clicked", async () => {
        const user = userEvent.setup();
        const handleChange = vi.fn();

        render(
            <SegmentedTabs
                items={items}
                activeKey="one"
                onChange={handleChange}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Two" }));

        expect(handleChange).toHaveBeenCalledWith("two");
    });

    it("does not call onChange for disabled tabs", async () => {
        const user = userEvent.setup();
        const handleChange = vi.fn();

        render(
            <SegmentedTabs
                items={items}
                activeKey="one"
                onChange={handleChange}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Three" }));

        expect(handleChange).not.toHaveBeenCalled();
    });
});
