import deepClone from "deep-clone";
import { Board, Cell, CellPos, SquaresGame, _selectLineOnBoard, lineKey, selectLine } from "../game";
import { shuffle } from "../util";

type Selection = {
    points: number,
    lineKeys: string[]
}

export function doAiMove(squaresGame: SquaresGame): void {
    console.log("\nstart AI move:")
    const simpleChoices = getSimpleBoardEvaluation(squaresGame.board);

    let bestMove: { lineKey: string, score: number } | null = null;
    for (const {lineKeys, points} of simpleChoices) {
        // make the choice on a clone board
        const boardStatePostSelection = deepClone(squaresGame.board);
        for (const lk of lineKeys) {
            // I'm not actully sure it matters if it's p1 or p2 here, as
            // we don't care about the score
            _selectLineOnBoard(boardStatePostSelection, lk, "p2")
        }

        // evaluate board state for opponent, get max points they can get
        const opponentPoints = getSimpleBoardEvaluation(boardStatePostSelection)
            ?.[0]
            .points;
        const score = points - opponentPoints;
        if (!bestMove || score > bestMove.score) {
            const lineKey = lineKeys[0];
            if (!lineKey) {
                console.error("this should not happen")
                continue;
            }
            bestMove = { score, lineKey }
        }
    }
    
    if (bestMove === null) {
        return;
    }

    selectLine(squaresGame, bestMove.lineKey);
}

function getSimpleBoardEvaluation(board: Board) {
    const decisionMap: Record<string, Selection> = {}
    const avalibleLines = Object.entries(board.lines)
        .filter(e => !e[1].selected);
    shuffle(avalibleLines);
    for (const [lk, _] of avalibleLines) {
        const { lineKeys, points } = getSimpleValueOfLine(board, lk)
        const lineKeysKey = getLineKeysKey(lineKeys)

        // assertion
        if (decisionMap[lineKeysKey] != null) {
            console.log("can this even happen? asd")
            console.assert(decisionMap[lineKeysKey].points === points, "entry in decision map with same key has different value :(")
        }

        decisionMap[lineKeysKey] = { lineKeys, points };
    }

    const choices = Object.entries(decisionMap)
        .map(([selectionKey, selection]) => ({ key: selectionKey, points: selection.points, lineKeys: selection.lineKeys }))
        .sort((a, b) => b.points - a.points)
    return choices;
}

function getSimpleValueOfLine(board: Board, lineKey: string): Selection {
    console.log("assessing line", lineKey)
    const line  = board.lines[lineKey];
    const adjacentCells = line.cells.map(c => board.cells[c.y][c.x])
    if (adjacentCells.length == 1) {
        // 1: simple case, max one point
        const cellType = getCellType(board, adjacentCells[0])
        console.log("single adj cell of type", cellType)
        if (cellType === "free" || cellType === "unsafe") {
            return { lineKeys: [lineKey], points: 0 };
        }
        else if (cellType == "goal") {
            return { lineKeys: [lineKey], points: 1 };
        }
        else {
            console.error("celltype should not be 'claimed' here. (line is unclaimed, only 1 adj cell)")
            return { lineKeys: [lineKey], points: -99 };
        }
    }
    else {
        // 2: possibly can get multiple points via tunnel
        const a = getCellType(board, adjacentCells[0])
        const b = getCellType(board, adjacentCells[1])
        console.log("two adj cells of types", a, b)
        if (a === "goal" && b === "goal") {
            // both goal cells
            return { lineKeys: [lineKey], points: 2 };
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
                return getPointsForTunnel(board, goalCellPos, unsafeCellPos)

            }
            else {
                // at least one goal cell
                return { lineKeys: [lineKey], points: 1 };
            }
        }
        else {
            // no goals
            return { lineKeys: [lineKey], points: 0 };
        }
    }
}

function getPointsForTunnel(board: Board, prevCellPos: CellPos, nextCellPos: CellPos): Selection {
    const prevCell = board.cells[prevCellPos.y][prevCellPos.x];
    const nextCell = board.cells[nextCellPos.y][nextCellPos.x];
    const prevCellType = getCellType(board, nextCell);
    console.assert(prevCellType === "unsafe" || prevCellType === "goal", "invlaid arg")

    const inBewteenLineKey = prevCell.lines.filter(l => nextCell.lines.includes(l))[0];
    console.log(`getPointsForTunnel lk=${inBewteenLineKey} a=${prevCellPos.x},${prevCellPos.y} b=${nextCellPos.x},${nextCellPos.y}`)

    if (getCellType(board, nextCell) !== "unsafe") {
        console.log(`next cell is not unsafe`)
        return { lineKeys: [inBewteenLineKey], points: 1};
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
        console.log(`next cell does not exist (i.e. tunnel leads off board)`)
        return { lineKeys: [inBewteenLineKey], points: 1};
    }

    console.log(`next line=${lineKey(otherUnclaimedLine.key)}, next cell=${nextNextCellPos.x},${nextNextCellPos.y}`)

    const next = getPointsForTunnel(board, nextCellPos, nextNextCellPos)
    return { lineKeys: [...next.lineKeys, inBewteenLineKey], points: 1 + next.points}
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

function getLineKeysKey(lineKeys: string[]) {
    return lineKeys.sort().join(" ")
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