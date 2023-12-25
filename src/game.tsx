import { unpack } from "./util"

export type PlayerKey = "p1" | "p2"

export function lineKey({ x, y, horiOrVert }: LineKey): string {
    return x.toString() + "," + y.toString() + horiOrVert
}

export type LineKey = { x: number, y: number, horiOrVert: "h" | "v" }

export type Line = {
    key: LineKey
    cells: {x: number, y: number}[],
    selected: boolean,
}

export type Cell = {
    // NESW
    lines: [string, string, string, string]
    claim: PlayerKey | null,
}

export type Board = {
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

export function newBoard(width: number, height: number): Board {
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
    return { cells, lines }
}

export function boardDimensions(board: Board): { rows: number, cols: number } {
    return {
        // rows are inner arrays
        rows: board.cells[0].length,
        cols: board.cells.length
    }
}

export function numClaimedSquaresForLine(board: Board, lineKey: string): number {
    let numClaimed = 0;
    for (const {x, y} of board.lines[lineKey].cells) {
        console.log("checking cell", x, ",", y)
        const cell = board.cells[y][x];
        if (cell.claim != null) {
            numClaimed += 1;
        }
    }
    return numClaimed;
}

export function selectLine(board: Board, lineKey: string, player: PlayerKey): number {
    board.lines[lineKey].selected = true;
    let newClaimedSquares = 0;
    for (const {x, y} of board.lines[lineKey].cells) {
        console.log("checking cell x:", x, ", y:", y)
        const cell = board.cells[y][x];       
        if (cell.claim == null) {
            const isSurrounded = cell.lines.every(lk => {
                const l = board.lines[lk];
                console.log("line", lk, "selected?", l.selected)
                return l.selected === true
            });
            if (isSurrounded) {
                cell.claim = player;
                newClaimedSquares += 1;
            }
        }
    }
    return newClaimedSquares;
}

export function getWinner(board: Board) {
    const cells = unpack(board.cells).map(c => c.val)
    const isWon = cells.every(c => c.claim !== null);
    if (!isWon) {
        return null;
    }

    // count claims
    const claims = { p1: 0, p2: 0}
    for (const cell of cells) {
        claims[cell.claim!] += 1
    }
    
    let winner
    if (claims.p1 > claims.p2) {
        winner = "p1"
    }
    else if (claims.p1 < claims.p2) {
        winner = "p2"
    }
    else {
        winner = "tie"
    }
    return { ...claims, winner }
}

