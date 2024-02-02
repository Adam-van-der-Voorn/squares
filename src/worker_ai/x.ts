import { Board, Cell, CellPos, _selectLineOnBoard, _unselectLineOnBoard, boardDimensions as getBoardDimensions, getCell, getScores, lineKey } from "../main/game";
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
        lx("log", "new selection queue =", JSON.stringify(selectionQueue))
    }
    else {
        lx("log", "selection queue =", JSON.stringify(selectionQueue))
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

    lx("log", "possible moves:", JSON.stringify(_possibleMovesDisplay, null, 2))

    let bestMove: any = null;
    for (const { lineKeys, points } of possibleMoves) {
        logcxt = { ...logcxt, iternum: logcxt.iternum + 1, player: "you" }
        if (lineKeys.length === 0) {
            lx("error", "this should not happen")
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
        lx("log", "getting possible moves for opponent if AI does", JSON.stringify(lineKeys))
        const possibleMoves = Object.entries(board.lines)
            .filter(e => !e[1].selected)
            .map(e => e[0]);
        shuffle(possibleMoves);
        const predictedOpponentMoves = getSimpleBoardEvaluation(board, possibleMoves);
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
        lx("log", "outcome", { points, opponentPoints, predictedOpponentMove })
        if (!bestMove || score > bestMove.score) {
            bestMove = { score, lineKeys }
            lx("log", "**\nbest move changed to", bestMove, "\n**")
        }
    }
    logcxt = { ...logcxt, player: "ai" }
    lx("log", "best move", bestMove)

    return bestMove.lineKeys ?? [];
}

function getHeuristicBoardEvaluation(board: Board) {
    const tunnels = getTunnels(board);
    lx("log", 'tunnels:', tunnels)

    const allPotentialMoves = Object.entries(board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0]);
    shuffle(allPotentialMoves);
    lx("log", 'num potenteial moves:', allPotentialMoves.length)

    const curatedMoves = curateMoves(board, allPotentialMoves, tunnels);
    lx("log", 'num curated moves:', curatedMoves.length, `(${curatedMoves.length - allPotentialMoves.length})`)

    const boardEvaluation = getSimpleBoardEvaluation(board, curatedMoves);
    lx("log", "num of moves after board evaluation", boardEvaluation.length)

    const res = boardEvaluation.filter(move => {
        return isMoveMakingMostOfTunnels(move, Object.values(tunnels))
    })

    lx("log", "num of moves after post-process:", res.length, `(${res.length - boardEvaluation.length})`)
    return res;
}

function curateMoves(board: Board, avalibleMoves: string[], tunnels: Record<string, string[]>): string[] {
    const moveMap: Record<string, string> = {};
    for (const lineKey of avalibleMoves) {
        const selectionKey = getSelectionKey(board, lineKey, tunnels);
        if (moveMap[selectionKey] === undefined) {
            moveMap[selectionKey] = lineKey;
        }
    }
    return Object.values(moveMap);
}

function curatePotentialMoves(board: Board, knownTunnels: Record<string, string[]>): string[] {
    const avalibleLineKeysMap: Record<string, string> = {};
    const allAvalibleLineKeys = Object.entries(board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0]);

    for (const lineKey of allAvalibleLineKeys) {
        const selectionKey = getSelectionKey(board, lineKey, knownTunnels);
        if (avalibleLineKeysMap[selectionKey] === undefined) {
            avalibleLineKeysMap[selectionKey] = lineKey;
        }
    }
    return Object.values(avalibleLineKeysMap);
}

