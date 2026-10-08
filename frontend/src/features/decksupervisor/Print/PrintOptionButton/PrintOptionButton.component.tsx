import { PrintOptionButtonProps, usePrintOptionButtonLogic } from "./PrintOptionButton.logic";
function PrintOptionButton(props: PrintOptionButtonProps) {
    const viewModel = usePrintOptionButtonLogic(props);
    const { option, onOpen, Icon, onToggleInfo, isInfoOpen, onCloseInfo } = viewModel;
    return (
        <div className={`group relative flex h-full flex-col justify-between rounded-card border-2 border-secondary/20 bg-accent p-6 text-left text-secondary shadow-md transition ${option.disabled ? "opacity-70" : "hover:-translate-y-0.5 hover:border-secondary"}`}>
            <button
                type="button"
                className={`flex h-full w-full items-center gap-4 rounded-2xl border-2 border-transparent p-2 text-left transition ${option.disabled ? "cursor-not-allowed" : "hover:border-secondary/40 focus-visible:border-secondary"}`}
                aria-label={option.title}
                disabled={option.disabled}
                onClick={onOpen}
            >
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                    <Icon className="h-7 w-7" />
                </span>
                <span className="text-lg font-semibold">{option.title}</span>
            </button>
            <button
                type="button"
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-secondary/30 bg-bg text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-secondary"
                aria-label={`About ${option.title}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onToggleInfo();
                }}
            >
                ?
            </button>
            {isInfoOpen
                ? (
                    <div
                        className="absolute right-4 top-14 z-10 w-64 rounded-2xl border border-secondary/20 bg-bg p-3 text-sm text-secondary shadow-md"
                        onMouseLeave={onCloseInfo}
                    >
                        {option.description}
                    </div>
                )
                : null}
        </div>
    );
}

export default PrintOptionButton;

