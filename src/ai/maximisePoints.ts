import { Board, Cell, CellPos, SquaresGame, _selectLineOnBoard, lineKey, selectLine } from "../game";
import { shuffle } from "../util";

export function doAiMove(squaresGame: SquaresGame): void {
    const decisionMap: Record<string, number> = {}
    console.log("\nstart AI move:")
    const avalibleLines = Object.entries(squaresGame.board.lines)
        .filter(e => !e[1].selected);
    shuffle(avalibleLines);
    for (const [lk, _] of avalibleLines) {
        const points = getPointsForLine(squaresGame.board, lk)
        console.log("points for line:", points)
        decisionMap[lk] = points;
    }

    const choices = Object.entries(decisionMap)
        .sort((a, b) => b[1] - a[1])
    if (choices.length === 0) {
        return;
    }
    const [chosenLineKey, _] = choices[0];
    selectLine(squaresGame, chosenLineKey);
}

function getPointsForLine(board: Board, lineKey: string): number {
    console.log("assessing line", lineKey)
    const line  = board.lines[lineKey];
    const adjacentCells = line.cells.map(c => board.cells[c.y][c.x])
    if (adjacentCells.length == 1) {
        // 1: simple case, max one point
        const cellType = getCellType(board, adjacentCells[0])
        console.log("single adj cell of type", cellType)
        if (cellType === "free" || cellType === "unsafe") {
            return 0;
        }
        else if (cellType == "goal") {
            return 1;
        }
        else {
            console.error("celltype should not be 'claimed' here. (line is unclaimed, only 1 adj cell)")
            return -99;
        }
    }
    else {
        // 2: possibly can get multiple points via tunnel
        const a = getCellType(board, adjacentCells[0])
        const b = getCellType(board, adjacentCells[1])
        console.log("two adj cells of types", a, b)
        if (a === "goal" && b === "goal") {
            // both goal cells
            return 2;
        }
        else if (a === "goal" || b === "goal") {
            if (a === "unsafe" || b === "unsafe") {
                // one goal cell and one unsafe cell
                let unsafeCellPos: CellPos, goalCellPos: CellPos;
                if (a === "unsafe") {
                    unsafeCellPos = line.cells[0]
                    goalCellPos = line.cells[1]
                }
                else {
                    unsafeCellPos = line.cells[1]
                    goalCellPos = line.cells[0]
                }
                return getPointsForTunnel(board, goalCellPos, unsafeCellPos, 0)
            }
            else {
                // at least one goal cell
                return 1;
            }
        }
        else {
            // no goals
            return 0;
        }
    }
}

function getPointsForTunnel(board: Board, prevCellPos: CellPos, nextCellPos: CellPos, acc: number): number {
    const prevCell = board.cells[prevCellPos.y][prevCellPos.x];
    const nextCell = board.cells[nextCellPos.y][nextCellPos.x];
    const prevCellType = getCellType(board, nextCell);
    console.assert(prevCellType === "unsafe" || prevCellType === "goal", "invlaid arg")

    const inBewteenLineKey = prevCell.lines.filter(l => nextCell.lines.includes(l))[0];
    console.log(`getPointsForTunnel lk=${inBewteenLineKey} a=${prevCellPos.x},${prevCellPos.y} b=${nextCellPos.x},${nextCellPos.y}`)

    if (getCellType(board, nextCell) !== "unsafe") {
        console.log(`next cell is not unsafe, ending with ${acc + 1} points`)
        return acc + 1;
    }

    const otherUnclaimedLine = nextCell.lines
        .filter(k => k != inBewteenLineKey)
        .map(lk => board.lines[lk])
        .filter(line => !line.selected)
        [0]

    const nextNextCellPos = otherUnclaimedLine.cells
        .filter(p => {
            console.log(`next next cell candidate=${p.x},${p.y}`)
            console.log(`nextCellPos.x=${nextCellPos.x} nextCellPos.y=${nextCellPos.y}`)
            !(p.x === nextCellPos.x && p.y == nextCellPos.y)
        })[0]
    
    if (nextNextCellPos === undefined) {
        console.log(`next cell does not exist (i.e. tunnel leads off board), ending with ${acc + 1} points`)
        return acc + 1;
    }

    console.log(`next line=${lineKey(otherUnclaimedLine.key)}, next cell=${nextNextCellPos.x},${nextNextCellPos.y}, points=${acc+1}`)

    return getPointsForTunnel(board, nextCellPos, nextNextCellPos, acc + 1)
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