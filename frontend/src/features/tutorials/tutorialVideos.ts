export type TutorialAudience = "Deck supervisor" | "Instructor" | "Both";
export type TutorialApp = "Website" | "Tablet" | "Both";

export type TutorialVideo = {
    file: string;
    title: string;
    description: string;
    audience: TutorialAudience;
    app: TutorialApp;
    durationSeconds: number;
};

export type TutorialTab = {
    id: string;
    label: string;
    videos: TutorialVideo[];
};

/**
 * The tutorial catalogue. Add, remove or re-order videos and tabs here.
 * The first tab is shown first. Files live in the public Supabase Storage
 * bucket `tutorial-videos`.
 */
export const TUTORIAL_TABS: TutorialTab[] = [
    {
        id: "workflows",
        label: "Workflows",
        videos: [
            {
                file: "00b-end-to-end-demo-results.mp4",
                title: "Deck-Tec start to finish",
                description:
                    "See the whole session in one video: the supervisor plans it, instructors plan and mark their lessons, and Deck-Tec handles the results.",
                audience: "Both",
                app: "Both",
                durationSeconds: 286.5,
            },
        ],
    },
    {
        id: "session-setup",
        label: "Session setup",
        videos: [
            {
                file: "01-set-up-a-session.mp4",
                title: "Set up a session",
                description:
                    "Upload the roster export, add your instructors, build the schematic and print the deck paperwork.",
                audience: "Deck supervisor",
                app: "Website",
                durationSeconds: 229.5,
            },
            {
                file: "07-change-levels.mp4",
                title: "Change levels",
                description:
                    "Set a level for a whole class or for each swimmer, then use filters, search and the waitlist.",
                audience: "Deck supervisor",
                app: "Website",
                durationSeconds: 101.9,
            },
            {
                file: "08-build-a-custom-roster.mp4",
                title: "Build a custom roster",
                description:
                    "Regroup two classes of the same level by ability and print the new roster sheet.",
                audience: "Deck supervisor",
                app: "Website",
                durationSeconds: 134.4,
            },
            {
                file: "09-print-options-and-updates.mp4",
                title: "Print options and print updates",
                description:
                    "Choose what each sheet shows, then reprint only the pages that changed after a roster update.",
                audience: "Deck supervisor",
                app: "Website",
                durationSeconds: 197.4,
            },
        ],
    },
    {
        id: "lesson-planning",
        label: "Lesson planning",
        videos: [
            {
                file: "02-plan-a-lesson.mp4",
                title: "Plan a lesson",
                description:
                    "Build the week's plan for one class with equipment, location and minutes, then print the plan and marking sheet.",
                audience: "Instructor",
                app: "Website",
                durationSeconds: 209.4,
            },
            {
                file: "12-activity-library-and-workouts.mp4",
                title: "Activity library and workout builder",
                description:
                    "Find ready-made games, songs, drills and interval sets and add them to a lesson plan.",
                audience: "Instructor",
                app: "Website",
                durationSeconds: 152.9,
            },
            {
                file: "06-plan-the-next-session.mp4",
                title: "Plan the next session's classes",
                description:
                    "Spot thin and full classes, plan the changes and work through the calls to families.",
                audience: "Deck supervisor",
                app: "Website",
                durationSeconds: 166.3,
            },
        ],
    },
    {
        id: "tablet",
        label: "Tablet",
        videos: [
            {
                file: "03-share-to-tablets-and-log-in.mp4",
                title: "Share classes to the tablets",
                description:
                    "Create login codes on the website, then type a code on the tablet to see your classes.",
                audience: "Both",
                app: "Both",
                durationSeconds: 67.7,
            },
            {
                file: "04-teach-a-class-on-the-tablet.mp4",
                title: "Teach a class on the tablet",
                description:
                    "Take attendance, follow the lesson plan, mark skills, time a swim and finish by uploading results.",
                audience: "Instructor",
                app: "Tablet",
                durationSeconds: 289.1,
            },
            {
                file: "13-tablet-marking-modes.mp4",
                title: "Marking modes on the tablet",
                description:
                    "Use Single, Multi and Class marking, hold to undo, and fix an attempt from Feedback.",
                audience: "Instructor",
                app: "Tablet",
                durationSeconds: 207.0,
            },
            {
                file: "14-tablet-housekeeping.mp4",
                title: "Tablet housekeeping",
                description:
                    "Pick the lesson date, switch the screen layout and reset a class's progress.",
                audience: "Instructor",
                app: "Tablet",
                durationSeconds: 119.3,
            },
        ],
    },
    {
        id: "results",
        label: "Results and report cards",
        videos: [
            {
                file: "16-attendance-and-results.mp4",
                title: "Attendance and results",
                description:
                    "Check attendance and skill marks, print sheets and report cards, and review report card oddities in one place.",
                audience: "Deck supervisor",
                app: "Website",
                durationSeconds: 84.7,
            },
            {
                file: "05-review-results-and-print.mp4",
                title: "Review results and print completed sheets",
                description:
                    "See what the tablets sent back, correct a mark and print the filled-in sheets.",
                audience: "Deck supervisor",
                app: "Website",
                durationSeconds: 113.3,
            },
            {
                file: "15-print-filled-report-cards.mp4",
                title: "Print filled report cards",
                description:
                    "Print report cards with ticks, names and next level already filled in.",
                audience: "Deck supervisor",
                app: "Website",
                durationSeconds: 121.6,
            },
            {
                file: "10-report-card-counts.mp4",
                title: "Report card counts",
                description:
                    "See how many report cards each instructor still owes.",
                audience: "Deck supervisor",
                app: "Website",
                durationSeconds: 39.0,
            },
        ],
    },
    {
        id: "notes-reports",
        label: "Notes and reports",
        videos: [
            {
                file: "11-notes-and-session-report.mp4",
                title: "Notes, to-dos and the session report",
                description:
                    "Keep the session's notes and to-dos in one place and write a short end-of-session report.",
                audience: "Deck supervisor",
                app: "Website",
                durationSeconds: 143.1,
            },
        ],
    },
];

export const TUTORIAL_BUCKET = "tutorial-videos";

/**
 * Public, read-only bucket on the production Supabase project. The website does not otherwise need VITE_SUPABASE_URL
 * (it is unset locally), so the bucket's public address is the default; VITE_TUTORIAL_VIDEOS_URL overrides it.
 */
export const DEFAULT_TUTORIAL_VIDEOS_URL = `https://eralmonpesbqjgxagabb.supabase.co/storage/v1/object/public/${TUTORIAL_BUCKET}`;

/** The one place that turns a catalogue file name into a streaming URL. */
export function tutorialVideoUrl(file: string): string {
    const base = String(import.meta.env.VITE_TUTORIAL_VIDEOS_URL || DEFAULT_TUTORIAL_VIDEOS_URL).replace(/\/+$/, "");
    return `${base}/${encodeURIComponent(file)}`;
}

/** Formats seconds as m:ss, rounding to the nearest second. */
export function formatDuration(seconds: number): string {
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}
