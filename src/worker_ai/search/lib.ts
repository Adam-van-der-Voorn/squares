import { Board, Cell, CellPos, _selectLineOnBoard, _unselectLineOnBoard, getBoardDimensions, getCell, getScores } from "../../main/game";
import { mulberry32, shuffle, unpack } from "../../main/util/simple";

const DEFAULT_SEED = 387429827398;
type Move = {
    points: number,
    lineKeys: string[]
}

type GoalTunnel = {
    sortedLineKeys: string[]
    isFullyClosed: boolean
}

export function getMoveSequence(board: Board, rng?: () => number): string[] {
    rng = rng ?? mulberry32(DEFAULT_SEED);
    
    const res = getBestMoveSequence(board, rng);
    logcxt.movenum += 1;
    return res;
}

function getBestMoveSequence(board: Board, rng: () => number): string[] {
    const avaliblePoints = unpack(board.cells)
        .filter(c => c.val.claim === null)
        .length
    const { p1: currentOpponentPoints, p2: currentOwnPoints } = getScores(board);

    const possibleMoves = getHeuristicBoardEvaluation(board, rng)

    let bestMove: any = null;
    let counter = 0;
    // predict opponent response
    for (const { lineKeys, points } of possibleMoves) {
        logcxt.prefix =`por-${counter}/${possibleMoves.length}`;
        counter++
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
        const predictedOpponentMoves = getHeuristicBoardEvaluation(board, rng);
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
        lxd("outcome: score=", score, "points=", points, "opponentPoints=", opponentPoints)
        if (!bestMove || score > bestMove.score) {
            bestMove = { score, lineKeys }
            lxd("best move changed to", JSON.stringify(bestMove))
        }
    }
    logcxt.prefix = ""
    lx("log", "best move", JSON.stringify(bestMove))

    return bestMove.lineKeys ?? [];
}

function getHeuristicBoardEvaluation(board: Board, rng: () => number) {
    const tunnelLineKeys = getTunnelLineKeys(board);
    lxd('tunnels:', JSON.stringify(tunnelLineKeys, null, 2))

    const allPotentialMoves = Object.entries(board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0]);
    shuffle(allPotentialMoves, rng);
    lxd( 'num potenteial moves:', allPotentialMoves.length)
    // lxd( "potenteial moves:", getMoveList(board, allPotentialMoves, "[all-moves] "))

    // get all the tunnels with at least one closed end ("goal tunnels")
    // this will also very handily get you all the goal lines
    // as they are by defininiton closed tunnel ends
    const goalTunnels: GoalTunnel[] = Object.values(tunnelLineKeys)
        .map(tunnelLineKeys => {
            return {
                lineKeys: tunnelLineKeys,
                ...getTunnelType(board, tunnelLineKeys)
            }
        })
        .filter(tunnel => tunnel.isEndClosed || tunnel.isStartClosed)
        .map(tunnel => {
            // we want to the tunnel to start at it's closed end
            let sortedLineKeys = tunnel.lineKeys;
            if (!tunnel.isStartClosed) {
                sortedLineKeys = [...tunnel.lineKeys].reverse();
            }
            return { sortedLineKeys, isFullyClosed: tunnel.isEndClosed && tunnel.isStartClosed }
        })
    lxd('goal tunnels:', JSON.stringify(goalTunnels))

    // a closed goal tunnel with < 3 lines is a turn ender
    // An open goal tunnel with < 2 lines is a turn ender
    // get a non turn ender tunnel if possible (Tunnel A)
    const tunnelWhichCanBeSelectedAndEndTheTurnIdx = goalTunnels
        .findIndex(tunnel => {
            const tunnelLen = tunnel.sortedLineKeys.length;
            return tunnelLen >= 3 || (!tunnel.isFullyClosed && tunnelLen == 2)
        })

    let finalMoveSeq: string[] = [];
    let tunnelWhichCanBeSelectedAndEndTheTurn;
    if (tunnelWhichCanBeSelectedAndEndTheTurnIdx !== -1) {
        tunnelWhichCanBeSelectedAndEndTheTurn = goalTunnels.splice(tunnelWhichCanBeSelectedAndEndTheTurnIdx, 1)[0]
        finalMoveSeq = getTunnelSemiSelection(tunnelWhichCanBeSelectedAndEndTheTurn)
    }
    lxd("tunnel that can be selected and end the turn", JSON.stringify(tunnelWhichCanBeSelectedAndEndTheTurn))

    // add all closed tunnels except Tunnel A to seqence of moves we will def do
    const alwaysMoves = [
        ...goalTunnels.flatMap(t => t.sortedLineKeys),
        ...finalMoveSeq
    ]

    const alwaysMovesEvaluated: Move = {
        points: simpleEvaluateMoveSeq(board, alwaysMoves),
        lineKeys: alwaysMoves
    }

    lxd("always moves", JSON.stringify(alwaysMoves))

    for (const m of alwaysMoves) {
        _selectLineOnBoard(board, m, "p2")
    }

    // remove lines from this seq from allPotentialMoves, and pass to curation fn
    const remainingMoves = allPotentialMoves.filter(m => !alwaysMoves.includes(m))
    lxd("num moves after always moves are rm'ed", remainingMoves.length)

    if (remainingMoves.length === 0) {
        // always moves are all the remaining moves
        return [alwaysMovesEvaluated]
    }

    const curatedMoves = curateMoves(board, remainingMoves, tunnelLineKeys);
    lxd('num moves after curation:', curatedMoves.length)

    const boardEvaluation = getSimpleBoardEvaluation(board, curatedMoves);
    lxd("num of moves seqs from board evaluation", boardEvaluation.length)

    for (const m of alwaysMoves) {
        _unselectLineOnBoard(board, m)
    }

    return boardEvaluation.map(move => {
        const lineKeys = [...alwaysMoves, ...move.lineKeys]
        const points = alwaysMovesEvaluated.points + move.points;
        return { points, lineKeys}
    });
}

