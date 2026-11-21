import { Link } from "react-router-dom";

function NotFoundPage() {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <h2 className="text-xl font-semibold">Page not found</h2>
                <p className="mt-2 text-sm text-secondary/70">
                    We could not find the page you were looking for. Check the
                    address, or go back to the home page.
                </p>
                <Link
                    className="mt-4 inline-block rounded-2xl border border-secondary/40 px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-bg"
                    to="/"
                >
                    Go to home page
                </Link>
            </div>
        </div>
    );
}

export default NotFoundPage;
