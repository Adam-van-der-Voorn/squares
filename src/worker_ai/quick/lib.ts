import { Board, Cell, CellPos, _selectLineOnBoard, _unselectLineOnBoard, getCell, getScores } from "../../main/game";
import { mulberry32, shuffle } from "../../main/util/simple";

const DEFAULT_SEED = 4398798765;
type Tunnel = {
    lineKeys: string[]
    isStartClosed: boolean
    isEndClosed: boolean
}

type GoalTunnel = {
    lineKeys: string[]
    isFullyClosed: boolean
}

/**
 algo:
 if no tunnels are avalible then pick random free line
 if a closed tunnel + free line is avalible, close and select
 if there are no closed tunnels and no free lines, select the middle of the shortest tunnel
 if a closed tunnel + no free line is avalible:
    we need to decide in between fully selecting and semi selecting the tunnel
    e.g. half open tunnels of sizes 2, 2, 3, 4, 6, 9
    calc final score X from semi-selecting every tunnel
    -2, -2, -1, 0, +2, +7 = 9 - 5 = 4
    X = current score + 4
    if we do this the game will end
    so if X > opponent score, we can guarentee a win
    but if X < opponent score, we will def lose
    so only semi select if X > opponent score
 */
export function getMoveSequence(board: Board, rng?: () => number): string[] {
    rng = rng ?? mulberry32(DEFAULT_SEED)

    const anyUnselectedLine = Object.values(board.lines)
        .find(l => l.selected === false)
    if (!anyUnselectedLine) {
        console.log("no lines to select")
        return []
    }

    const allTunnelLKs = getTunnelMap(board);
    logTunnelMap(allTunnelLKs)
    const allTunnels = classifyTunnels(board, Object.values(allTunnelLKs))

    const allPotentialMoves = Object.entries(board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0]);
    shuffle(allPotentialMoves, rng);

    const goalTunnels = filterForGoalTunnels(allTunnels);
    const openTunnels = filterForOpenTunnels(allTunnels);

    const freeLines = allPotentialMoves.filter(lk => getLineType(board, lk) === "free")

    if (freeLines.length > 0) {
        const moves: string[] = []
        for (const goalTunnel of goalTunnels) {
            moves.push(...goalTunnel.lineKeys)
        }
        moves.push(freeLines[0])
        console.log(`placing ${JSON.stringify(moves)} as there at at least one free line`)
        return moves;
    }
    else if (goalTunnels.length === 0) {
        console.assert(openTunnels.length > 0, "if there is no free lines there should be tunnels")
        const tunnelsSortedByLength = Object.values(openTunnels);
        tunnelsSortedByLength.sort((a, b) => a.lineKeys.length - b.lineKeys.length)
        const shortestTunnel = tunnelsSortedByLength[0]
        const middleOfTunnel = Math.floor(shortestTunnel.lineKeys.length / 2)
        console.log(`no free lines or goal tunnels, placing  at middle of shortest tunnel ${shortestTunnel.lineKeys[middleOfTunnel]}`)
        return [shortestTunnel.lineKeys[middleOfTunnel]]
    }
    else {
        // at least one goal tunnel, but no free lines
        const semiSelectableTunnelIdx = findTunnelWhichCanBeSemiSelected(goalTunnels)
        const moves: string[] = []
        console.log(`at least one goal tunnel, but no free lines.`)
        if (semiSelectableTunnelIdx === -1) {
            console.log(`no avalible tunnels to semi-select`)
            for (const goalTunnel of goalTunnels) {
                moves.push(...goalTunnel.lineKeys)
            }
        }
        else {
            const semiSelectableTunnel = goalTunnels[semiSelectableTunnelIdx]
            const semiSelection = getTunnelSemiSelection(semiSelectableTunnel)
            const scores = getScores(board)
            const sss = shouldSemiSelect(board, scores, semiSelectableTunnel, openTunnels);
            console.log(`semi-selection avalible: ${JSON.stringify(semiSelection)}`)
            const movelist = [...goalTunnels].map(t => t.lineKeys);
            if (sss) {
                // remove the tunnel to semi-select and put it on the end
                movelist.splice(semiSelectableTunnelIdx, 1)
                movelist.push(semiSelection);
            }
            console.log("movelist", movelist)
            for (const lks of movelist) {
                moves.push(...lks)
            }
        }
        console.log(`Placing ${JSON.stringify(moves)}`)
        return moves
    }
}

