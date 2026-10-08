import type { FormEvent } from "react";
import { resetRecoveredPassword, verifyPasswordRecovery } from "../../../lib/authClient";

import { useEffect, useState } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";

import { passwordRecoveryStatus } from "../../../lib/authClient";

export const invalid =
    "This recovery link is invalid, expired, or already used. Request another reset email.";
export function useResetPasswordLogic() {
    const [params] = useSearchParams(), navigate = useNavigate();
    const hash = params.get("token_hash") || "";
    const [password, setPassword] = useState(""),
        [confirm, setConfirm] = useState(""),
        [error, setError] = useState("");
    const [verified, setVerified] = useState(false),
        [busy, setBusy] = useState(false),
        [checking, setChecking] = useState(!hash);
    useEffect(() => {
        let active = true;
        if (hash) {
            setChecking(false);
            if (params.get("type") && params.get("type") !== "recovery") {
                setError(invalid);
            }
            return;
        }
        if (verified) {
            setChecking(false);
            return;
        }
        passwordRecoveryStatus().then(() => {
            if (active) setVerified(true);
        }).catch(() => {
            if (active) setError(invalid);
        }).finally(() => {
            if (active) setChecking(false);
        });
        return () => {
            active = false;
        };
    }, [hash, params, verified]);
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        if (password !== confirm) {
            setError("Passwords must match.");
            return;
        }
        setBusy(true);
        try {
            if (!verified) {
                if (
                    !hash ||
                    (params.get("type") &&
                        params.get("type") !==
                        "recovery")
                ) throw new Error(invalid);
                await verifyPasswordRecovery(hash);
                setVerified(true);
                navigate("/reset-password", {
                    replace: true,
                });
            }
            await resetRecoveredPassword(
                password,
                confirm,
            );
            navigate("/sign-in?reset=success", {
                replace: true,
            });
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : invalid,
            );
        } finally {
            setBusy(false);
        }
    };
    return {
        handleSubmit,
        view: "ready" as const,
        checking,
        setError,
        password,
        confirm,
        setBusy,
        verified,
        hash,
        params,
        setVerified,
        navigate,
        setPassword,
        setConfirm,
        busy,
        error,
    };

}
