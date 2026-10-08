import type { FormEvent } from "react";
import { requestPasswordRecovery } from "../../../lib/authClient";

import { useState } from "react";

export function useForgotPasswordLogic() {
    const [email, setEmail] = useState(""),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [message, setMessage] = useState("");
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        try {
            const result = await requestPasswordRecovery(
                email.trim(),
            );
            setMessage(
                result.message ||
                "If an account exists for that email, you will receive a password reset link.",
            );
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : "Unable to request reset.",
            );
        } finally {
            setBusy(false);
        }
    };
    return {
        handleSubmit,
        view: "ready" as const,
        setBusy,
        setError,
        setMessage,
        email,
        message,
        setEmail,
        busy,
        error,
    };

}
