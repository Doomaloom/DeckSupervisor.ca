import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it } from "vitest";
import NotFoundPage from "./NotFound.component";

function setup(path: string) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/" element={<p>Home</p>} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </MemoryRouter>,
    );
}
it("shows a not found page with a link home for unknown addresses", () => {
    setup("/roster");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to home page" })).toHaveAttribute("href", "/");
});
it("does not show for known addresses", () => {
    setup("/");
    expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
});
