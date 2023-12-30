import React, { useEffect } from "react";
import { useState } from "react";
import { newBoard, Board, selectLine, getWinner } from "../game";
import { ReactSetState, unpack } from "../util";
import { Line, Props as LineProps } from "./Line";
import { Dots } from "./Dots";

const CELL_VISUAL_SIZE = 40;

export type Props = {
    rows: number,
    cols: number,
    turn: "p1" | "p2",
    setTurn: ReactSetState<Props["turn"]>,
    onWin: any
}

export function Grid({ rows, cols, onWin, turn, setTurn }: Props) {
    const [board, setBoard] = useState(() => newBoard(cols, rows))
    const [hoveredLine, setHoveredLine] = useState<string | null>(null)

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('click', handleClick)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('click', handleClick)
        }
    })

    const handleMouseMove = (ev: any) => {
        const linesDOM = document.querySelectorAll(".line");
        const mousePos = { x: ev.pageX, y: ev.pageY }
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
            const distance = Math.sqrt(Math.pow(mousePos.x - p.x, 2) + Math.pow(mousePos.y - p.y, 2))
            if (distance < smallestDist) {
                smallestDist = distance;
                closestLine = p.key;
            }
        }
        if (smallestDist > CELL_VISUAL_SIZE) {
            closestLine = null
        }
        setHoveredLine(closestLine);
    }

    const handleClick = () => {
        const key = hoveredLine;
        if (!key || board.lines[key].selected) {
            return;
        }
        const newBoard: Board = { ...board }
        console.group("Line :", key)

        // prev
        let newClaimedSquares = selectLine(newBoard, key, turn);
        console.log("new claimed =", newClaimedSquares)

        setBoard(newBoard)
        if (newClaimedSquares === 0) {
            console.log("switching turn")
            setTurn(t => t === "p1" ? "p2" : "p1")
        }
        const winner = getWinner(newBoard);
        if (winner) {
            onWin(winner)
        }
        console.groupEnd()
    }

    const getLineJsx = (key: string, offsetX = 0, offsetY = 0) => {
        const line = board.lines[key];
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

    const cellsJsx = unpack(board.cells).map(({ x, y, val: cell }) => {
        const linesJsx = cell.lines.flatMap(k => {
            const lines = []
            const line = board.lines[k];
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

    const squaresStyle = {
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        aspectRatio: `${cols} / ${rows}`
    }

    return <div className="squares" style={squaresStyle}>
        {cellsJsx}
    </div>
}