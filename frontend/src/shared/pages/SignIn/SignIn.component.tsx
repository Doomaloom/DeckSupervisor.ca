import { Link } from "react-router-dom";

import { useSignInLogic } from "./SignIn.logic";
function SignInPage() {
    const viewModel = useSignInLogic();
    if (viewModel.view === "signedIn") {
        return (
            <div
                id="sign-in-page"
                data-component="sign-in-page"
                className="mx-auto flex w-full max-w-xl flex-col gap-6"
            >
                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <h2 className="text-xl font-semibold">You are signed in</h2>
                    <p className="mt-2 text-sm text-secondary/70">
                        Continue to your account settings.
                    </p>
                    <Link
                        to="/account"
                        className="mt-4 inline-flex rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                    >
                        Go to Account
                    </Link>
                </div>
            </div>
        );
    }
    const {
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
    } = viewModel;
    return (
        <div
            id="sign-in-page"
            data-component="sign-in-page"
            className="mx-auto flex w-full max-w-xl flex-col gap-6"
        >
            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <h2 className="text-xl font-semibold">Sign in</h2>
                {params.get("reset") === "success" && (
                    <p
                        className="mt-3 rounded-2xl border border-primary/30 bg-bg px-4 py-3 text-sm font-semibold text-primary"
                        role="status"
                    >
                        Password reset. Sign in with your new password.
                    </p>
                )}
                <p className="mt-2 text-sm text-secondary/70">
                    Use email + password to access your account.
                </p>
                <div className="mt-6 pt-2">
                    <form
                        className="flex flex-col gap-4"
                        onSubmit={handleSubmit}
                    >
                        <input
                            className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="Email"
                            required
                        />
                        <input
                            className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)}
                            placeholder="Password"
                            required
                        />
                        {errorMessage
                            ? (
                                <p className="text-sm font-semibold text-danger">
                                    {errorMessage}
                                </p>
                            )
                            : null}
                        <button
                            type="submit"
                            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isSubmitting}
                        >
                            {isSignUp ? "Create account" : "Sign in"}
                        </button>
                        <button
                            type="button"
                            className="text-sm font-semibold text-secondary/70 transition hover:text-secondary"
                            onClick={() => setIsSignUp((value) => !value)}
                        >
                            {isSignUp
                                ? "Already have an account? Sign in"
                                : "New here? Create an account"}
                        </button>
                        <Link
                            className="text-center text-sm font-semibold text-secondary/70 transition hover:text-secondary"
                            to="/forgot-password"
                        >
                            Forgot password?
                        </Link>
                    </form>
                </div>
            </div>
            <Link
                to="/"
                className="text-center text-sm font-semibold text-secondary/70 transition hover:text-secondary"
            >
                Continue as guest
            </Link>
        </div>
    );
}

export default SignInPage;

