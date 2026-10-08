import PrintPopupBlockedNotice from "../../../components/PrintPopupBlockedNotice";

import { PageShell } from "../../../general-components";

import { printOptions } from "./constants";

import Day1OptionsModal from "./Day1OptionsModal/Day1OptionsModal.component";

import InstructorOptionsModal from "./InstructorOptionsModal/InstructorOptionsModal.component";

import MasterlistOptionsModal from "./MasterlistOptionsModal/MasterlistOptionsModal.component";

import PrintOptionButton from "./PrintOptionButton/PrintOptionButton.component";

import PrintUpdatesModal from "./PrintUpdatesModal/PrintUpdatesModal.component";

import SchematicOptionsModal from "./SchematicOptionsModal/SchematicOptionsModal.component";

import { SCHEMATIC_SCALE_MAX, SCHEMATIC_SCALE_MIN, SCHEMATIC_SCALE_STEP, usePrintLogic } from "./Print.logic";
function PrintPage() {
    const viewModel = usePrintLogic();
    const {
        activeInfo,
        setActiveModal,
        handleToggleInfo,
        setActiveInfo,
        activeModal,
        currentSession,
        sessionTitle,
        isGuest,
        day1Options,
        masterlistFormatOptions,
        schematicScalePercent,
        blockedPrintJob,
        clearBlockedPrintJob,
        handleToggleDay1Option,
        handleToggleMasterlistOption,
        handleChangeMasterlistLayout,
        handleChangeMasterlistAlphabeticalNameBasis,
        handleChangeMasterlistFontSize,
        handleChangeSchematicScale,
        handleResetSchematicScale,
        handlePrint,
        instructorNames,
        busyInstructors,
        isPrintingAllInstructors,
        instructorExtras,
        coverOrientation,
        instructorCoverOrientation,
        handlePrintAllInstructorSheets,
        handlePrintInstructorSheet,
        handleToggleInstructorCover,
        handleToggleInstructorCoverHighlight,
        setInstructorCoverOrientation,
        masterlistExtras,
        masterlistPreviewUrl,
        isMasterlistPreviewLoading,
        masterlistPreviewError,
        handleToggleMasterlistExtra,
        setCoverOrientation,
        handlePrintMasterlist,
        schematicOptions,
        schematicPreviewUrl,
        isSchematicPreviewLoading,
        schematicPreviewError,
        handleToggleSchematicHighlight,
        handleSelectSchematicOrientation,
        setSchematicOptions,
    } = viewModel;
    const blockedPrintNotice = blockedPrintJob
        ? (
            <PrintPopupBlockedNotice
                jobLabel={blockedPrintJob.jobLabel}
                pdfBlob={blockedPrintJob.pdfBlob}
                filename={blockedPrintJob.filename}
                onRetry={blockedPrintJob.retry}
                onDismiss={clearBlockedPrintJob}
            />
        )
        : null;

    return (
        <PageShell
            id="print-page"
            data-component="print-page"
            className="min-w-0"
        >
            <header>
                <h2 className="text-2xl font-semibold text-secondary">Print</h2>
            </header>

            <div className="flex w-full flex-col gap-5">
                {printOptions.map((option) => (
                    <PrintOptionButton
                        key={option.key}
                        option={option}
                        isInfoOpen={activeInfo === option.key}
                        onOpen={() => setActiveModal(option.key)}
                        onToggleInfo={() => handleToggleInfo(option.key)}
                        onCloseInfo={() => setActiveInfo(null)}
                    />
                ))}
            </div>

            {activeModal === "updates" && (
                <PrintUpdatesModal
                    key={currentSession?.id ?? "no-session"}
                    sessionId={currentSession?.id ?? null}
                    sessionTitle={sessionTitle}
                    isGuest={isGuest}
                    onClose={() => setActiveModal(null)}
                />
            )}
            <Day1OptionsModal
                open={activeModal === "day1"}
                options={day1Options}
                formatOptions={masterlistFormatOptions}
                schematicScalePercent={schematicScalePercent}
                scaleMin={SCHEMATIC_SCALE_MIN}
                scaleMax={SCHEMATIC_SCALE_MAX}
                scaleStep={SCHEMATIC_SCALE_STEP}
                notice={activeModal === "day1" ? blockedPrintNotice : null}
                onClose={() => setActiveModal(null)}
                onToggle={handleToggleDay1Option}
                onToggleFormat={handleToggleMasterlistOption}
                onChangeLayout={handleChangeMasterlistLayout}
                onChangeAlphabeticalNameBasis={handleChangeMasterlistAlphabeticalNameBasis}
                onChangeFontSize={handleChangeMasterlistFontSize}
                onChangeSchematicScale={handleChangeSchematicScale}
                onResetSchematicScale={handleResetSchematicScale}
                onPrint={handlePrint}
            />
            <InstructorOptionsModal
                open={activeModal === "instructors"}
                instructorNames={instructorNames}
                busyInstructors={busyInstructors}
                isPrintingAll={isPrintingAllInstructors}
                notice={activeModal === "instructors"
                    ? blockedPrintNotice
                    : null}
                extras={instructorExtras}
                coverOrientation={instructorCoverOrientation}
                schematicScalePercent={schematicScalePercent}
                scaleMin={SCHEMATIC_SCALE_MIN}
                scaleMax={SCHEMATIC_SCALE_MAX}
                scaleStep={SCHEMATIC_SCALE_STEP}
                onClose={() => setActiveModal(null)}
                onPrintAll={handlePrintAllInstructorSheets}
                onPrintInstructor={handlePrintInstructorSheet}
                onToggleCover={handleToggleInstructorCover}
                onToggleCoverHighlight={handleToggleInstructorCoverHighlight}
                onSelectCoverOrientation={setInstructorCoverOrientation}
                onChangeSchematicScale={handleChangeSchematicScale}
                onResetSchematicScale={handleResetSchematicScale}
            />
            <MasterlistOptionsModal
                open={activeModal === "masterlist"}
                extras={masterlistExtras}
                coverOrientation={coverOrientation}
                schematicScalePercent={schematicScalePercent}
                scaleMin={SCHEMATIC_SCALE_MIN}
                scaleMax={SCHEMATIC_SCALE_MAX}
                scaleStep={SCHEMATIC_SCALE_STEP}
                formatOptions={masterlistFormatOptions}
                notice={activeModal === "masterlist"
                    ? blockedPrintNotice
                    : null}
                previewUrl={masterlistPreviewUrl}
                isPreviewLoading={isMasterlistPreviewLoading}
                previewError={masterlistPreviewError}
                onToggleFormat={handleToggleMasterlistOption}
                onChangeLayout={handleChangeMasterlistLayout}
                onChangeAlphabeticalNameBasis={handleChangeMasterlistAlphabeticalNameBasis}
                onChangeFontSize={handleChangeMasterlistFontSize}
                onClose={() => setActiveModal(null)}
                onToggle={handleToggleMasterlistExtra}
                onSelectCoverOrientation={setCoverOrientation}
                onChangeSchematicScale={handleChangeSchematicScale}
                onResetSchematicScale={handleResetSchematicScale}
                onPrint={handlePrintMasterlist}
            />
            <SchematicOptionsModal
                open={activeModal === "schematic"}
                options={schematicOptions}
                instructorNames={instructorNames}
                scalePercent={schematicScalePercent}
                scaleMin={SCHEMATIC_SCALE_MIN}
                scaleMax={SCHEMATIC_SCALE_MAX}
                scaleStep={SCHEMATIC_SCALE_STEP}
                notice={activeModal === "schematic" ? blockedPrintNotice : null}
                previewUrl={schematicPreviewUrl}
                isPreviewLoading={isSchematicPreviewLoading}
                previewError={schematicPreviewError}
                onClose={() => setActiveModal(null)}
                onToggleHighlight={handleToggleSchematicHighlight}
                onSelectOrientation={handleSelectSchematicOrientation}
                onSelectInstructor={(value) =>
                    setSchematicOptions((current) => ({
                        ...current,
                        selectedInstructor: value,
                    }))}
                onChangeScale={handleChangeSchematicScale}
                onResetScale={handleResetSchematicScale}
                onPrint={handlePrint}
            />
        </PageShell>
    );
}

export default PrintPage;

