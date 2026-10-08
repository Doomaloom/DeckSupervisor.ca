import { useState } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../../app/AuthContext";

export function useSignInLogic() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { isGuest, signIn, signUp, user } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage("");
        setIsSubmitting(true);
        try {
            if (isSignUp) {
                const message = await signUp(email.trim(), password);
                setErrorMessage(
                    message || "Check your email for a confirmation link.",
                );
                return;
            }
            await signIn(email.trim(), password);
            navigate("/");
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Authentication failed",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isGuest && user) {
        return { view: "signedIn" as const };
    }

    return {
        view: "form" as const,
        params,
        handleSubmit,
        email,
        setEmail,
        password,
        setPassword,
        errorMessage,
        isSubmitting,
        isSignUp,
        setIsSignUp,
    };

}