/** 
 * select as many lines as possible in given tunnel, but end with a selection which ends the players turn
 * @return selection as a linekey seq
 */
function getTunnelSemiSelection(tunnel: GoalTunnel): string[] {
    //lxd("semi select tunnel", tunnel)
    const tunnelLen = tunnel.sortedLineKeys.length;
    const isReadyToEndTurn = tunnel.isFullyClosed
        ? (i: number) => i + 3 >= tunnelLen
        : (i: number) => i + 2 >= tunnelLen

    const selections = []
    for (let i = 0; i < tunnelLen; i ++) {
        if (isReadyToEndTurn(i)) {
            // the correct way to follow up from this semi selection is to either: 
            // - fully select the tunnel (leaving you with a mandatory extra selection)
            // - select i + 1 (getting the optimal amount of points from the tunnel while still ending your turn)
            // currently this knowedge is not used, but in theory via brute force we will come to the same conclusion
            // but it is still on the cards for future optimisations
            //lxd("semi select tunnel end:", i)
            return selections;
        }
        else {
            //lxd("semi select tunnel:", i, tunnel.sortedLineKeys[i])
            selections.push(tunnel.sortedLineKeys[i])
        }
    }
    return selections;
}

function curateMoves(board: Board, avalibleMoves: string[], tunnels: Record<string, string[]>): string[] {
    const moveMap: Record<string, string> = {};
    for (const lineKey of avalibleMoves) {
        const selectionKey = getSelectionKey(board, lineKey, tunnels);
        if (moveMap[selectionKey] === undefined) {
            //lxd("key for move", lineKey, "=", selectionKey, "(new)")
            moveMap[selectionKey] = lineKey;
        }
        else {
            //lxd("key for move", lineKey, "=", selectionKey, "(existing)")
        }
    }
    return Object.values(moveMap);
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
            // either the move got no points, or it's the only avalible move
            completeMoveSeqs[moveKey(moveSeq.lineKeys)] = moveSeq;
        }
        else {
            incompleteMoveSeqs.push(moveSeq);
        }
    }

    // remaining iterations
    let softLimit = 50;
    while (incompleteMoveSeqs.length > 0) {
        softLimit -= 1;
        const furtherIncompleteMoveSeqs = []
        for (const moveSeq of incompleteMoveSeqs) {
            // do move sequence
            for (const lk of moveSeq.lineKeys) {
                _selectLineOnBoard(board, lk, "p2")
            }
            // only process unselected lines
            const remainingMoves = moves.filter(lk => !moveSeq.lineKeys.includes(lk))
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
                    // latest move in seq has scored 0 points, or move has used up all avalible moves
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

    if (softLimit <= 0) {
        lx("error", "getPossibleMoves limit hit!")
    }

    const choices = Object.values(completeMoveSeqs)
        .sort((a, b) => b.points - a.points)
    return choices;
}

function simpleEvaluateMoveSeq(board: Board, moveSeq: string[]): number {
    let total = 0;
    for (const lineKey of moveSeq) {
        const res = simpleEvaluateMove(board, lineKey)
        total += res;
        _selectLineOnBoard(board, lineKey, "p2")
    }
    for (const lineKey of moveSeq) {
        _unselectLineOnBoard(board, lineKey)
    }
    return total;
}

function simpleEvaluateMove(board: Board, lineKey: string): number {
    const line = board.lines[lineKey];
    const adjacentCells = line.cells.map(c => board.cells[c.y][c.x])
    lx("assert", adjacentCells.length > 0)
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
        // 2: possibly can get multiple points
        lx("assert", adjacentCells.length === 2)
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
        const lineKey = getSharedLine(board, cellPos, adjCellPos)
        if (lineKey !== null) {
            return [lineKey];
        }
    }
    return [];
}

