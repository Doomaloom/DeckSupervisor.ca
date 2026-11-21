import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import LevelSelect from "./LevelSelect.component";

it("shows an older compact level with spaces and saves the spaced name (R2-W4)", async () => {
    const onChange = vi.fn();
    render(<LevelSelect value="LittleSplash1" onChange={onChange} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toBe("Little Splash 1");
    expect(screen.queryByRole("option", { name: "LittleSplash1" })).toBeNull();

    await userEvent.setup().selectOptions(select, "Splash 5");
    expect(onChange).toHaveBeenCalledWith("Splash 5");
});

it("keeps a level text from the roster file as it is", () => {
    render(<LevelSelect value="Splash 7 Rookie Patrol" onChange={vi.fn()} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toBe("Splash 7 Rookie Patrol");
});
