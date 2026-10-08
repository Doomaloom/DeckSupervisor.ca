import React from "react";

import { useCoursePointerDrag } from "../hooks/useCoursePointerDrag";

import type { Course } from "../types";

export type CourseCardProps = {
    course: Course;
    capacity: number;
    capacityClass: string;
    style: React.CSSProperties;
    selected?: boolean;
    draggable?: boolean;
    onClick: () => void;
    onDragStart: () => void;
    onDropAt: (x: number, y: number) => void;
    onHoverAt: (x: number | null, y: number | null) => void;
    highlighted?: boolean;
};
export function useCourseCardLogic({
    course,
    capacity,
    capacityClass,
    style,
    selected = false,
    draggable = true,
    onClick,
    onDragStart,
    onDropAt,
    onHoverAt,
    highlighted = false,
}: CourseCardProps) {
    const pointerDrag = useCoursePointerDrag(
        draggable,
        onDragStart,
        onDropAt,
        onHoverAt,
    );
    const backgroundClass = highlighted || selected
        ? "bg-bg"
        : course.isRequested
            ? "bg-yellow-200"
            : "bg-accent hover:bg-bg";
    const requestClass = course.isRequested ? "ring-2 ring-yellow-500" : "";

    return {
        view: "ready" as const,
        backgroundClass,
        requestClass,
        course,
        selected,
        draggable,
        pointerDrag,
        onClick,
        style,
        capacityClass,
        capacity,
    };

}
