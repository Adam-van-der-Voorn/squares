import { Board, Cell, CellPos, _selectLineOnBoard, _unselectLineOnBoard, getBoardDimensions, getCell, lineKey } from "../../main/game";
import { shuffle } from "../../main/util/simple";

const RNG_SEED = 4398798765;

type Move = {
    points: number,
    lineKeys: string[]
}

type Tunnel = {
    lineKeys: string[]
    isStartClosed: boolean
    isEndClosed: boolean
}

type GoalTunnel = {
    sortedLineKeys: string[]
    isFullyClosed: boolean
}


export function getBestMove(board: Board): string[] {
    // algo:
    // if no tunnels are avalible then pick random free line
    // if a closed tunnel + free line is avalible, close and select
    // if there are no closed tunnels and no free lines, select the middle of the shortest tunnel
    // if a closed tunnel + no free line is avalible:
    //// we need to decide in between fully selecting and semi selecting the tunnel
    //// e.g. half open tunnels of sizes 2, 2, 3, 4, 6, 9
    //// calc final score X from semi-selecting every tunnel
    //// -2, -2, -1, 0, +2, +7 = 9 - 5 = 4
    //// X = current score + 4
    //// if we do this the game will end
    //// so if X > opponent score, we can guarentee a win
    //// but if X < opponent score, we will def lose
    //// so only semi select if X > opponent score

    const allTunnels = getTunnelLineKeys(board);

    const allPotentialMoves = Object.entries(board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0]);
    shuffle(allPotentialMoves, RNG_SEED);

    const goalTunnels = getGoalTunnels(board, Object.values(allTunnels))
    const freeLines = allPotentialMoves.filter(lk => getLineType(board, lk) === "free")

    if (freeLines.length > 0) {
        const moves: string[] = []
        for (const goalTunnel of goalTunnels) {
            moves.push(...goalTunnel.sortedLineKeys)
        }
        moves.push(freeLines[0])
        console.log(`placing ${JSON.stringify(moves)} as there at at least one free line`)
        return moves;
    }
    else if (goalTunnels.length === 0) {
        const sortedTunnels = Object.values(allTunnels);
        sortedTunnels.sort((a, b) => a.length - b.length)
        console.assert(sortedTunnels.length > 0, "if there is no free lines there should be tunnels")
        const shortestTunnel = sortedTunnels[0]
        const middleOfTunnel = Math.floor(shortestTunnel.length / 2)
        console.log(`no free lines or goal tunnels, placing  at middle of shortest tunnel ${shortestTunnel[middleOfTunnel]}`)
        return [shortestTunnel[middleOfTunnel]]
    }
    else {
        // at least one goal tunnel, but no free lines
        // we want to fully select all goal tunnels except the largest one,
        // (for now)

        const semiSelectableTunnelIdx = findTunnelWichCanBeSemiSelected(goalTunnels)
        let semiSelectableTunnel: GoalTunnel | null = null;
        if (semiSelectableTunnelIdx !== -1) {
            // !! remove from goalTunnels
            semiSelectableTunnel = goalTunnels.splice(semiSelectableTunnelIdx, 1)[0]
        }

        const moves: string[] = []
        for (const goalTunnel of goalTunnels) {
            moves.push(...goalTunnel.sortedLineKeys)
        }
        console.log(`at least one goal tunnel, but no free lines. Placing ${JSON.stringify(moves)}`)
        if (semiSelectableTunnel !== null) {
            const semi = getTunnelSemiSelection(semiSelectableTunnel)
            console.log(`also semi-select: Placing ${JSON.stringify(semi)}`)
            moves.push(...semi)
        }
        return moves
    }
}

function findTunnelWichCanBeSemiSelected(goalTunnels: GoalTunnel[]) {
    // a closed goal tunnel with < 3 lines cannot be semi selected 
    // An open goal tunnel with < 2 lines cannot be semi selected 
    return goalTunnels
        .findIndex(tunnel => {
            const tunnelLen = tunnel.sortedLineKeys.length;
            return tunnelLen >= 3 || (!tunnel.isFullyClosed && tunnelLen == 2)
        })
}

function getGoalTunnels(board: Board, tunnels: string[][]): GoalTunnel[] {
    return Object.values(tunnels)
        .map(tunnelLKs => {
            return {
                lineKeys: tunnelLKs,
                ...getTunnelType(board, tunnelLKs)
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
    for (let i = 0; i < tunnelLen; i++) {
        if (isReadyToEndTurn(i)) {
            selections.push(tunnel.sortedLineKeys[i + 1]);
            return selections;
        }
        else {
            selections.push(tunnel.sortedLineKeys[i])
        }
    }
    return selections;
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
    console.assert(adjacentCells.length > 0)
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
            console.error("celltype should not be 'claimed' here. (line is unclaimed, only 1 adj cell)")
            return -9999;
        }
    }
    else {
        // 2: possibly can get multiple points
        console.assert(adjacentCells.length === 2)
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
            console.error("celltype should not be 'claimed' here. (line is unselected, only 1 adj cell)")
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