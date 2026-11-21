import { levelOptionGroups } from "../../features/decksupervisor/Rosters/constants";

const labelByCompactValue = new Map(
    levelOptionGroups.flatMap((group) =>
        group.options.map((option) => [
            option.value.toLowerCase(),
            option.label,
        ] as const)
    ),
);

// Earlier level edits were saved as the compact option value ("Splash5",
// "LittleSplash1"). Show those the way the level dropdown offers them
// ("Splash 5", "Little Splash 1"); any other text is returned unchanged.
export function formatLevelName(level: string): string {
    if (!level) {
        return level;
    }
    return labelByCompactValue.get(level.trim().toLowerCase()) ?? level;
}
