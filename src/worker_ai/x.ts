import { Board, Cell, CellPos, _selectLineOnBoard, _unselectLineOnBoard, getScores, lineKey } from "../main/game";
import { shuffle, unpack } from "../main/util/simple";
import { KeyedMessageEvent } from "../main/util/usePromiseWorker";

type Move = {
    points: number,
    lineKeys: string[]
}

let selectionQueue: string[] = [];

self.onmessage = (ev: KeyedMessageEvent) => {
    // validate message, we expect a baord in `message` (lines prop is proof enough) and a key
    // I have no idea why, but it seems that react devtools is triggering this event?
    // so we also validate "type safe" stuff
    const v = ev.data as any;
    if (v?.message?.lines === undefined || v?.key === undefined) {
        return;
    }

    logcxt = { ...logcxt, movenum: logcxt.movenum + 1, iternum: 0, player: "ai" }

    const board = ev.data?.message as Board;
    const key = ev.data?.key
    if (selectionQueue.length === 0) {
        selectionQueue = getBestMove(board);
        log("new selection queue =", JSON.stringify(selectionQueue))
    }
    else {
        log("selection queue =", JSON.stringify(selectionQueue))
    }

    const lineKey = selectionQueue[0]
    selectionQueue = selectionQueue.slice(1)
    postMessage({ key, message: lineKey })
}

function getBestMove(board: Board): string[] {
    const avaliblePoints = unpack(board.cells)
        .filter(c => c.val.claim === null)
        .length
    const { p1: currentOpponentPoints, p2: currentOwnPoints } = getScores(board);

    const possibleMoves = getHeuristicBoardEvaluation(board)

    const _possibleMovesDisplay = possibleMoves.map(move => {
        const lineKeys = move.lineKeys.map(lk => `${lk} (${getLineType(board, lk)})`);
        return { ...move, lineKeys }
    })


    log("possible moves:", JSON.stringify(_possibleMovesDisplay, null, 2))

    let bestMove: any = null;
    for (const { lineKeys, points } of possibleMoves) {
        logcxt = { ...logcxt, iternum: logcxt.iternum + 1, player: "you"}
        if (lineKeys.length === 0) {
            err("this should not happen")
            continue;
        }

        const remainingPoints = avaliblePoints - points;
        if (points >= avaliblePoints || currentOwnPoints + points > currentOpponentPoints + remainingPoints) {
            // if we do this move we will either have ended the match, or will have gotten more total points
            // than the player. As possibleMoves is sorted from highest points to lowest, this should return
            // as early as possible
            return lineKeys;
        }
        // make the move on the board- this should be reverted later
        for (const lk of lineKeys) {
            // I'm not actully sure it matters if it's p1 or p2 here, as
            // we don't care about the score
            _selectLineOnBoard(board, lk, "p2")
        }

        // evaluate board state for opponent, get max points they can get
        log("getting possible moves for opponent if AI does", JSON.stringify(lineKeys))
        const predictedOpponentMoves = getSimpleBoardEvaluation(board);
        const predictedOpponentMove = predictedOpponentMoves?.[0];

        // calc score based on how many points we think opponent will get
        let opponentPoints;
        if (predictedOpponentMove?.points !== undefined) {
            opponentPoints = predictedOpponentMove?.points
        }
        else {
            console.assert(getScores(board).winner !== null, "assume no points as game is won by ai")
            return lineKeys; // lineKeys is not empty due to guard
        }

        // revert board back to original state 
        for (const lk of lineKeys) {
            _unselectLineOnBoard(board, lk)
        }

        const score = points - opponentPoints;
        log("outcome", { points, opponentPoints, predictedOpponentMove })
        if (!bestMove || score > bestMove.score) {
            bestMove = { score, lineKeys }
            log("**\nbest move changed to", bestMove, "\n**")
        }
    }
    logcxt = { ...logcxt, player: "ai"}
    log("best move", bestMove)

    return bestMove.lineKeys ?? [];
}

function getHeuristicBoardEvaluation(board: Board) {
    const tunnels = unpack(board.cells)
        .flatMap(cellPos => {
            const res = getTunnelLineKeys(board, cellPos)
            return res === null ? [] : [res.keys]
        })
        .filter(lks => lks.length > 2)
    log('known tunnels:', tunnels)

    const boardEvaluation = getSimpleBoardEvaluation(board);
    log("size of board evaluation", boardEvaluation.length)
    const r = boardEvaluation.filter(move => {
        return isMoveMakingMostOfTunnels(move, tunnels)
    })
    log("final size of board eval:", r.length, `(${r.length - boardEvaluation.length})`)
    return r;
}

