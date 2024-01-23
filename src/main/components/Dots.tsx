import React from "react";

export type Props = {
    x: number, y: number, boardRows: number, boardCols: number
}

export function Dots({ x, y, boardRows, boardCols }: Props) {
    const dots = []
    const brDot = <div className={"dot"}
        key={`dot-br`}
        style={{
            top: `calc(100% - var(--dot-radius))`,
            left: `calc(100% - var(--dot-radius))`,
        }}
    ></div>
    dots.push(brDot);
    if (x === 0 || y === 0) {
        const tlDot = <div className={"dot"}
            key={`dot-tl`}
            style={{
                top: `calc(0px - var(--dot-radius))`,
                left: `calc(0px - var(--dot-radius))`,
            }}
        ></div>
        dots.push(tlDot)
    }

    if (x === 0 && y === boardRows - 1) {
        const blDot = <div className={"dot"}
            key={`dot-bl`}
            style={{
                top: `calc(100% - var(--dot-radius))`,
                left: `calc(0px - var(--dot-radius))`,
            }}
        ></div>
        dots.push(blDot)
    }
    if (y === 0 && x === boardCols - 1) {
        const trDot = <div className={"dot"}
            key={`dot-tr`}
            style={{
                top: `calc(0px - var(--dot-radius))`,
                left: `calc(100% - var(--dot-radius))`,
            }}
        ></div>
        dots.push(trDot)
    }
    return dots;
}