/**
 * get all "tunnels".
 * what is a tunnel? A sequence of lineKeys that represent all the "joining"
 * lines of a adjacent sequence of unsafe cells. This includes the end lines.
 * @return 
 */
export function getTunnelMap(board: Board): Record<string, string[]> {
    const tunnels: Record<string, string[]> = {};
    const avalibleLines = Object.keys(board.lines);
    console.log("avalible lines", avalibleLines)
    while (avalibleLines.length > 0) {
        const lineKey = avalibleLines.pop()!
        console.log("\n\nenter get tunnel for ", lineKey)
        const res = tryFindTunnelStart(board, lineKey);
        if (res === null) {
            // no tunnel
            continue;
        }
        const { tunnelStart: tunnelEnd, nextCellPos: previousCellPos } = res;
        let tunnel;
        if (previousCellPos === null) {
            // tunnel is length 1
            tunnel = [tunnelEnd]
        }
        else {
            tunnel = getTunnelFromStartingLineKey(board, tunnelEnd, previousCellPos)
        }
        for (const lk of tunnel) {
            const r = avalibleLines.findIndex(l => l === lk)
            if (r !== -1) {
                avalibleLines.splice(r, 1)
            }
        }
        if (tunnel.length > 0) {
            const key = getTunnelKey(board, tunnel[0], tunnel[tunnel.length - 1]);
            tunnels[key] = tunnel;
        }
    }
    return tunnels;
}

function shouldSemiSelect(board: Board, scores: { p1: number, p2: number }, semiSelectableTunnel: GoalTunnel, openTunnels: Tunnel[]): boolean {
    const logPrefix = "shouldSemiSelect:";
    // we need to decide in between fully selecting and semi selecting the last goal tunnel
    // as there are no free lines, when we semi select the goal tunnel the opponent will be forced
    // to close the next open tunnel, leaving us with the same decision
    // so we can calc the final score if we always semi-select to see if we win or not

    // TODO we need to handle open tunnels of size 1-2 differently, as they cannot be semi-selected.

    if (openTunnels.length === 0) {
        return false;
    }

    // we initlaise the points gained as the len of the semi-select candidate minus four,
    // as four points are taken off for the two cells we do not select and therefore give to the opponent
    // TODO we need to function similar (same?) as getPointGainForSemiSelctionOfOpenTunnel
    // to also handle the donut case for this
    let pointsGainedFromSemiSelectingAll = semiSelectableTunnel.lineKeys.length - 4;
    console.log(logPrefix, "inital pointsGainedFromSemiSelecting =", pointsGainedFromSemiSelectingAll)

    const allOpenTunnelsExceptFinal = openTunnels.slice(0, openTunnels.length - 1);
    for (const tunnel of allOpenTunnelsExceptFinal) {
        const pointDiff = getPointGainForSemiSelctionOfOpenTunnel(board, tunnel)
        pointsGainedFromSemiSelectingAll += pointDiff;
        console.log(logPrefix, "pointDiff for", tunnel.lineKeys, "=", pointDiff)
    }
    const finalOpenTunnel = openTunnels[openTunnels.length - 1]
    const finalOpenTunnelPointDiff = finalOpenTunnel.lineKeys.length - 1;
    pointsGainedFromSemiSelectingAll += finalOpenTunnelPointDiff;
    console.log(logPrefix, "pointDiff for final tunnel", finalOpenTunnel.lineKeys, "=", finalOpenTunnelPointDiff)

    const finalScore = scores.p2 + pointsGainedFromSemiSelectingAll;
    console.log(logPrefix, "finalScore =", finalScore, "(scores.p2 + pointsGainedFromSemiSelectingAll), (", scores.p2, "+", pointsGainedFromSemiSelectingAll, ")")
    console.log(logPrefix, "scores.p1 =", scores.p1, "will only semi-select if final score is greater than this")

    if (finalScore > scores.p1) {
        // we can guarentee a W if we semi-select all open tunnels
        return true;
    }
    else if (finalScore === scores.p1) {
        // we can guarentee a tie if we semi-select all open tunnels
        // not sure if worth or not tbh
        // TODO ???
        return false
    }
    else {
        // we can guarentee a L if we semi-select all open tunnels
        return false
    }
}

/**
 * get the relative gain in points if the passed in tunnel is semi-selected by the player,
 * assumeing the opponent finishes the selection (which they have no reason not to)
 */
