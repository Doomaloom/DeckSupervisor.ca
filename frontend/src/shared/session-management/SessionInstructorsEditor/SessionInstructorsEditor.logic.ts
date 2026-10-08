import { useEffect, useState } from "react";

import { type AccountProfile, type SessionInstructor } from "../../../lib/serverApi";

export type Props = {
    sessionId: string;
    instructors: SessionInstructor[];
    isGuest: boolean;
    readOnly?: boolean;
    loading?: boolean;
    error?: string;
    onRetry: () => void;
    onCountChange: (count: number) => boolean;
    onNameChange: (index: number, name: string) => void;
    onAccountChange: (id: string, account: AccountProfile | null) => void;
};
export function useSessionInstructorsEditorLogic({
    sessionId,
    instructors,
    isGuest,
    readOnly = false,
    loading = false,
    error = "",
    onRetry,
    onCountChange,
    onNameChange,
    onAccountChange,
}: Props) {
    const [count, setCount] = useState(String(instructors.length));
    const [countError, setCountError] = useState("");
    useEffect(() => {
        setCount(String(instructors.length));
        setCountError("");
    }, [sessionId, instructors.length]);
    function applyCount() {
        const value = Number(count);
        if (!count.trim() || !Number.isSafeInteger(value) || value < 0) {
            setCountError("Enter a whole number of zero or more.");
            return;
        }
        setCountError("");
        if (value !== instructors.length && !onCountChange(value)) {
            setCount(String(instructors.length));
        }
    }
    return {
        view: "ready" as const,
        error,
        onRetry,
        loading,
        readOnly,
        count,
        setCount,
        applyCount,
        countError,
        isGuest,
        instructors,
        onNameChange,
        sessionId,
        onAccountChange,
    };

}
