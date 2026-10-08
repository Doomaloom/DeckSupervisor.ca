export function useInstructorPlaceholderLogic({ title }: { title: string }) {
    return { view: "ready" as const, title };

}
