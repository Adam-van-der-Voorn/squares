import React, { useEffect } from "react";
import { useState } from "react";
import { selectLine, SquaresGame } from "../game";
import { unpack } from "../util/simple";
import { Line, Props as LineProps } from "./Line";
import { Dots } from "./Dots";
import { useDebugLineLabels } from "../util/debug_tools";
import { ReactSetState } from "../util/hooks";

export type Props = {
    rows: number;
    cols: number,
    enabled: boolean
    squaresGame: SquaresGame,
    setSquaresGame: ReactSetState<SquaresGame>,
}

export function Grid({ rows, cols, enabled, squaresGame, setSquaresGame }: Props) {
    let [hoveredLine, setHoveredLine] = useState<string | null>(null)
    if (!enabled) {
        hoveredLine = null;
    }

    useDebugLineLabels();

    useEffect(() => {
        document.addEventListener('pointermove', handlePointerMove)
        document.addEventListener('pointerdown', handlePointerDown)
        return () => {
            document.removeEventListener('pointermove', handlePointerMove)
            document.removeEventListener('pointerdown', handlePointerDown)
        }
    })

    const handlePointerMove = (ev: PointerEvent) => {
        if (ev.pointerType !== 'mouse') {
            return;
        }
        setHoveredLine(getClosestLine(ev.pageX, ev.pageY));
    }

    const handlePointerDown = (ev: PointerEvent) => {
        if (!enabled) {
            return;
        }
        const closestLine = ev.pointerType === 'mouse'
            ? hoveredLine ?? getClosestLine(ev.pageX, ev.pageY)
            // 'touch' or 'pen'
            : getClosestLine(ev.pageX, ev.pageY)

        if (closestLine !== null) {
            selectLineFromKey(closestLine)
        }
    }

    const getClosestLine = (pointerPosX: number, pointerPosY: number): string | null => {
        const linesDOM = document.querySelectorAll(".line");
        const lineRect = linesDOM.item(0)?.getBoundingClientRect();
        if (!lineRect) {
            return null;
        }
        const lineLength = Math.max(lineRect.height, lineRect.width);
        const lineCenters = Array.from(linesDOM)
            .map(el => {
                const r = el.getBoundingClientRect();
                return {
                    key: el.getAttribute("data-key"),
                    x: r.x + (r.width / 2),
                    y: r.y + (r.height / 2)
                }
            });

        // find closest line to mouse
        let closestLine: string | null = null;
        let smallestDist = Number.MAX_SAFE_INTEGER;
        for (const p of lineCenters) {
            const distance = Math.sqrt(Math.pow(pointerPosX - p.x, 2) + Math.pow(pointerPosY - p.y, 2))
            if (distance < smallestDist) {
                smallestDist = distance;
                closestLine = p.key;
            }
        }
        if (smallestDist > lineLength) {
            closestLine = null
        }
        return closestLine;
    }

    const selectLineFromKey = (key: string) => {
        if (squaresGame.board.lines[key].selected) {
            return;
        }
        selectLine(squaresGame, key);
        setSquaresGame({ ...squaresGame })
    }

    const getLineJsx = (key: string, offsetX = 0, offsetY = 0) => {
        const line = squaresGame.board.lines[key];
        const { horiOrVert } = line.key;
        let state: LineProps["state"];
        if (line.selected) {
            state = "selected"
        }
        else if (key === hoveredLine) {
            // line is being 'hovered' over
            state = "hovered"
        }
        else {
            state = "none"
        }
        return <Line key={key} dKey={key} offsetX={offsetX} offsetY={offsetY} state={state} horiOrVert={horiOrVert} />
    }

    const cellsJsx = unpack(squaresGame.board.cells).map(({ x, y, val: cell }) => {
        const linesJsx = cell.lines.flatMap(k => {
            const lines = []
            const line = squaresGame.board.lines[k];
            if (line.key.x === x && line.key.y === y) {
                // tl lines
                lines.push(getLineJsx(k))
            }
            if ((x === cols - 1 || y === rows - 1) && (line.key.x === cols || line.key.y === rows)) {
                // br lines, br cells
                lines.push(getLineJsx(k, 1, 1))
            }
            return lines;
        })

        return <div className="cell" key={`cell-${x}-${y}`}>
            {linesJsx}
            <Dots x={x} y={y} boardRows={rows} boardCols={cols} />
            {cell.claim ?? ""}
        </div>
    })

    return <>{cellsJsx}</>
}