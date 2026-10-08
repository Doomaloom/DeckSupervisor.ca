import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import ActivityLibrary from "./ActivityLibrary.component";
it("renders the library and filters activities without requiring a session", async () => {
    const user = userEvent.setup();
    render(<ActivityLibrary />);
    expect(screen.getByRole("heading", { name: "Activity Library" })).toBeVisible();
    await user.type(screen.getByRole("searchbox"), "no-such-activity-xyz");
    expect(screen.getByText(/No activities/)).toBeVisible();
    await user.clear(screen.getByRole("searchbox"));
    expect(screen.queryByText(/No activities/)).not.toBeInTheDocument();
});