function getSimpleBoardEvaluation(board: Board) {
    const avalibleLineKeys = Object.entries(board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0]);

    shuffle(avalibleLineKeys);

    const completeMoves: Record<string, Move> = {};
    let incompleteMoves: Move[] = []

    // first iteration
    for (const lk of avalibleLineKeys) {
        const points = simpleEvaluateMove(board, lk)
        // sort evaluated moves into buckets of moves that score points, and moves that don't
        const move = { points, lineKeys: [lk] }
        if (points <= 0 || avalibleLineKeys.length === 1) {
            completeMoves[moveKey(move.lineKeys)] = move;
        }
        else {
            incompleteMoves.push(move);
        }
    }

    // remaining iterations
    let limit = 50;
    while (incompleteMoves.length > 0 && limit > 0) {
        limit -= 1;
        const furtherIncompleteMoves = []
        for (const move of incompleteMoves) {
            // do move sequence
            for (const lk of move.lineKeys) {
                _selectLineOnBoard(board, lk, "p2")
            }
            const remainingLineKeys = avalibleLineKeys
                // only process unselected lines
                .filter(lk => !move.lineKeys.includes(lk))

            for (const lk of remainingLineKeys) {
                const newLineKeys = [...move.lineKeys, lk];
                const newMoveKey: string = moveKey(newLineKeys);
                if (completeMoves[newMoveKey]) {
                    // move has already been done- skip
                    continue;
                }
                const singleMovePoints = simpleEvaluateMove(board, lk)
                const aggregatedMove: Move = {
                    points: move.points + singleMovePoints,
                    lineKeys: newLineKeys
                }

                // sort evaluated moves into buckets of moves that score points, and moves that don't
                if (singleMovePoints <= 0 || aggregatedMove.lineKeys.length >= avalibleLineKeys.length) {
                    completeMoves[newMoveKey] = aggregatedMove;
                }
                else {
                    furtherIncompleteMoves.push(aggregatedMove);
                }
            }

            // revert board back to original state 
            for (const lk of move.lineKeys) {
                _unselectLineOnBoard(board, lk)
            }
        }
        incompleteMoves = furtherIncompleteMoves;
    }

    if (limit <= 0) {
        err("getPossibleMoves limit hit!")
    }

    const choices = Object.values(completeMoves)
        .sort((a, b) => b.points - a.points)
    return choices;
}

function simpleEvaluateMove(board: Board, lineKey: string): number {
    const line = board.lines[lineKey];
    const adjacentCells = line.cells.map(c => board.cells[c.y][c.x])
    if (adjacentCells.length == 1) {
        // 1: simple case, max one point
        const cellType = getCellType(board, adjacentCells[0])
        if (cellType === "free" || cellType === "unsafe") {
            return 0;
        }
        else if (cellType == "goal") {
            return 1;
        }
        else {
            err("celltype should not be 'claimed' here. (line is unclaimed, only 1 adj cell)")
            return -9999;
        }
    }
    else {
        // 2: possibly can get multiple points via tunnel
        const a = getCellType(board, adjacentCells[0])
        const b = getCellType(board, adjacentCells[1])
        if (a === "goal" && b === "goal") {
            // both goal cells
            return 2;
        }
        else if (a === "goal" || b === "goal") {
            // at least one goal cell
            return 1;
        }
        else {
            // no goals
            return 0;
        }
    }
}

function getTunnelLineKeys(board: Board, cellPos: CellPos, lineKeyToConsiderSelected?: string): { keys: string[] } | null {
    const cell = board.cells[cellPos.y][cellPos.x];
    // log("getTunnelLineKeys: ", JSON.stringify({lines: cell.lines, x: cellPos.x, y: cellPos.y, lineKeyToConSiderSelected: lineKeyToConsiderSelected}))

    const unselectedLines = cell.lines
        .map(lk => {
            const { selected, cells } = board.lines[lk]
            return { lineKey: lk, selected, cells }
        })
        .filter(l => {
            if (lineKeyToConsiderSelected !== undefined) {
                return l.lineKey !== lineKeyToConsiderSelected
            }
            return true;
        })
        .filter(l => !l.selected)

    // log("unselectedLines=", unselectedLines)


    if (unselectedLines.length !== 1) {
        return null;
    }

    const unselectedLine = unselectedLines[0];

    const otherCells = unselectedLine.cells
        .filter(p => {
            // log(`cell @ ${JSON.stringify(p)} is not og?`, !(p.x === cellPos.x && p.y === cellPos.y))
            return !(p.x === cellPos.x && p.y == cellPos.y)
        })
    // log("otherCells", otherCells)
    const nextCellPos = otherCells[0]

    if (nextCellPos === undefined) {
        // log(`next cell does not exist (i.e. tunnel leads off board)`)
        return { keys: [unselectedLine.lineKey] };
    }

    const nextKeys = getTunnelLineKeys(board, nextCellPos, unselectedLine.lineKey)?.keys ?? [];
    return { keys: [unselectedLine.lineKey, ...nextKeys] }
}

