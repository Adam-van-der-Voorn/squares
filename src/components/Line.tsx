import React from "react";

export type Props = {
    offsetX: number, offsetY: number, dKey: string, state: "none" | "selected" | "hovered", horiOrVert: "h" | "v", onClick?: any
}

export function Line({ offsetX, offsetY, dKey, state, horiOrVert, onClick }: Props) {
    const backgroundColorMap = {
        "none": "transparent",
        "selected": "black",
        "hovered": "lightgray"
    };

    let style: React.CSSProperties = {
        backgroundColor: backgroundColorMap[state],
    };

    if (horiOrVert === "h") {
        style = {
            ...style,
            top: `calc((${offsetY} * 100%) - var(--line-radius))`,
            left: `calc(0px - var(--line-radius))`,
            width: `calc(100% + (var(--line-radius) * 2))`,
            height: `calc(var(--line-radius) * 2)`,
        }
    }
    else {
        style = {
            ...style,
            top: `calc(0px - var(--line-radius))`,
            left: `calc((${offsetX} * 100%) - var(--line-radius))`,
            width: `calc(var(--line-radius) * 2)`,
            height: `calc(100% + (var(--line-radius) * 2))`,
        }
    };

    return <div className="line"
        data-key={dKey}
        style={style}
        onClick={onClick}
    ></div>
}