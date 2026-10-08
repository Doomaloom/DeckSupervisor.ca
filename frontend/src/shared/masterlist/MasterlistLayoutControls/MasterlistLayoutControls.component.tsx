import { MasterlistLayoutControlsProps, useMasterlistLayoutControlsLogic } from "./MasterlistLayoutControls.logic";
function MasterlistLayoutControls(props: MasterlistLayoutControlsProps) {
    const viewModel = useMasterlistLayoutControlsLogic(props);
    const { labelClass, selectClass, layout, onChangeLayout, alphabeticalNameBasis, onChangeAlphabeticalNameBasis } = viewModel;
    return (
        <>
            <label className={labelClass}>
                Layout
                <select
                    aria-label="Masterlist layout"
                    className={selectClass}
                    value={layout}
                    onChange={(event) =>
                        onChangeLayout(
                            event.target.value === "alphabetical"
                                ? "alphabetical"
                                : "class-time",
                        )}
                >
                    <option value="class-time">Class &amp; Time</option>
                    <option value="alphabetical">Alphabetical</option>
                </select>
            </label>

            {layout === "alphabetical"
                ? (
                    <label className={labelClass}>
                        Alphabetize By
                        <select
                            aria-label="Alphabetize by"
                            className={selectClass}
                            value={alphabeticalNameBasis}
                            onChange={(event) =>
                                onChangeAlphabeticalNameBasis(
                                    event.target.value === "first-name"
                                        ? "first-name"
                                        : "last-name",
                                )}
                        >
                            <option value="first-name">First Name</option>
                            <option value="last-name">Last Name</option>
                        </select>
                    </label>
                )
                : null}
        </>
    );
}

export default MasterlistLayoutControls;