function isMoveMakingMostOfTunnels(move: Move, knownTunnels: string[][]) {
    if (knownTunnels.length === 0) {
        return true;
    }
    const tunnelRuns: Record<string, { tunnel: string[], len: number }> = {};
    for (let i = 0; i < move.lineKeys.length; i++) {
        const lk = move.lineKeys[i]
        if (i >= move.lineKeys.length - 1) {
            // if lk very last line in the move- this cannot be a part of the run
            // so we now eval tunnel usage
            for (const run of Object.values(tunnelRuns)) {
                const { len, tunnel } = run;
                if (len !== tunnel.length && len !== tunnel.length - 2) {
                    // not making the most!
                    log("run for tunnel", tunnel[0], "is", `${len}/${tunnel.length}`, "long, discarding move", JSON.stringify(move.lineKeys))
                    return false;
                }
            }
        }
        else {
            const tunnel = knownTunnels.find(t => t.find(tt => tt === lk))
            if (tunnel) {
                if (tunnelRuns[tunnel[0]] === undefined) {
                    // create a new tunnel
                    tunnelRuns[tunnel[0]] = { tunnel, len: 1 }
                }
                else {
                    tunnelRuns[tunnel[0]].len += 1;
                }
            }
        }
    }
    return true;
}

/** @return goal, unsafe, free, claimed */
function getCellType(board: Board, cell: Cell): "goal" | "unsafe" | "free" | "claimed" {
    if (cell.claim !== null) {
        return "claimed"
    }
    const numActiveLines = cell.lines.filter(lk => board.lines[lk].selected).length
    if (numActiveLines <= 1) {
        return "free"
    }
    if (numActiveLines == 2) {
        return "unsafe"
    }
    console.assert(numActiveLines == 3, "should be 3 here, 4 lines covered in guard at top of method")
    return "goal"
}

function getLineType(board: Board, lineKey: string): "goal" | "unsafe" | "free" | string {
    const line = board.lines[lineKey];
    const adjacentCells = line.cells.map(c => board.cells[c.y][c.x])
    if (adjacentCells.length == 1) {
        // 1: simple case, max one point
        const cellType = getCellType(board, adjacentCells[0])
        if (cellType === "free" || cellType === "unsafe" || cellType === "goal") {
            return cellType;
        }
        else {
            err("celltype should not be 'claimed' here. (line is unclaimed, only 1 adj cell)")
            return "claimed";
        }
    }
    else {
        // 2: possibly can get multiple points via tunnel
        const a = getCellType(board, adjacentCells[0])
        const b = getCellType(board, adjacentCells[1])
        if (a === "goal" || b === "goal") {
            return "goal";
        }
        else if (a === "unsafe" || b === "unsafe") {
            return "unsafe";
        }
        else {
            return "free";
        }
    }
}

function moveKey(lineKeys: string[]) {
    return [...lineKeys].sort().join(" ")
}


let logcxt = {
    player: "ai",
    movenum: 0,
    iternum: 0,
}

function log(...args: any[]) { l("log", ...args) }

function err(...args: any[]) { l("err", ...args)}

function l(kind: string, ...args: any[]) {
    (console as any)[kind](`mv:${logcxt.movenum} ${logcxt.player} it:${logcxt.iternum}`, ...args)
}

// algo
/*
im gonna have to do lookahead at some point... but for now

board can be evaluated, giving each line a points total.
Also proably the minimum remaining turns
 
if we just seek to minimise the point total for the next turn, that might work well

or maybe

we look at each line, and the 1-2 adjacent cells next to it
0-1 adj line is a "free" cell. Safe to place line here wihtout giving point to other player
2 adjs line is a "unsafe" cell. Placing a line here will give the other player potentail to get a square
3 adjacent lines is a "goal" cell. You will at least get one point for selecting
4 adjacent lines is a "claimed" cell

1. if any cell is "goal" the line is "goal"
2. if any cell is "unsafe", the line is "unsafe"
3. else the line is free
("claimed" cells have no avaible lines)

there is a map of line groups -> the amount of points that will be obtained
on picking one if these groups. The ai should recognise that on picking
the group all lines in that groups are picked. If the total points > 0, the ai
should recognise it can choose that line group without ending it's turn.

to calculate this the following algorithim is used:
if at least one adj cell is a "goal" cell:
    X:
    - add a point
    if the other cell is a "goal" cell
        - add another point
    elif the other cell is a "unsafe" cell
        - add another point
        if you travel "via the tunnel" to the next cell and it is "unsafe"
        add the "tunnel" line to
        GOTO label X
*/