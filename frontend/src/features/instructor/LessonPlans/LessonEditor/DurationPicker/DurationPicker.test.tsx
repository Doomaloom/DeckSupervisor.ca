import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import DurationPicker from "./DurationPicker.component";

it("adjusts by one or five minutes and stops at the duration limits", async () => {
    function Picker() {
        const [value, setValue] = useState(12);
        return <DurationPicker value={value} onChange={setValue} rowNumber={1} />;
    }
    render(<Picker />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Duration (minutes) 1");
    const control = (direction: string, amount: number) => screen.getByRole("button", {
        name: `${direction} duration by ${amount} ${amount === 1 ? "minute" : "minutes"} for row 1`,
    });
    await user.click(control("Decrease", 5));
    expect(input).toHaveValue(7);
    await user.click(control("Decrease", 1));
    expect(input).toHaveValue(6);
    await user.click(control("Increase", 1));
    await user.click(control("Increase", 5));
    expect(input).toHaveValue(12);

    await user.clear(input);
    await user.type(input, "238");
    await user.click(control("Increase", 5));
    expect(input).toHaveValue(240);
    expect(control("Increase", 1)).toBeDisabled();
    expect(control("Increase", 5)).toBeDisabled();

    await user.clear(input);
    await user.type(input, "2");
    await user.click(control("Decrease", 5));
    expect(input).toHaveValue(1);
    expect(control("Decrease", 1)).toBeDisabled();
    expect(control("Decrease", 5)).toBeDisabled();
});
it("holds an empty or out-of-range box as a draft and shows a retyped number without a leading zero", async () => {
    const changes: number[] = [];
    function Picker() {
        const [value, setValue] = useState(6);
        return <DurationPicker value={value} onChange={(next) => {
            changes.push(next);
            setValue(next);
        }} rowNumber={1} />;
    }
    render(<Picker />);
    const user = userEvent.setup();
    const input = screen.getByLabelText<HTMLInputElement>("Duration (minutes) 1");
    await user.clear(input);
    expect(input.value).toBe("");
    await user.type(input, "0");
    expect(changes).toEqual([]);
    await user.clear(input);
    await user.type(input, "7");
    expect(input.value).toBe("7");
    expect(changes).toEqual([7]);

    await user.clear(input);
    await user.tab();
    expect(input.value).toBe("7");
    expect(changes).toEqual([7]);
});
