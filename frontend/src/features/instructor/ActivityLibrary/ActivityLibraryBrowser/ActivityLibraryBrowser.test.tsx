import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ActivityLibraryBrowser from "./ActivityLibraryBrowser.component";

it("groups the library and combines category, search, and skill filters", async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    render(
        <ActivityLibraryBrowser
            onUse={onUse}
            selectedSkill={{
                id: "Splash1:5",
                compactName: "Submerge & exhale ×5",
            }}
        />,
    );
    expect(
        screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    )
        .toEqual(["Songs (37)", "Games (4)", "Drills (66)", "Workouts (18)"]);
    const check = screen.getByRole("checkbox", {
        name: /Only activities for Submerge/,
    });
    expect(check).not.toBeChecked();
    await user.click(check);
    expect(screen.queryByText("Clean up song")).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "Five Little Ducks");
    await user.click(screen.getByText("Five Little Ducks"));
    await user.click(
        screen.getByRole("button", { name: "Use Five Little Ducks" }),
    );
    expect(onUse).toHaveBeenCalledWith(
        expect.objectContaining({ id: "songs-five-little-ducks" }),
    );
    await user.click(
        within(screen.getByRole("group", { name: "Activity categories" }))
            .getByRole("button", { name: "Drills" }),
    );
    expect(screen.getByText("No activities match these filters."))
        .toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(check).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("125 activities");
});

it("allows browsing without a skill but explains the disabled skill filter", () => {
    render(<ActivityLibraryBrowser onUse={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByText(/Choose a curriculum skill/)).toBeVisible();
    expect(screen.getByText("Clean up song")).toBeVisible();
});

it("offers read-only browsing when not opened from a lesson row", async () => {
    const user = userEvent.setup();
    render(<ActivityLibraryBrowser />);
    await user.type(
        screen.getByRole("searchbox"),
        "13-18 years: Interval workout 2",
    );
    await user.click(screen.getByText("13-18 years: Interval workout 2"));
    expect(screen.getByText(/200 m, stroke of choice; rest 45 seconds/))
        .toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Use / })).not
        .toBeInTheDocument();
});
