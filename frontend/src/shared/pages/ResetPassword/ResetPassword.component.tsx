import { ActionButton, Card, Notice, PageShell, TextInput, } from "../../../general-components";

import { Link } from "react-router-dom";

import { useResetPasswordLogic } from "./ResetPassword.logic";
export default function ResetPasswordPage() {
    const viewModel = useResetPasswordLogic();
    const {
        handleSubmit,
        checking,
        password,
        confirm,
        setPassword,
        setConfirm,
        busy,
        error,
    } = viewModel;
    return (
        <PageShell maxWidth="xl">
            <Card className="flex flex-col gap-4">
                <h1 className="text-xl font-semibold">Reset password</h1>
                <p>
                    Set and confirm a new password that meets your account's
                    password requirements.
                </p>
                {checking
                    ? <p role="status">Checking recovery session…</p>
                    : (
                        <form
                            className="flex flex-col gap-4"
                            onSubmit={handleSubmit}
                        >
                            <label className="flex flex-col gap-2 text-sm font-semibold">
                                New password{" "}
                                <TextInput
                                    className="w-full"
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={6}
                                    maxLength={1024}
                                    required
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-semibold">
                                Confirm password{" "}
                                <TextInput
                                    className="w-full"
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={6}
                                    maxLength={1024}
                                    required
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                />
                            </label>
                            <ActionButton
                                type="submit"
                                variant="primary"
                                disabled={busy}
                            >
                                {busy ? "Resetting…" : "Reset password"}
                            </ActionButton>
                        </form>
                    )}
                {error && <Notice tone="danger" role="alert">{error}</Notice>}
                <Link
                    className="text-sm font-semibold text-secondary/70 transition hover:text-secondary"
                    to="/forgot-password"
                >
                    Request another reset email
                </Link>
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

