// Print groups a session's classes by the instructor's trimmed name, so two
// instructors with the same name would get one merged packet. Compare names
// the same way (trim only, case matters) and return the first repeated one.
export function findDuplicateInstructorName(
    instructors: Array<{ name: string }>,
): string | null {
    const seen = new Set<string>();
    for (const { name } of instructors) {
        const trimmed = name.trim();
        if (!trimmed) {
            continue;
        }
        if (seen.has(trimmed)) {
            return trimmed;
        }
        seen.add(trimmed);
    }
    return null;
}
