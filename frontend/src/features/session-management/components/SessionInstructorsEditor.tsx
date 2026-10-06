import { useEffect, useState } from "react";
import { ActionButton, Notice } from "../../../general-components";
import {
    type AccountProfile,
    searchLinkableProfiles,
    type SessionInstructor,
} from "../../../lib/serverApi";
import AccountSearch from "../../../shared/accounts/AccountSearch";

type Props = {
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

export default function SessionInstructorsEditor(
    {
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
    }: Props,
) {
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
    return (
        <section
            className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md"
            aria-labelledby="session-instructors-heading"
        >
            <h3
                id="session-instructors-heading"
                className="text-xl font-semibold"
            >
                Session Instructors
            </h3>
            {error
                ? (
                    <Notice tone="danger" role="alert">
                        {error}{" "}
                        <ActionButton onClick={onRetry}>
                            Retry loading instructors
                        </ActionButton>
                    </Notice>
                )
                : loading && !readOnly
                ? <p role="status" className="mt-3">Loading instructors...</p>
                : (
                    <>
                        <label className="mt-4 flex max-w-xs flex-col gap-2 text-sm font-semibold">
                            Number of instructors
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={count}
                                disabled={readOnly}
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2"
                                onChange={(event) =>
                                    setCount(event.target.value)}
                                onBlur={applyCount}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        applyCount();
                                    }
                                }}
                            />
                        </label>
                        {countError && (
                            <p
                                role="alert"
                                className="mt-2 text-sm text-danger"
                            >
                                {countError}
                            </p>
                        )}
                        <p className="my-3 text-sm text-secondary/70">
                            {isGuest
                                ? "Set up the instructor names for this session."
                                : "Account links are optional. Search part-time staff by name or email."}
                        </p>
                        {instructors.map((row, index) => (
                            <div
                                key={row.id}
                                role="group"
                                aria-label={`Instructor ${index + 1}`}
                                className="my-3 grid min-w-0 gap-4 rounded-2xl border border-secondary/20 bg-bg p-4 md:grid-cols-2"
                            >
                                <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">
                                    Instructor {index + 1} name
                                    <input
                                        className="w-full min-w-0 rounded-2xl border-2 border-secondary bg-bg px-3 py-2"
                                        value={row.name}
                                        placeholder="Instructor name"
                                        disabled={readOnly}
                                        onChange={(event) =>
                                            onNameChange(
                                                index,
                                                event.target.value,
                                            )}
                                    />
                                </label>
                                {!isGuest && !readOnly && (
                                    <div className="min-w-0 break-words">
                                        <AccountSearch
                                            key={`${row.id}:${
                                                row.account_id ?? "unlinked"
                                            }`}
                                            compact
                                            label={`Optional account for instructor ${
                                                index + 1
                                            }`}
                                            search={async (query) =>
                                                (await searchLinkableProfiles(
                                                    sessionId,
                                                    query,
                                                ))
                                                    .results}
                                            renderAction={(profile) => (
                                                <ActionButton
                                                    variant="outline"
                                                    disabled={profile.id ===
                                                        row.account_id}
                                                    onClick={() =>
                                                        onAccountChange(
                                                            row.id,
                                                            profile,
                                                        )}
                                                >
                                                    {profile.id ===
                                                            row.account_id
                                                        ? "Linked account"
                                                        : "Select account"}
                                                </ActionButton>
                                            )}
                                        />
                                        <div className="mt-3 flex flex-wrap items-center gap-3">
                                            <p className="text-sm">
                                                {row.account
                                                    ? `${row.account.first_name} ${row.account.last_name} (${row.account.email})`
                                                    : row.account_id
                                                    ? "Account details unavailable"
                                                    : "No account linked"}
                                            </p>
                                            {row.account_id && (
                                                <ActionButton
                                                    variant="outline"
                                                    onClick={() =>
                                                        onAccountChange(
                                                            row.id,
                                                            null,
                                                        )}
                                                >
                                                    Unlink
                                                </ActionButton>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {instructors.length === 0 && (
                            <p className="mt-3 text-sm">
                                No session instructors.
                            </p>
                        )}
                    </>
                )}
        </section>
    );
}
