import { ActionButton, Card, Notice, PageShell, TextInput, } from "../../../general-components";

import { Link } from "react-router-dom";

import { useForgotPasswordLogic } from "./ForgotPassword.logic";
export default function ForgotPasswordPage() {
    const viewModel = useForgotPasswordLogic();
    const { handleSubmit, email, message, setEmail, busy, error } = viewModel;
    return (
        <PageShell maxWidth="xl">
            <Card className="flex flex-col gap-4">
                <h1 className="text-xl font-semibold">Forgot password?</h1>
                <p>Enter your email to request a password reset link.</p>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={handleSubmit}
                >
                    <label className="flex flex-col gap-2 text-sm font-semibold">
                        Email{" "}
                        <TextInput
                            className="w-full"
                            type="email"
                            autoComplete="email"
                            required
                            maxLength={254}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </label>
                    <ActionButton
                        type="submit"
                        variant="primary"
                        disabled={busy}
                    >
                        {busy ? "Requesting…" : "Send reset link"}
                    </ActionButton>
                </form>
                {message && (
                    <Notice tone="success" role="status">{message}</Notice>
                )}
                {error && <Notice tone="danger" role="alert">{error}</Notice>}
                <Link
                    className="text-sm font-semibold text-secondary/70 transition hover:text-secondary"
                    to="/sign-in"
                >
                    Back to sign in
                </Link>
            </Card>
        </PageShell>
    );
}

