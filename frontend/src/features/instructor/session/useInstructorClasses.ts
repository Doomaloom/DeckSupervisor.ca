export { sessionLabel } from "../../../shared/session/instructorSessionLabels";
import { useInstructorSession } from "./InstructorSessionContext";

export default function useInstructorClasses() {
    return useInstructorSession();
}
