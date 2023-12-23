import React from "react";
import { useState } from "react";
import { newBoard, Board, selectLine, getWinner } from "./game";
import { unpack } from "./util";

const CELL_VISUAL_SIZE = 40;
const LINE_VISUAL_RADIUS = 4;

export function App() {
    const [winState, setWinState] = useState<any>(null);

    let message;
    if (winState == null) {
        message = ""
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
    
    return <>
        <Game onWin={setWinState} />
        { message }
    </>
}

function Game({ onWin }: any) {
    const [board, setBoard] = useState(() => newBoard(1, 2))
    const [turn, setTurn] = useState<("p1" | "p2")>("p1");

    const clickLine = (ev: any) => {
        const el: HTMLDivElement = ev.target
        const key = el.getAttribute("data-key")!;
        if (board.lines[key].selected) {
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