function getSimpleBoardEvaluation(board: Board, moves: string[]) {
    const completeMoveSeqs: Record<string, Move> = {};
    let incompleteMoveSeqs: Move[] = []

    // first iteration
    for (const lineKey of moves) {
        const points = simpleEvaluateMove(board, lineKey)
        // sort evaluated moves into buckets of moves that score points, and moves that don't
        const moveSeq = { points, lineKeys: [lineKey] }
        if (points <= 0 || moves.length === 1) {
            completeMoveSeqs[moveKey(moveSeq.lineKeys)] = moveSeq;
        }
        else {
            incompleteMoveSeqs.push(moveSeq);
        }
    }

    // remaining iterations
    let limit = 50;
    while (incompleteMoveSeqs.length > 0 && limit > 0) {
        limit -= 1;
        const furtherIncompleteMoveSeqs = []
        for (const moveSeq of incompleteMoveSeqs) {
            // do move sequence
            for (const lk of moveSeq.lineKeys) {
                _selectLineOnBoard(board, lk, "p2")
            }
            const remainingMoves = moves
                // only process unselected lines
                .filter(lk => !moveSeq.lineKeys.includes(lk))

            for (const lk of remainingMoves) {
                const newLineKeys = [...moveSeq.lineKeys, lk];
                const newMoveKey: string = moveKey(newLineKeys);
                if (completeMoveSeqs[newMoveKey]) {
                    // move has already been done- skip
                    continue;
                }
                const singleMovePoints = simpleEvaluateMove(board, lk)
                const aggregatedMove: Move = {
                    points: moveSeq.points + singleMovePoints,
                    lineKeys: newLineKeys
                }

                // sort evaluated moves into buckets of moves that score points, and moves that don't
                if (singleMovePoints <= 0 || aggregatedMove.lineKeys.length >= moves.length) {
                    completeMoveSeqs[newMoveKey] = aggregatedMove;
                }
                else {
                    furtherIncompleteMoveSeqs.push(aggregatedMove);
                }
            }

            // revert board back to original state 
            for (const lk of moveSeq.lineKeys) {
                _unselectLineOnBoard(board, lk)
            }
        }
        incompleteMoveSeqs = furtherIncompleteMoveSeqs;
    }

    if (limit <= 0) {
        lx("error", "getPossibleMoves limit hit!")
    }

    const choices = Object.values(completeMoveSeqs)
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
            lx("error", "celltype should not be 'claimed' here. (line is unclaimed, only 1 adj cell)")
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

function getClosedTunnelLineKeys(board: Board, cellPos: CellPos, lineKeyToConsiderSelected?: string): { keys: string[] } | null {
    const cell = board.cells[cellPos.y][cellPos.x];
    // lx("log", "getTunnelLineKeys: ", JSON.stringify({lines: cell.lines, x: cellPos.x, y: cellPos.y, lineKeyToConSiderSelected: lineKeyToConsiderSelected}))

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

    // lx("log", "unselectedLines=", unselectedLines)


    if (unselectedLines.length !== 1) {
        return null;
    }

    const unselectedLine = unselectedLines[0];

    const otherCells = unselectedLine.cells
        .filter(p => {
            // lx("log", `cell @ ${JSON.stringify(p)} is not og?`, !(p.x === cellPos.x && p.y === cellPos.y))
            return !(p.x === cellPos.x && p.y == cellPos.y)
        })
    // lx("log", "otherCells", otherCells)
    const nextCellPos = otherCells[0]

    if (nextCellPos === undefined) {
        // lx("log", `next cell does not exist (i.e. tunnel leads off board)`)
        return { keys: [unselectedLine.lineKey] };
    }

    const nextKeys = getClosedTunnelLineKeys(board, nextCellPos, unselectedLine.lineKey)?.keys ?? [];
    return { keys: [unselectedLine.lineKey, ...nextKeys] }
}

function getLinesForCellPos(board: Board, cellPos: CellPos): string[] {
    const cell = getCell(board, cellPos);
    if (cell !== undefined) {
        return cell.lines;
    }
    const n = { x: cellPos.x, y: cellPos.y - 1 }
    const e = { x: cellPos.x + 1, y: cellPos.y }
    const s = { x: cellPos.x, y: cellPos.y + 1 }
    const w = { x: cellPos.x - 1, y: cellPos.y }
    for (const adjCellPos of [n, s, e, w]) {
        const lineKey = getSharedLine2(board, cellPos, adjCellPos)
        if (lineKey !== null) {
            return [lineKey];
        }
    }
    return [];
}

function getSharedLine2(board: Board, cellPosA: CellPos, cellPosB: CellPos): string | null {
    const cellA = getCell(board, cellPosA);
    const cellB = getCell(board, cellPosB);
    let undefCellPos: CellPos, defCellPos: CellPos, defCell: Cell;
    if (cellA !== undefined || cellB !== undefined) {
        if (cellA === undefined) {
            defCell = cellB as Cell;
            defCellPos = cellPosB;
            undefCellPos = cellPosA;
        }
        else {
            defCell = cellA;
            defCellPos = cellPosA;
            undefCellPos = cellPosB;
        }
    }
    else {
        return null;
    }

    // relative position
    const r = { 
        x: defCellPos.x - undefCellPos.x,
        y: defCellPos.y - undefCellPos.y
    }

    const ret = () => {
        if      (r.x === 0 && r.y === 1) {
            // undef is to the north of def
            return defCell.lines[0]
        }
        else if (r.x === -1 && r.y === 0) {
            // undef is to the east of def
            return defCell.lines[1]
        }
        else if (r.x === 0 && r.y === -1) {
            // undef is to the south of def
            return defCell.lines[2]
        }
        else if (r.x === 1 && r.y === 0) {
            // undef is to the west of def
            return defCell.lines[3]
        }
        else {
            throw new Error("cells are not adjacent")
        }
    }

    console.log("shared line:", { cellPosA, cellPosB, cellA, cellB, r, defCellPos, undefCellPos, result: ret()})


    return ret()
}

function getSharedLine(cellA: Cell, cellB: Cell): string {
    const sharedLines = cellA.lines.filter(lk => {
        return cellB.lines.includes(lk);
    })
    console.assert(sharedLines.length === 1)
    return sharedLines[0];
}

function getTunnelLineKeys(board: Board, prevCellPos: CellPos, nextCellPos: CellPos): string[] {
    const nextCell = getCell(board, nextCellPos);

    const sharedLineKey = getSharedLine2(board, prevCellPos, nextCellPos);
    if (!sharedLineKey) {
        throw "cells must be adjacent"
    }
    const sharedLineIsSelected = board.lines[sharedLineKey].selected;
    if (sharedLineIsSelected) {
        throw "shared line must be unselected"
    }

    if (nextCell === undefined || getCellType(board, nextCell) !== "unsafe") {
        return [sharedLineKey]
    }

    const unselectedLines = nextCell.lines
        .map(lk => {
            const { selected, cells } = board.lines[lk]
            return { lineKey: lk, selected, cells }
        })
        .filter(l => !l.selected)
    console.assert(unselectedLines.length === 2, "unsafe lines should have 2 unselected")
    let nextSharedLines = []
    for (const l of unselectedLines) {
        // lx("log", `unselected line ${l.lineKey}`)
        const prevCellLines = getLinesForCellPos(board, prevCellPos)
        // lx("log", `prevCellLines  ${prevCellLines.join(" ")}`)
        if (!prevCellLines.includes(l.lineKey)) {
            // lx("log", `include  ${l.lineKey}!`)
            nextSharedLines.push(l)
        }
    }
    const nextSharedLine = nextSharedLines[0]

    lx("log", { nextSharedLines, prevCellPos, nextCellPos, sharedLineKey, nextCell, unselectedLines, sharedLineIsSelected })
    
    const nextNextCellPos = nextSharedLine.cells
        // filter out self
        .filter(p => p.x !== nextCellPos.x || p.y !== nextCellPos.y)
        [0]

    if (nextNextCellPos === undefined) {
        // next next cell is off the board
        return [sharedLineKey, nextSharedLine.lineKey]
    }

    return [sharedLineKey, ...getTunnelLineKeys(board, nextCellPos, nextNextCellPos)]
}

function isTunnelEntrance(board: Board, startingCellPos: CellPos, nextCellPos: CellPos): boolean {
    const nextCell = getCell(board, nextCellPos)
    if (nextCell !== undefined && getCellType(board, nextCell) === "unsafe") {
        const sharedLineKey = getSharedLine2(board, startingCellPos, nextCellPos);
        if (!sharedLineKey) {
            return false;
        }
        const sharedLine = board.lines[sharedLineKey];
        if (!sharedLine.selected) {
            return true;
        }
    }
    return false;
}

function getTunnels(board: Board): Record<string, string[]> {
    const { cols, rows } = getBoardDimensions(board);
    const tunnels: Record<string, string[]> = {}
    for (let y = -1; y < rows + 1; y++) {
        for (let x = -1; x < cols +1; x++) {
            const cellPos = { x, y }
            const cell = getCell(board, cellPos);
            const cellType = cell !== undefined
                ? getCellType(board, cell)
                : null;
            if (cellType === "unsafe") {
                // cell is part of a tunnel
                continue;
            }
            const nPos = { x, y: y - 1 };
            const ePos = { x: x + 1, y: y }
            const sPos = { x: x, y: y + 1 }
            const wPos = { x: x - 1, y: y }
            const directions = [nPos, ePos, sPos, wPos];
            for (const nextPos of directions) {
                if (isTunnelEntrance(board, cellPos, nextPos)) {
                    const lineKeys = getTunnelLineKeys(board, cellPos, nextPos);
                    const key = getTunnelKey(board, lineKeys[0], lineKeys[lineKeys.length - 1]);
                    tunnels[key] = lineKeys;
                }
            }
        }
    }
    return tunnels;
}

// function getTunnels(board: Board): Tunnel[] {
//     const tunnels: Tunnel[] = [];
//     for (const { x, y, val: cell } of unpack(board.cells)) {
//         if (!isCellTunnelEnd(board, { x, y })) {
//             continue;
//         }
//         // we are trying to find the an end cell
//         // things that indicate ane end cell are
//         // - unsafe cell where one end is flush with the edge of the board
//         // - unafe cell with at least one adjacent cell that is not unsafe
//         // once an end cell is found, add all unselected lines on the cell to the tunnel
//         // then use getTunnelLineKeys to get remaining linekeys

//         const unselectedLineKeys: string[] = [];
//         const adjacentCellPositions: CellPos[] = [];
//         for (const lk of cell.lines) {
//             const { selected, cells: cellPositions } = board.lines[lk]
//             if (!selected) {
//                 unselectedLineKeys.push(lk)
//                 for (const cellPos of cellPositions) {
//                     if (cellPos.x === x && cellPos.y === y) {
//                         // do not include self
//                         continue;
//                     }
//                     adjacentCellPositions.push(cellPos);
//                 }
//             }
//         }
//         // const adjacentCellPositions = cell.lines
//         //     .map(lk => {
//         //         const { selected, cells } = board.lines[lk]
//         //         return { lineKey: lk, selected, cells }
//         //     })
//         //     .filter(l => !l.selected)
//         //     .flatMap(l => l.cells)
//         //     // filter out self
//         //     .filter(pos => pos.x !== x || pos.y !== y)


//         let nextCellPos: CellPos | null = null;
//         if (adjacentCellPositions.length === 1) {
//             // goal cell, or unsafe cell where one open end leads off board edge
//             // const adjCell = getCell(board, adjacentCellPositions[0])
//             // const sharedLine = getSharedLine(adjCell, cell)
//             // const bruh =
//             // const lineKeys = getTunnelLineKeys(board, { x, y },)
//             nextCellPos = adjacentCellPositions[0]
//         }
//         else if (adjacentCellPositions.length === 2) {
//             // this cell is a tunnel end, so we need to find it
//             const unsafeAdjCellPositions = adjacentCellPositions
//                 .filter(pos => {
//                     const cell = getCell(board, pos)!;
//                     console.assert(cell !== undefined, "pos should be valid")
//                     if (getCellType(board, cell) === "unsafe")
//                 });
//             if (unsafeAdjCellPositions.length === 0) {
//                 // special case- single length tunnel
//                 tunnels.push({ id: "TODO", lineKeys: ["TODO - the line keys inbetween the 3 adj cells"] })
//             }
//             else if (unsafeAdjCellPositions.length === 1) {
//                 // tunnel end
//                 nextCellPos = unsafeAdjCellPositions[0];
//             }
//             else {
//                 lx("error", "invalid state, a tunnel end cannot have > 1 adj unsafe cell")
//             }
//         }
//         // const [lineKey, line] = remainingLines.pop()!
//         // // const cellTypes = line.cells.map(pos => getCellType(board, board.cells[pos.y][pos.x]))
//         // const lineType = getLineType(board, lineKey);
//         // if (lineType === "goal" || lineType === "unsafe") {
//         //     // [3][2][1][x][ ][ ][ ]
//         //     const left = getTunnelLineKeys(board, line.cells[0], lineKey)?.keys ?? []
//         //     // [ ][ ][ ][x][1][2][3]
//         //     const right = line.cells[1]
//         //         ? getTunnelLineKeys(board, line.cells[1], lineKey)?.keys ?? []
//         //         : [];
//         //     for (const lk of [...left, ...right]) {
//         //         const idx = remainingLines.findIndex(([key, _]) => key === lk)
//         //         remainingLines.splice(idx, 1)
//         //     }

//         //     // so the keys are in order
//         //     // [l1][l2][l3][lineKey][r1][r2][r3]
//         //     left.reverse() 
//         //     const allKeys = [...left, lineKey, ...right];
//         //     // we al
//         // }
//     }
//     return tunnels;
// }

// function isCellTunnelEnd(board: Board, cellPos: CellPos): boolean {
//     const cell = getCell(board, cellPos);
//     const cellType = getCellType(board, cell);
//     const adjacentCellPositions = cell.lines
//         .map(lk => {
//             const { selected, cells } = board.lines[lk]
//             return { lineKey: lk, selected, cells }
//         })
//         .filter(l => !l.selected)
//         .flatMap(l => l.cells)
//         // filter out self
//         .filter(p => p.x !== cellPos.x || p.y !== cellPos.y)

//     // we are trying to find the an end cell
//     // things that indicate an end cell are
//     // - a goal cell
//     // - unsafe cell where one end is flush with the edge of the board
//     // - unafe cell with at least one adjacent cell that is not unsafe or gaol
//     // once an end cell is found, add all unselected lines on the cell to the tunnel
//     // then use getTunnelLineKeys to get remaining linekeys
//     if (cellType === "goal") {
//         return true
//     }
//     if (cellType === "unsafe") {
//         let nextCell: CellPos | null = null;
//         if (adjacentCellPositions.length === 1) {
//             // unsafe cell where one open end leads off board edge
//             return true
//         }
//         else if (adjacentCellPositions.length === 2) {
//             const freeAdjCellPositions = adjacentCellPositions
//                 .filter(pos => {
//                     const ct = getCellType(board, getCell(board, pos));
//                     return ct === "free"
//                 });
//             if (freeAdjCellPositions.length >= 1) {
//                 console.assert(freeAdjCellPositions.length <= 2)
//                 // 2 is special case- single length tunnel
//                 return true
//             }
//         }
//         else {
//             lx("error", "invalid state, unsafe cell must have 1 or 2 adj cells")
//         }
//     }
//     return false;
// }

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
                    lx("log", "run for tunnel", tunnel[0], "is", `${len}/${tunnel.length}`, "long, discarding move", JSON.stringify(move.lineKeys))
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

function getLineType(board: Board, lineKey: string): "goal" | "unsafe" | "free" | "selected" {
    const line = board.lines[lineKey];
    if (line.selected) {
        return "selected";
    }
    const adjacentCells = line.cells.map(c => board.cells[c.y][c.x])
    if (adjacentCells.length == 1) {
        // 1: simple case, max one point
        const cellType = getCellType(board, adjacentCells[0])
        if (cellType === "free" || cellType === "unsafe" || cellType === "goal") {
            return cellType;
        }
        else {
            lx("error", "celltype should not be 'claimed' here. (line is unselected, only 1 adj cell)")
            return "selected";
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

function getSelectionKey(board: Board, lineKey: string, knownTunnels: Record<string, string[]>) {
    const ownership = Object.entries(knownTunnels).find(t => t[1].find(lk => lk === lineKey))
    if (!ownership) {
        return lineKey;
    }
    const [tunnelKey, lineKeys] = ownership;
    if (lineKeys.length === 1) {
        return `${tunnelKey}`
    }
    const locationInTunnel = lineKeys.findIndex(lk => lk === lineKey);
    const leftEndClosed = getLineType(board, lineKeys[0]);
    if (!leftEndClosed && locationInTunnel === 0) {
        return `${tunnelKey}-start`
    }
    const rightEndClosed = getLineType(board, lineKeys[lineKeys.length - 1]);
    if (!rightEndClosed && locationInTunnel === lineKeys.length - 1) {
        return `${tunnelKey}-end`
    }
    return `${tunnelKey}-mid`
}

function getTunnelKey(board: Board, startLk: string, endLk: string) {
    const startLine = board.lines[startLk];
    const endLine = board.lines[endLk]
    console.log({startLk, endLk, startLine, endLine})
    // we just need to ensure some kind of order
    // h goes first over v
    if (startLine.key.horiOrVert === "h" && endLine.key.horiOrVert === "v") {
        return `${startLk}>${endLk}`
    }
    if (startLine.key.horiOrVert === "v" && endLine.key.horiOrVert === "h") {
        return `${endLk}>${startLk}`
    }
    // lesser x pos goes first
    if (startLine.key.x < endLine.key.x) {
        return `${startLk}>${endLk}`
    }
    if (startLine.key.x === endLine.key.x) {
        // if x pos is equal, y pos is tiebreaker
        if (startLine.key.y < endLine.key.y) {
            return `${startLk}>${endLk}`
        }
        if (startLine.key.y === endLine.key.y) {
            console.assert(startLk === endLk, "if this branch is reached, they should be equal")
            // does not matter what we pick really
            return `${startLk}>${endLk}`
        }
    }
    return `${endLk}>${startLk}`
}


let logcxt = {
    player: "ai",
    movenum: 0,
    iternum: 0,
}

function lx(kind: string, ...args: any[]) {
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