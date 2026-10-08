import { PageShell } from "../../../general-components";

import { useActivityLibraryLogic } from "./ActivityLibrary.logic";
import ActivityLibraryBrowser from "./ActivityLibraryBrowser/ActivityLibraryBrowser.component";
export default function ActivityLibrary() {
    const { title } = useActivityLibraryLogic();
    return (
        <PageShell className="min-w-0">
            <header className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold">{title}</h2>
                <p className="text-sm text-secondary/75">
                    Songs, games, drills, and workouts for your next lesson.
                    Open an activity to read its instructions.
                </p>
                <p className="text-sm text-secondary/75">
                    To use an activity in a lesson plan, choose Browse library
                    in its activity row.
                </p>
            </header>
            <ActivityLibraryBrowser />
        </PageShell>
    );
}