function getPointGainForSemiSelctionOfOpenTunnel(board: Board, openTunnel: Tunnel) {
    const logTag = "getPointGainForSemiSelctionOfOpenTunnel:"
    if (openTunnel.isEndClosed || openTunnel.isStartClosed) {
        throw "only works with open tunnels"
    }

    const start = openTunnel.lineKeys[0];
    const second = openTunnel.lineKeys.at(1);
    const secondFromEnd = openTunnel.lineKeys.at(openTunnel.lineKeys.length - 2);
    if (second === undefined || secondFromEnd === undefined) {
        console.error(logTag, "TODO not sure this is works for tunnels of len 1 tbh")
        return -2
    }
    const end = openTunnel.lineKeys[openTunnel.lineKeys.length - 1]
    if (end === second) {
        console.error(logTag, "TODO not sure this is works for tunnels of len 2 tbh")
        return -2
    }
    console.log(logTag, { start, end, second, secondFromEnd })

    const entryCell = board.lines[start].cells
        .find(cpos => {
            const cellLines = getCell(board, cpos)!.lines
            // the "entry cell" is the non-tunnel cell at the tunnel entrance, 
            // it will not include the second line in the tunnel
            return !cellLines.includes(second)
        })

    const lastCell = board.lines[end].cells
        .find(cpos => {
            const cellLines = getCell(board, cpos)!.lines
            // the "last cell" is the cell at the end of the tunnel
            // it will include the second to last line in the tunnel
            return cellLines.includes(secondFromEnd)
        })

    if (lastCell === undefined) {
        throw "last cell should exist"
    }

    if (entryCell === lastCell) {
        // open tunnel is a donut, which means when opponent selects a line it will become fully closed
        // points is num linekeys in tunnel minus eight becasue four points are taken off for the
        // four cells we do not select and therefore give to the opponent
        return openTunnel.lineKeys.length - 8
    }
    else {
        // open tunnel is not a donut, which means when opponent selects a line it will become 1-2 half closed tunnels
        // points is num linekeys in tunnel minus four becasue four points are taken off for the
        // two cells we do not select and therefore give to the opponent
        return openTunnel.lineKeys.length - 4
    }
}

function findTunnelWhichCanBeSemiSelected(goalTunnels: GoalTunnel[]) {
    // a closed goal tunnel with < 3 lines cannot be semi selected 
    // An open goal tunnel with < 2 lines cannot be semi selected 
    return goalTunnels
        .findIndex(tunnel => {
            const tunnelLen = tunnel.lineKeys.length;
            return tunnelLen >= 3 || (!tunnel.isFullyClosed && tunnelLen == 2)
        })
}


function classifyTunnels(board: Board, tunnels: string[][]): Tunnel[] {
    return Object.values(tunnels)
        .map(tunnelLKs => {
            return {
                lineKeys: tunnelLKs,
                ...getTunnelType(board, tunnelLKs)
            }
        })
}

function filterForOpenTunnels(tunnels: Tunnel[]): Tunnel[] {
    return tunnels.filter(tunnel => !tunnel.isEndClosed && !tunnel.isStartClosed)
}

function filterForGoalTunnels(tunnels: Tunnel[]): GoalTunnel[] {
    return tunnels
        .filter(tunnel => tunnel.isEndClosed || tunnel.isStartClosed)
        .map(tunnel => {
            // we want the tunnel to start at it's closed end
            let arrangedLineKeys = tunnel.lineKeys;
            if (!tunnel.isStartClosed) {
                arrangedLineKeys = [...tunnel.lineKeys].reverse();
            }
            return { lineKeys: arrangedLineKeys, isFullyClosed: tunnel.isEndClosed && tunnel.isStartClosed }
        })
}

/** 
 * select as many lines as possible in given tunnel, but end with a selection which ends the players turn
 * @return selection as a linekey seq
 */
