import React, { useEffect, useLayoutEffect, useRef } from "react";
import { useState } from "react";
import { newBoard, Board, selectLine, getWinner, boardDimensions, lineKey } from "./game";
import { ReactSetState, getPxValue, unpack, useWindowDimensions } from "./util";

const CELL_VISUAL_SIZE = 40;
const LINE_VISUAL_RADIUS = 4;
const DOT_VISUAL_RADIUS = 2;

export function App() {
    // fake player input
    const width = 6, height = 6;
    return Game({ width, height, withAI: false })
}

export function Game({ width, height, vsAI }: any) {
    const [winState, setWinState] = useState<any>(null);
    const [turn, setTurn] = useState<GridProps["turn"]>("p1");
    const [style, setStyle] = useState<React.CSSProperties>({ width: "100%", height: "fit-content" })
    const ref = useRef<HTMLDivElement>(null)
    const { windowHeight, windowWidth } = useWindowDimensions()

    const rootStyles = getComputedStyle(document.documentElement)

    useLayoutEffect(() => {
        if (!ref.current) {
            return;
        }
        if (style.width === "100%") {
            // case 1: card style is configured to work when it is shorter than the window dimensions
            const clientCard = ref.current.getBoundingClientRect();
            const maxHeight = windowHeight - (getPxValue(rootStyles, '--body-padding') * 2);
            if (clientCard.height > maxHeight) {
                // card is taller then window dimensions, switch case
                setStyle(prev => ({ ...prev, height: "100%", width: "fit-content" }))
            }
        }
        else {
            // case 2: card style is configured to work when it is wider than the window dimensions
            const gridTemplateHeightStr = getComputedStyle(ref.current)
                .gridTemplateRows
                .split(' ')?.[0]
            const gridTemplateHeight = parseInt(gridTemplateHeightStr);
            const actualGridHeight = ref.current.querySelector(".squares")!
                .getBoundingClientRect()
                .height;
            if (actualGridHeight < gridTemplateHeight) {
                  // card is taller than it should be, switch case
                  setStyle(prev => ({ ...prev, height: "fit-content", width: "100%" }))
            }
        }
    }, [windowHeight, windowWidth])

    useLayoutEffect(() => {
        if (!ref.current) {
            return;
        }
        const cellSize = ref.current.querySelector(".cell")!
            .getBoundingClientRect()
            .width;

        if (cellSize) {
            const padding = cellSize * 0.7;
            const prevPadding = parseFloat(style.padding as string)
            if (isNaN(prevPadding) || Math.abs(padding - prevPadding) >= 1) {
                const paddingPx = `${Math.floor(padding)}px`
                setStyle(prev => ({ ...prev, "padding": paddingPx, "rowGap": paddingPx }))
            }
        }
    })

    console.log({ windowHeight, windowWidth })

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

    return <div className="card" style={style} ref={ref}>
        <Grid onWin={setWinState} turn={turn} setTurn={setTurn} rows={height} cols={width} />
        <div className="message-box">
            {message}
        </div>
    </div>
}

type GridProps = {
    rows: number,
    cols: number,
    turn: "p1" | "p2",
    setTurn: ReactSetState<GridProps["turn"]>,
    onWin: any
}

function Grid({ rows, cols, onWin, turn, setTurn }: GridProps) {
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

type LineProps = {
    offsetX: number, offsetY: number, dKey: string, state: "none" | "selected" | "hovered", horiOrVert: "h" | "v", onClick?: any
}

function Line({ offsetX, offsetY, dKey, state, horiOrVert, onClick }: LineProps) {
    const backgroundColorMap = {
        "none": "transparent",
        "selected": "black",
        "hovered": "lightgray"
    };

    let style: React.CSSProperties = {
        borderRadius: LINE_VISUAL_RADIUS,
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

type DotProps = {
    x: number, y: number, boardRows: number, boardCols: number
}

function Dots({ x, y, boardRows, boardCols }: DotProps) {
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