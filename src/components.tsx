import React, { useEffect } from "react";
import { useState } from "react";
import { newBoard, Board, selectLine, getWinner, boardDimensions, lineKey } from "./game";
import { ReactSetState, unpack } from "./util";

const CELL_VISUAL_SIZE = 40;
const LINE_VISUAL_RADIUS = 4;
const DOT_VISUAL_RADIUS = 2;

export function App() {
    const [winState, setWinState] = useState<any>(null);
    const [turn, setTurn] = useState<GameProps["turn"]>("p1");

    let message;
    if (winState == null) {
        if (turn == "p1") {
            message = `Player one's turn`
        }
        else {
            message = `Player two's turn`
        }
    }
    else if (winState.winner == `p1`) {
        message = `Player one wins, ${winState.p1}-${winState.p2}!`
    }
    else if (winState.winner == `p2`) {
        message = `Player two wins, ${winState.p2}-${winState.p1}!`
    }
    else {
        message = `It was a tie, ${winState.p1} all!`
    }

    return <div className="content">
        <div className="card">
            <Game onWin={setWinState} turn={turn} setTurn={setTurn}/>
            <div className="message-box">
                {message}
            </div>
        </div>
    </div>
}

type GameProps = {
    turn: "p1" | "p2",
    setTurn: ReactSetState<GameProps["turn"]>,
    onWin: any
}

function Game({ onWin, turn, setTurn }: GameProps) {
    const width = 4, height = 4;
    const [board, setBoard] = useState(() => newBoard(width, height))
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

    const cellsJsx = unpack(board.cells).map(({ x, y, val }) => {
        const key = `cell-${x}-${y}`;
        return <div className={key + " cell"}
            key={key}
            style={{
                top: `${y * CELL_VISUAL_SIZE}px`,
                left: `${x * CELL_VISUAL_SIZE}px`,
                width: `${CELL_VISUAL_SIZE}px`,
                height: `${CELL_VISUAL_SIZE}px`,
            }}
        >
            {val.claim ?? ""}
        </div>
    })

    const dotsJsx = unpack(board.cells).flatMap(({ x, y }) => {
        const dots = []
        const baseStyle = {
            width: `${DOT_VISUAL_RADIUS * 2}px`,
            height: `${DOT_VISUAL_RADIUS * 2}px`,
            borderRadius: `${DOT_VISUAL_RADIUS}px`
        }
        const brDot = <div className={"dot"}
            key={`dot-br-${x}-${y}`}
            style={{
                ...baseStyle,
                top: `${(y * CELL_VISUAL_SIZE) + CELL_VISUAL_SIZE - DOT_VISUAL_RADIUS}px`,
                left: `${(x * CELL_VISUAL_SIZE) + CELL_VISUAL_SIZE - DOT_VISUAL_RADIUS}px`,
            }}
        ></div>
        dots.push(brDot);
        if (x === 0 || y === 0) {
            const tlDot = <div className={"dot"}
                key={`dot-tl-${x}-${y}`}
                style={{
                    ...baseStyle,
                    top: `${(y * CELL_VISUAL_SIZE) - DOT_VISUAL_RADIUS}px`,
                    left: `${(x * CELL_VISUAL_SIZE) - DOT_VISUAL_RADIUS}px`,
                }}
            ></div>
            dots.push(tlDot)
        }
        const { rows, cols } = boardDimensions(board);
        if (x === 0 && y === rows - 1) {
            const blDot = <div className={"dot"}
                key={`dot-bl-${x}-${y}`}
                style={{
                    ...baseStyle,
                    top: `${(y * CELL_VISUAL_SIZE) + CELL_VISUAL_SIZE - DOT_VISUAL_RADIUS}px`,
                    left: `${(x * CELL_VISUAL_SIZE) - DOT_VISUAL_RADIUS}px`,
                }}
            ></div>
            dots.push(blDot)
        }
        if (y === 0 && x === cols - 1) {
            const trDot = <div className={"dot"}
                key={`dot-tr-${x}-${y}`}
                style={{
                    ...baseStyle,
                    top: `${(y * CELL_VISUAL_SIZE) - DOT_VISUAL_RADIUS}px`,
                    left: `${(x * CELL_VISUAL_SIZE) + CELL_VISUAL_SIZE - DOT_VISUAL_RADIUS}px`,
                }}
            ></div>
            dots.push(trDot)
        }
        return dots;
    })

    const linesJsx = Object.entries(board.lines).map(([key, line]) => {
        const { x, y, horiOrVert } = line.key;
        let state: LineProps["state"];
        if (line.selected) {
            state = "selected"
        }
        else if (lineKey(line.key) === hoveredLine) {
            // line is being 'hovered' over
            state = "hovered"
        }
        else {
            state = "none"
        }
        return <Line key={key} dKey={key} x={x} y={y} state={state} horiOrVert={horiOrVert} />
    })

    const squaresStyle = {
        width: `${CELL_VISUAL_SIZE * width}px`,
        height: `${CELL_VISUAL_SIZE * height}px`
    }

    return <div className="squares" style={squaresStyle}>
        {cellsJsx}
        {linesJsx}
        {dotsJsx}
    </div>
}

type LineProps = {
    x: number, y: number, dKey: string, state: "none" | "selected" | "hovered", horiOrVert: "h" | "v", onClick?: any
}

function Line({ x, y, dKey, state, horiOrVert, onClick }: LineProps) {
    const backgroundColorMap = {
        "none": "transparent",
        "selected": "purple",
        "hovered": "lightgray"
    };

    let style: React.CSSProperties = {
        borderRadius: LINE_VISUAL_RADIUS,
        backgroundColor: backgroundColorMap[state],
        zIndex: state === "hovered" ? "1" : "0"
    };

    if (horiOrVert === "h") {
        style = {
            ...style,
            top: `${(y * CELL_VISUAL_SIZE) - LINE_VISUAL_RADIUS}px`,
            left: `${(x * CELL_VISUAL_SIZE) - LINE_VISUAL_RADIUS}px`,
            width: `${CELL_VISUAL_SIZE + (LINE_VISUAL_RADIUS * 2)}px`,
            height: `${(LINE_VISUAL_RADIUS * 2)}px`,
        }
    }
    else {
        style = {
            ...style,
            top: `${(y * CELL_VISUAL_SIZE) - LINE_VISUAL_RADIUS}px`,
            left: `${(x * CELL_VISUAL_SIZE) - LINE_VISUAL_RADIUS}px`,
            width: `${(LINE_VISUAL_RADIUS * 2)}px`,
            height: `${CELL_VISUAL_SIZE + (LINE_VISUAL_RADIUS * 2)}px`,
        }
    };

    return <div className="line"
        data-key={dKey}
        style={style}
        onClick={onClick}
    ></div>
}