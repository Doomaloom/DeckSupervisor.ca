import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Attendance from "./Attendance.component";
it("preserves the attendance placeholder without exposing editing", () => {
    render(<Attendance title="Attendance"/>);
    expect(screen.getByRole("heading", { name: "Attendance" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Attendance editing is not available yet.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
