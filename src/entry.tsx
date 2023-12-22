import React, { useState } from "react"
import { createRoot } from 'react-dom/client';

const appContent = createRoot(document.querySelector("#react-root")!)
appContent.render(<App />)


const CELL_VISUAL_SIZE = 40;
const LINE_VISUAL_RADIUS = 4;


type PlayerKey = "p1" | "p2"

function lineKey({ x, y, horiOrVert }: LineKey): string {
    return x.toString() + "," + y.toString() + horiOrVert
}

type LineKey = { x: number, y: number, horiOrVert: "h" | "v" }

type Line = {
    key: LineKey
    cells: {x: number, y: number}[],
    selected: boolean,
}

type Cell = {
    // NESW
    lines: [string, string, string, string]
    claim: PlayerKey | null,
}

type Board = {
    lines: Record<string, Line>
    cells: Cell[][]
}

function newUninitalisedLine(key: LineKey): Line {
    return {
        key,
        cells: [],
        selected: false
    }
}

function newBoard(width: number, height: number): Board {
    const lines: Record<string, Line> = {}

    // vertical lines
    for (let rowi = 0; rowi < height; rowi++) {
        for (let coli = 0; coli < width + 1; coli++) {
            const key: LineKey = { x: coli, y: rowi, horiOrVert: "v" }
            lines[lineKey(key)] = newUninitalisedLine(key)
        }
    }

    // horizontal lines
    for (let rowi = 0; rowi < height + 1; rowi++) {
        for (let coli = 0; coli < width; coli++) {
            const key: LineKey = { x: coli, y: rowi, horiOrVert: "h" }
            lines[lineKey(key)] = newUninitalisedLine(key)
        }
    }

    // cells
    const cells: Cell[][] = []
    for (let rowi = 0; rowi < height; rowi++) {
        const row: Cell[] = []
        cells.push(row)
        for (let coli = 0; coli < width; coli++) {
            const n = lineKey({ x: coli, y: rowi, horiOrVert: "h" });
            const e = lineKey({ x: coli + 1, y: rowi, horiOrVert: "v" });
            const s = lineKey({ x: coli, y: rowi + 1, horiOrVert: "h" });
            const w = lineKey({ x: coli, y: rowi, horiOrVert: "v" });
            row.push({ lines: [n, s, e, w], claim: null })
        }
    }

    // add cell info to lines
    for (const [k, line] of Object.entries(lines)) {
        const { x, y } = line.key;
        if (line.key.horiOrVert === "h") {
            const ca = cells[y]?.[x];
            if (ca) {
                line.cells.push({x, y})
            }
            const cb = cells[y - 1]?.[x];
            if (cb) {
                line.cells.push({x, y: y - 1})
            }
        }
        else {
            const ca = cells[y]?.[x];
            if (ca) {
                line.cells.push({ x, y })
            }
            const cb = cells[y]?.[x - 1];
            if (cb) {
                line.cells.push({x: x - 1, y})
            }
        }

    }
    console.log(lines)
    return { cells, lines }
}

function App() {
    const [board, setBoard] = useState(() => newBoard(10, 10))
    const [turn, setTurn] = useState<("p1" | "p2")>("p1");

    const clickLine = (ev: any) => {
        const el: HTMLDivElement = ev.target
        const key = el.getAttribute("data-key")!;
        if (board.lines[key].selected) {
            return;
        }
        const newBoard: Board = { ...board }
        console.group("Line :", key)
        newBoard.cells.forEach(c => c.forEach(cc => console.log(cc.lines.length)))

        // prev
        let currentClaimedSquares = 0;
        for (const {x, y} of newBoard.lines[key].cells) {
            console.log("checking cell", x, ",", y)
            const cell = newBoard.cells[y][x];
            const isClaimed = cell.lines.every(lineKey => {
                const l = board.lines[lineKey];
                console.log("line", lineKey, "selected?", l.selected)
                return l.selected === true
            });
            if (isClaimed) {
                currentClaimedSquares += 1;
            }
        }
        console.log("!! prev claimed =", currentClaimedSquares)


        newBoard.lines[key].selected = true;

        // next
        let newClaimedSquares = 0;
        for (const {x, y} of newBoard.lines[key].cells) {
            console.log("checking cell x:", x, ", y:", y)
            const cell = newBoard.cells[y][x];
            const isClaimed = cell.lines.every(lineKey => {
                const l = board.lines[lineKey];
                console.log("line", lineKey, "selected?", l.selected)
                return l.selected === true
            });         
            if (isClaimed) {
                cell.claim = turn;
                newClaimedSquares += 1;
            }
        }
        console.log("new claimed =", newClaimedSquares)

        setBoard(newBoard)
        if (newClaimedSquares === currentClaimedSquares) {
            console.log("switching turn")
            setTurn(t => t === "p1" ? "p2" : "p1")
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

    const linesJsx = Object.entries(board.lines).map(([key, line]) => {
        const { x, y, horiOrVert } = line.key;
        return <Line key={key} k={key} x={x} y={y} horiOrVert={horiOrVert} onClick={clickLine} selected={line.selected} />
    })

    return <>
        <p>{turn}</p>
        {cellsJsx}
        {linesJsx}
    </>
}

function Line({ x, y, k, selected, horiOrVert, onClick }: any) {
    let style: React.CSSProperties;
    if (horiOrVert === "h") {
        style = {
            top: `${(y * CELL_VISUAL_SIZE) - LINE_VISUAL_RADIUS}px`,
            left: `${(x * CELL_VISUAL_SIZE) - LINE_VISUAL_RADIUS}px`,
            width: `${CELL_VISUAL_SIZE + (LINE_VISUAL_RADIUS * 2)}px`,
            height: `${(LINE_VISUAL_RADIUS * 2)}px`,
        }
    }
    else {
        style = {
            top: `${(y * CELL_VISUAL_SIZE) - LINE_VISUAL_RADIUS}px`,
            left: `${(x * CELL_VISUAL_SIZE) - LINE_VISUAL_RADIUS}px`,
            width: `${(LINE_VISUAL_RADIUS * 2)}px`,
            height: `${CELL_VISUAL_SIZE + (LINE_VISUAL_RADIUS * 2)}px`,
        }
    };
    const clazz = selected ? "line-selected" : ""
    return <div className={"line " + clazz}
        data-key={k}
        style={style}
        onClick={onClick}
    ></div>
}

function unpack<T>(arr: T[][]) {
    // assume outer is rows, inner is cols
    const height = arr.length
    const width = arr[0].length
    const flattened = []
    for (let rowi = 0; rowi < height; rowi++) {
        for (let coli = 0; coli < width; coli++) {
            flattened.push({ x: coli, y: rowi, val: arr[rowi][coli] })
        }
    }
    return flattened;
}

