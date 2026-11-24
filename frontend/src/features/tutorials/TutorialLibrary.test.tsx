import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TutorialLibraryButton } from "./TutorialLibraryButton.component";
import {
    formatDuration,
    TUTORIAL_TABS,
    tutorialVideoUrl,
} from "./tutorialVideos";

const allVideos = TUTORIAL_TABS.flatMap((tab) => tab.videos);

async function openLibrary() {
    const user = userEvent.setup();
    render(<TutorialLibraryButton />);
    await user.click(screen.getByRole("button", { name: "Tutorial videos" }));
    return user;
}

describe("tutorial catalogue", () => {
    it("has unique file names and no empty tabs, Workflows first", () => {
        const files = allVideos.map((v) => v.file);
        expect(new Set(files).size).toBe(files.length);
        expect(files).toHaveLength(17);
        TUTORIAL_TABS.forEach((tab) => expect(tab.videos.length).toBeGreaterThan(0));
        expect(TUTORIAL_TABS[0].label).toBe("Workflows");
    });
    it("formats durations and builds bucket urls", () => {
        expect(formatDuration(286.5)).toBe("4:47");
        expect(formatDuration(39)).toBe("0:39");
        expect(tutorialVideoUrl("a.mp4")).toMatch(
            /\/storage\/v1\/object\/public\/tutorial-videos\/a\.mp4$/,
        );
        expect(tutorialVideoUrl("a.mp4")).not.toContain("//storage");
        // Absolute even when VITE_SUPABASE_URL is unset (it is locally), so the player never asks the website itself.
        expect(tutorialVideoUrl("a.mp4")).toMatch(/^https:\/\/[^/]+\.supabase\.co\//);
    });
});

describe("TutorialLibrary", () => {
    it("opens a dialog with Workflows selected first", async () => {
        await openLibrary();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        const tabs = screen.getAllByRole("tab");
        expect(tabs[0]).toHaveTextContent("Workflows");
        expect(tabs[0]).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    });

    it("lists every video under exactly one tab with its details", async () => {
        const user = await openLibrary();
        let seen = 0;
        for (const tab of TUTORIAL_TABS) {
            await user.click(screen.getByRole("tab", { name: tab.label }));
            const panel = screen.getByRole("tabpanel");
            for (const video of tab.videos) {
                const card = within(panel).getByRole("button", {
                    name: new RegExp(video.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
                });
                expect(card).toHaveTextContent(video.description);
                expect(card).toHaveTextContent(`For: ${video.audience}`);
                expect(card).toHaveTextContent(`App: ${video.app}`);
                expect(card).toHaveTextContent(formatDuration(video.durationSeconds));
                seen += 1;
            }
            expect(within(panel).getAllByRole("button")).toHaveLength(tab.videos.length);
        }
        expect(seen).toBe(allVideos.length);
    });

    it("plays a chosen video from the bucket and goes back", async () => {
        const user = await openLibrary();
        const first = TUTORIAL_TABS[0].videos[0];
        await user.click(screen.getByRole("button", { name: new RegExp(first.title) }));
        const video = document.querySelector("video")!;
        expect(video).toHaveAttribute("src", tutorialVideoUrl(first.file));
        expect(video).toHaveAttribute("preload", "metadata");
        expect(screen.getByRole("heading", { name: first.title })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /Back to videos/ }));
        expect(document.querySelector("video")).toBeNull();
        expect(screen.getAllByRole("tab")).not.toHaveLength(0);
    });

    it("shows a fallback when the video fails", async () => {
        const user = await openLibrary();
        await user.click(
            screen.getByRole("button", { name: new RegExp(TUTORIAL_TABS[0].videos[0].title) }),
        );
        fireEvent.error(document.querySelector("video")!);
        expect(screen.getByText("This video isn't available yet.")).toBeInTheDocument();
        expect(document.querySelector("video")).toBeNull();
    });

    it("closes on Escape", async () => {
        const user = await openLibrary();
        await user.keyboard("{Escape}");
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
