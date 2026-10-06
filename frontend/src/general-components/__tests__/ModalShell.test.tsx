import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "../../test/render";
import { ModalShell } from "../components/ModalShell";

afterEach(cleanup);

describe("ModalShell", () => {
    it("renders title, description, notice, and children", () => {
        render(
            <ModalShell
                title="Edit item"
                description="Update this item."
                notice={<span>Notice content</span>}
                onClose={() => undefined}
            >
                <button type="button">Child action</button>
            </ModalShell>,
        );

        expect(screen.getByText("Edit item")).toBeInTheDocument();
        expect(screen.getByText("Update this item.")).toBeInTheDocument();
        expect(screen.getByText("Notice content")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Child action" }))
            .toBeInTheDocument();
    });

    it("calls onClose from the close button", async () => {
        const user = userEvent.setup();
        const handleClose = vi.fn();

        render(
            <ModalShell title="Edit item" onClose={handleClose}>
                Content
            </ModalShell>,
        );

        await user.click(
            screen.getByRole("button", { name: "Close edit item" }),
        );

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the backdrop is clicked", async () => {
        const user = userEvent.setup();
        const handleClose = vi.fn();

        const { container } = render(
            <ModalShell title="Edit item" onClose={handleClose}>
                Content
            </ModalShell>,
        );

        const backdrop = container.firstElementChild;
        expect(backdrop).not.toBeNull();

        await user.click(backdrop as Element);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when the panel is clicked", async () => {
        const user = userEvent.setup();
        const handleClose = vi.fn();

        render(
            <ModalShell title="Edit item" onClose={handleClose}>
                <div>Panel content</div>
            </ModalShell>,
        );

        await user.click(screen.getByText("Panel content"));

        expect(handleClose).not.toHaveBeenCalled();
    });
});