function getTunnelSemiSelection(tunnel: GoalTunnel): string[] {
    //lxd("semi select tunnel", tunnel)
    const tunnelLen = tunnel.lineKeys.length;
    const isReadyToEndTurn = tunnel.isFullyClosed
        ? (i: number) => i + 3 >= tunnelLen
        : (i: number) => i + 2 >= tunnelLen

    const selections = []
    for (let i = 0; i < tunnelLen; i++) {
        if (isReadyToEndTurn(i)) {
            selections.push(tunnel.lineKeys[i + 1]);
            return selections;
        }
        else {
            selections.push(tunnel.lineKeys[i])
        }
    }
    return selections;
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
function tryFindTunnelStart(board: Board, initialLineKey: string): { tunnelStart: string, nextCellPos: CellPos | null } | null {
    let currentCellPos: CellPos | null = null;
    let currentLineKey = initialLineKey;
    let tunnelStart = null;
    
    if (board.lines[initialLineKey].selected) {
        return null;
    }

    while (true) {
        // as the current line is unselected, if it has any unsafe or goal cells adjacent,
        // it must be part of a tunnel
        const currentLine = board.lines[currentLineKey];
        const validAdjCells = currentLine.cells
            .filter(cpos => {
                const cell = getCell(board, cpos)!
                const type = getCellType(board, cell);
                if (type === "unsafe" || type === "goal") {
                    // goal is required bc of the edge case of closed tunnels with no unsafe cells
                    // specifically:
                    //  _        _ _
                    // |_  and  |_ _|
                    return true;
                }
                return false;
            })

        if (validAdjCells.length > 0) {
            // current line has at least one valid adj cell, so it is part of a tunnel
            // it becomes the tunnel start
            tunnelStart = currentLineKey;
        }
        else {
            // current line has no adj unsafe cells, so is not part of a tunnel
            // the previous line (or no line) is the tunnel start
            return tunnelStart !== null
                ? { tunnelStart, nextCellPos: currentCellPos }
                : null
        }

        // to find the next cell, we need to get the unsafe cell that is not the previous cell
        // if there is no previous cell one is chosen aribritralily
        const nextUnsafeCellPos = validAdjCells
            .find(cpos => {
                if (cpos.x === currentCellPos?.x && cpos.y === currentCellPos?.y) {
                    return false;
                }
                const cell = getCell(board, cpos)!
                const type = getCellType(board, cell);
                if (type !== "unsafe") {
                    return false;
                }
                return true;
            })

        if (nextUnsafeCellPos === undefined) {
            // the tunnel is over 
            return { tunnelStart, nextCellPos: currentCellPos };
        }

        // get the next line in the tunnel
        // i.e.  the unselected line on the unsafe adj cell that is not the current line
        const nextLineKey = getCell(board, nextUnsafeCellPos)!.lines
            .find(lk => lk != currentLineKey && !board.lines[lk].selected)
        if (!nextLineKey) {
            throw "this should not happen as `unsafeAdjCell` is unsafe, so is must have at least one other unselected line"
        }

        if (nextLineKey === initialLineKey) {
            // tunnel is a donut shape, any linekey can be the start
            return { tunnelStart, nextCellPos: currentCellPos };
        }

        currentCellPos = nextUnsafeCellPos;
        currentLineKey = nextLineKey;
    }
}

/**
 * get all the linekeys in a tunnel, starting from the line inbetween prevcellpos and nextcellpos
*/
function getTunnelFromStartingLineKey(board: Board, initialLineKey: string, startingCellPos: CellPos): string[] {
    const logTag = `getTunnelFromStartingLineKey(${initialLineKey}):`;
    let nextCellPos: CellPos = startingCellPos;
    let currentLineKey = initialLineKey;
    const tunnel = [initialLineKey]
    while (true) {
        console.log(logTag, "current key =", currentLineKey, "next cell =", JSON.stringify(nextCellPos))
        // get the next line in the tunnel
        // i.e.  the unselected line on the unsafe adj cell that is not the current line
        const nextLineKey = getCell(board, nextCellPos)!.lines
            .find(lk => lk != currentLineKey && !board.lines[lk].selected)
        console.log(logTag, "next key =", nextLineKey)
        if (!nextLineKey) {
            return tunnel;
        }

        if (nextLineKey === initialLineKey) {
            console.log(logTag, "next key is inital key, donut tunnel", nextLineKey)
            // tunnel is a donut shape
            return tunnel;
        }

        tunnel.push(nextLineKey);

        // to get the next cell,
        // find the cell on nextlk that does not include the current lk
        const maybeNext = board.lines[nextLineKey]!.cells
            .find(cpos => {
                const cell = getCell(board, cpos)!
                const type = getCellType(board, cell);
                if (type === "unsafe" && !cell.lines.includes(currentLineKey)) {
                    return true;
                }
                return false;
            })

        console.log(logTag, "calc next cell =", JSON.stringify(maybeNext))

        if (!maybeNext) {
            return tunnel;
        }

        nextCellPos = maybeNext;
        currentLineKey = nextLineKey;
    }
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

function logTunnelMap(tunnelMap: Record<string, string[]>): void {
    const s = Object.values(tunnelMap)
        .map(arr => JSON.stringify(arr))
        .join(',\n')
    console.log(`all tunnels\n`, `[\n${s}\n]`)
}