import type { Student } from "../../../../types/app";
import LevelSelect from "../LevelSelect/LevelSelect.component";

type StudentRowProps = {
    student: Student;
    classLevel: string;
    hasOwnLevel: boolean;
    notSaved?: boolean;
    onLevelChange: (studentId: string, level: string) => void;
};

const linkButtonClass =
    "font-medium text-primary underline underline-offset-2 hover:text-secondary";

// One swimmer in "Each swimmer" mode: the name and a level dropdown. A swimmer
// with their own level gets a line to put them back on the class level.
function StudentRow(
    { student, classLevel, hasOwnLevel, notSaved = false, onLevelChange }:
        StudentRowProps,
) {
    const name = student.name.replace(/"/g, "");
    return (
        <div
            id={`student-row-${student.id}`}
            data-component="student-row"
            className="mt-3 grid grid-cols-1 items-start gap-1 md:grid-cols-[1.2fr_1fr] md:gap-3"
        >
            <p className="pt-2 text-base font-semibold text-text">{name}</p>
            <div>
                <LevelSelect
                    ariaLabel={`${name} level`}
                    value={student.level}
                    onChange={(value) => onLevelChange(student.id, value)}
                />
                {(hasOwnLevel || notSaved) && (
                    <p className="mt-1 text-xs text-secondary/70">
                        {notSaved && (
                            <>
                                <span className="font-semibold text-danger">
                                    Not saved
                                </span>
                                {hasOwnLevel && " · "}
                            </>
                        )}
                        {hasOwnLevel && (
                            <>
                                Own level ·{" "}
                                <button
                                    type="button"
                                    className={linkButtonClass}
                                    onClick={() =>
                                        onLevelChange(student.id, classLevel)}
                                >
                                    Reset to {classLevel}
                                </button>
                            </>
                        )}
                    </p>
                )}
            </div>
        </div>
    );
}

export default StudentRow;
