import { useEffect, useMemo, useState } from "react";

import { useCurrentTeam } from "../../../app/useCurrentTeam";

import { createTermKey, formatTermLabel, useCurrentTerm, } from "../../../app/useCurrentTerm";

import { getYearFromDate } from "../../../shared/session/sessionLabels";

import { fetchTeamSessions } from "../../../lib/serverApi";

import { showAppNotice } from "../../../lib/appNotice";

export type TeamSessionRow = {
    id: string;
    session_season: string | null;
    session_year: number | null;
    start_date: string | null;
};

export type SessionTermOption = {
    key: string;
    season: string;
    year: number;
    label: string;
    sessionCount: number;
};

export const seasonRank: Record<string, number> = {
    winter: 0,
    spring: 1,
    summer: 2,
    fall: 3,
};

export const seasonOptions = ["Winter", "Spring", "Summer", "Fall"];

export function toTitleCase(value: string) {
    if (!value) {
        return "";
    }
    return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}
export function useFullTimerToolsLogic() {
    const {
        teams,
        currentTeam,
        currentTeamId,
        loading: teamsLoading,
        setCurrentTeamId,
    } = useCurrentTeam();
    const { currentTermKey, setCurrentTermKey, clearCurrentTerm } =
        useCurrentTerm();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastFilename, setLastFilename] = useState<string | null>(null);
    const [teamSessions, setTeamSessions] = useState<TeamSessionRow[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    useEffect(() => {
        if (!currentTeamId) {
            setTeamSessions([]);
            return;
        }
        let active = true;
        const load = async () => {
            setSessionsLoading(true);
            try {
                const response = await fetchTeamSessions(
                    currentTeamId,
                    "id,session_season,session_year,start_date",
                );
                if (!active) {
                    return;
                }
                setTeamSessions((response.sessions ?? []) as TeamSessionRow[]);
            } catch (error) {
                console.error("Failed to load team sessions", error);
                setTeamSessions([]);
            }
            setSessionsLoading(false);
        };
        void load();
        return () => {
            active = false;
        };
    }, [currentTeamId]);

    const sessionTerms = useMemo(() => {
        const grouped = new Map<string, SessionTermOption>();
        teamSessions.forEach((session) => {
            const season = session.session_season?.trim() ?? "";
            const year = session.session_year ??
                getYearFromDate(session.start_date);
            if (!season || !year) {
                return;
            }
            const normalizedSeason = season.toLowerCase();
            const key = createTermKey(normalizedSeason, year);
            if (!key) {
                return;
            }
            const existing = grouped.get(key);
            if (existing) {
                grouped.set(key, {
                    ...existing,
                    sessionCount: existing.sessionCount + 1,
                });
                return;
            }
            grouped.set(key, {
                key,
                season: normalizedSeason,
                year,
                label: formatTermLabel(season, year) ||
                    `${toTitleCase(season)} ${year}`,
                sessionCount: 1,
            });
        });
        return Array.from(grouped.values()).sort((a, b) => {
            if (a.year !== b.year) {
                return b.year - a.year;
            }
            const rankA = seasonRank[a.season] ?? 99;
            const rankB = seasonRank[b.season] ?? 99;
            if (rankA !== rankB) {
                return rankA - rankB;
            }
            return a.label.localeCompare(b.label);
        });
    }, [teamSessions]);

    const sessionTermYears = useMemo(() => {
        const years = new Set<number>();
        sessionTerms.forEach((term) => years.add(term.year));
        return Array.from(years).sort((a, b) => b - a);
    }, [sessionTerms]);

    useEffect(() => {
        if (!currentTeamId || sessionTerms.length === 0) {
            clearCurrentTerm();
            return;
        }
        const hasSelected = sessionTerms.some((term) =>
            term.key === currentTermKey
        );
        if (!hasSelected) {
            setCurrentTermKey(sessionTerms[0].key);
        }
    }, [
        clearCurrentTerm,
        currentTeamId,
        currentTermKey,
        sessionTerms,
        setCurrentTermKey,
    ]);

    const selectedTerm = useMemo(
        () => sessionTerms.find((term) => term.key === currentTermKey) ?? null,
        [currentTermKey, sessionTerms],
    );

    const selectedTermYear = selectedTerm?.year ?? null;

    const sessionTermsForSelectedYear = useMemo(() => {
        if (!selectedTermYear) {
            return [];
        }
        return sessionTerms.filter((term) => term.year === selectedTermYear);
    }, [selectedTermYear, sessionTerms]);

    const handleSelectTermYear = (yearInput: string) => {
        if (!yearInput) {
            clearCurrentTerm();
            return;
        }
        const parsedYear = Number.parseInt(yearInput, 10);
        if (!Number.isFinite(parsedYear) || parsedYear <= 0) {
            return;
        }
        const nextTerm = sessionTerms.find((term) => term.year === parsedYear);
        if (!nextTerm) {
            clearCurrentTerm();
            return;
        }
        setCurrentTermKey(nextTerm.key);
    };

    const handleSelectTermSeason = (season: string) => {
        if (!season) {
            clearCurrentTerm();
            return;
        }
        if (!selectedTermYear) {
            return;
        }
        const nextKey = createTermKey(season, selectedTermYear);
        if (!nextKey || !sessionTerms.some((term) => term.key === nextKey)) {
            return;
        }
        setCurrentTermKey(nextKey);
    };

    const handleGenerate = async () => {
        if (!selectedFile) {
            showAppNotice(
                "Please upload the schematic maker CSV file.",
                "error",
            );
            return;
        }

        setIsGenerating(true);
        try {
            const formData = new FormData();
            formData.append("csv_file", selectedFile);

            const response = await fetch("/api/schematic-maker", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(
                    message || "Failed to generate schematic maker workbook.",
                );
            }

            const blob = await response.blob();
            const contentDisposition =
                response.headers.get("Content-Disposition") ??
                "";
            const match = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
            const filename = match?.[1] ?? "schematic-maker-output.zip";

            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
            setLastFilename(filename);
        } catch (error) {
            console.error(error);
            showAppNotice(
                "Unable to generate the schematic maker output. Please try again.",
                "error",
            );
        } finally {
            setIsGenerating(false);
        }
    };

    return {
        view: "ready" as const,
        currentTeamId,
        setCurrentTeamId,
        clearCurrentTerm,
        teamsLoading,
        teams,
        selectedTermYear,
        handleSelectTermYear,
        sessionsLoading,
        sessionTermYears,
        selectedTerm,
        handleSelectTermSeason,
        sessionTermsForSelectedYear,
        sessionTerms,
        currentTeam,
        selectedFile,
        setSelectedFile,
        setLastFilename,
        handleGenerate,
        isGenerating,
        lastFilename,
    };

}