function getSharedLine(board: Board, cellPosA: CellPos, cellPosB: CellPos): string | null {
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
        if (r.x === 0 && r.y === 1) {
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

    return ret()
}

/**
 * get all the linekeys in a tunnel, starting from the line inbetween prevcellpos and nextcellpos
*/
function getTunnelLineKeysForCells(board: Board, prevCellPos: CellPos, nextCellPos: CellPos): string[] {
    const nextCell = getCell(board, nextCellPos);

    const sharedLineKey = getSharedLine(board, prevCellPos, nextCellPos);
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
        // lxd(`unselected line ${l.lineKey}`)
        const prevCellLines = getLinesForCellPos(board, prevCellPos)
        // lxd(`prevCellLines  ${prevCellLines.join(" ")}`)
        if (!prevCellLines.includes(l.lineKey)) {
            // lxd(`include  ${l.lineKey}!`)
            nextSharedLines.push(l)
        }
    }
    const nextSharedLine = nextSharedLines[0]

    // lxd({ nextSharedLines, prevCellPos, nextCellPos, sharedLineKey, nextCell, unselectedLines, sharedLineIsSelected })

    const nextNextCellPos = nextSharedLine.cells
        // filter out self
        .filter(p => p.x !== nextCellPos.x || p.y !== nextCellPos.y)
    [0]

    if (nextNextCellPos === undefined) {
        // next next cell is off the board
        return [sharedLineKey, nextSharedLine.lineKey]
    }

    return [sharedLineKey, ...getTunnelLineKeysForCells(board, nextCellPos, nextNextCellPos)]
}

/**
 * 
 */
function isTunnelEntrance(board: Board, startingCellPos: CellPos, nextCellPos: CellPos): boolean {
    const nextCell = getCell(board, nextCellPos)
    if (nextCell !== undefined && getCellType(board, nextCell) === "unsafe") {
        const sharedLineKey = getSharedLine(board, startingCellPos, nextCellPos);
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

/**
 * get all "tunnels".
 * what is a tunnel? A sequence of lineKeys that represent all the "joining"
 * lines of a adjaecent sequence of unsafe cells. This includes the end lines.
 * @return 
 */
function getTunnelLineKeys(board: Board): Record<string, string[]> {
    const { cols, rows } = getBoardDimensions(board);
    const tunnels: Record<string, string[]> = {}
    for (let y = -1; y < rows + 1; y++) {
        for (let x = -1; x < cols + 1; x++) {
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
                    const lineKeys = getTunnelLineKeysForCells(board, cellPos, nextPos);
                    // lxd("tunnel entrance:", cellPos.x, cellPos.y, "->", nextPos.x, nextPos.y, "\nlineKeys:", JSON.stringify(lineKeys))
                    const key = getTunnelKey(board, lineKeys[0], lineKeys[lineKeys.length - 1]);
                    tunnels[key] = lineKeys;
                }
            }
        }
    }
    return tunnels;
}

function getTunnelType(board: Board, lineKeys: string[]) {
    const start = lineKeys[0]
    const end = lineKeys[lineKeys.length - 1]
    const startLineType = getLineType(board, start);
    const endLineType = getLineType(board, end);
    return {
        isStartClosed: startLineType === "goal",
        isEndClosed: endLineType === "goal"
    }
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
    const adjacentCells = line.cells.map(cellPos => getCell(board, cellPos)!)
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

    const isLineTypeUnsafe = (lk: string) => getLineType(board, lk) === "unsafe";
    const isLineOnBoardEdge = (lk: string) => board.lines[lk].cells.length === 1;
    const locationInTunnel = lineKeys.findIndex(lk => lk === lineKey);
    // lxd("getSelectionKey:", `stats for ${lineKey}:`, {
    //     locationInTunnel,
    //     isLineOnBoardEdge: isLineOnBoardEdge(lineKey),
    //     isLineTypeUnsafe: isLineTypeUnsafe(lineKey)
    // })
    if (locationInTunnel === 0 && (isLineOnBoardEdge(lineKey) || !isLineTypeUnsafe(lineKey))) {
        return `${tunnelKey}-start`
    }
    if (locationInTunnel === lineKeys.length - 1 && (isLineOnBoardEdge(lineKey) || !isLineTypeUnsafe(lineKey))) {
        return `${tunnelKey}-end`
    }
    return `${tunnelKey}-mid`
}

function getTunnelKey(board: Board, startLk: string, endLk: string) {
    const startLine = board.lines[startLk];
    const endLine = board.lines[endLk]
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
    movenum: 0,
    prefix: "",
}

function lx(kind: string, ...args: any[]) {
    const prefix = logcxt.prefix !== ""
        ? ` [${logcxt.prefix}]`
        : "";
    (console as any)[kind](`mv:${logcxt.movenum}${prefix}`, ...args)
}

function lxd(...args: any[]) {
    if(process.env.NODE_ENV === "development") {
        lx("debug", ...args)
    }
}