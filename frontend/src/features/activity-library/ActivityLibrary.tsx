import { Card, PageShell } from "../../general-components";
import ActivityLibraryBrowser from "./ActivityLibraryBrowser";

export default function ActivityLibrary() {
    return (
        <PageShell>
            <Card className="space-y-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">Activity Library</h2>
                    <p>
                        Songs, games, drills, and workouts for your next lesson.
                        Open an activity to read its instructions.
                    </p>
                    <p className="text-sm text-secondary/80">
                        To use an activity in a lesson plan, choose Browse
                        library in its activity row.
                    </p>
                </div>
                <ActivityLibraryBrowser />
            </Card>
        </PageShell>
    );
}
