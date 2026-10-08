export function sanitizeLevel(level: string): string {
    if (!level) {
        return "SplashFitness";
    }
    const normalized = level.trim();

    if (/private/i.test(normalized)) {
        return "SplashPrivate";
    }

    if (/splash\s*fitness/i.test(normalized)) {
        return "SplashFitness";
    }

    const teenMatch = normalized.match(/teen\s*\/?\s*adult\s*(\d+)/i);
    if (teenMatch?.[1]) {
        return `TeenAdult${teenMatch[1]}`;
    }

    const littleMatch = normalized.match(/little\s*splash\s*(\d+)/i);
    if (littleMatch?.[1]) {
        return `LittleSplash${littleMatch[1]}`;
    }

    const parentMatch = normalized.match(/parent\s*(?:and|&)\s*tot\s*(\d+)/i);
    if (parentMatch?.[1]) {
        return `ParentandTot${parentMatch[1]}`;
    }

    const splashMatch = normalized.match(/splash\s*(\d+)([a-z])?/i);
    if (splashMatch?.[1]) {
        const suffix = splashMatch[2] ? splashMatch[2].toUpperCase() : "";
        return `Splash${splashMatch[1]}${suffix}`;
    }

    let sanitized = normalized.replace(/^Swim\s*/i, "");
    sanitized = sanitized.replace(/&/g, "and");
    sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");

    if (sanitized.includes("Teen") || sanitized.includes("Adult")) {
        const parts = normalized.split(/[\s/]+/);
        sanitized = `TeenAdult${parts[2] ?? ""}`.trim();
    }
    if (sanitized.includes("Splash7")) return "Splash7";
    if (sanitized.includes("Splash8")) return "Splash8";
    if (sanitized.includes("Splash9")) return "Splash9";
    return sanitized;
}

