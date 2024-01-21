import { Board, Cell, SquaresGame, _selectLineOnBoard, getScores } from "../game";
import { shuffle } from "../util";

type Move = {
    points: number,
    lineKeys: string[]
}

export function doAiMove(squaresGame: SquaresGame): string | null {
    console.log("\n\n\n\nstart AI move:")
    const possibleMoves = getSimpleBoardEvaluation(squaresGame.board);
    console.log("possible moves for ai:", JSON.stringify(possibleMoves, null, 2))

    let bestMove: any = null;
    for (const { lineKeys, points } of possibleMoves) {
        if (lineKeys.length === 0) {
            console.error("this should not happen")
            continue;
        }
        // make the choice on a clone board
        const boardStatePostSelection = structuredClone(squaresGame.board);
        for (const lk of lineKeys) {
            // I'm not actully sure it matters if it's p1 or p2 here, as
            // we don't care about the score
            _selectLineOnBoard(boardStatePostSelection, lk, "p2")
        }

        // evaluate board state for opponent, get max points they can get
        console.log("getting possible moves for opponent if AI does", JSON.stringify(lineKeys))
        const predictedOpponentMove = getSimpleBoardEvaluation(boardStatePostSelection)?.[0];
        let opponentPoints;
        if (predictedOpponentMove?.points !== undefined) {
            opponentPoints = predictedOpponentMove?.points
        }
        else {
            console.assert(getScores(boardStatePostSelection).winner != null, "assume no points as game is won by ai")
            return lineKeys[0]; // lineKeys is not empty due to guard
        }
        const score = points - opponentPoints;
        console.log("outcome", {points, opponentPoints, predictedOpponentMove})
        if (!bestMove || score > bestMove.score) {
            const lineKey = lineKeys[0]; // lineKeys is not empty due to guard
            bestMove = { score, lineKey }
            console.log("**\nbest move changed to", bestMove, "\n**")
        }
    }
    console.log("best move", bestMove)
    return bestMove.lineKey ?? null;
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
        const move = { points, lineKeys: [lk]}
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
            // we can potentially avoid deep clone by implementing undo in board DS somehow
            const boardWithMoveApplied = structuredClone(board);
            // do move sequence
            for (const lk of move.lineKeys) {
                _selectLineOnBoard(boardWithMoveApplied, lk, "p2")
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
                const singleMovePoints = simpleEvaluateMove(boardWithMoveApplied, lk)
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
        }
        incompleteMoves = furtherIncompleteMoves;
    }

    if (limit <= 0) {
        console.error("getPossibleMoves limit hit!")
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
            console.error("celltype should not be 'claimed' here. (line is unclaimed, only 1 adj cell)")
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

// function getPointsForTunnel(board: Board, prevCellPos: CellPos, nextCellPos: CellPos): Move[] {
//     const prevCell = board.cells[prevCellPos.y][prevCellPos.x];
//     const nextCell = board.cells[nextCellPos.y][nextCellPos.x];
//     const prevCellType = getCellType(board, nextCell);
//     console.assert(prevCellType === "unsafe" || prevCellType === "goal", "invlaid arg")

//     const inBewteenLineKey = prevCell.lines.filter(l => nextCell.lines.includes(l))[0];
//     console.log(`getPointsForTunnel lk=${inBewteenLineKey} a=${prevCellPos.x},${prevCellPos.y} b=${nextCellPos.x},${nextCellPos.y}`)

//     if (getCellType(board, nextCell) !== "unsafe") {
//         console.log(`next cell is not unsafe`)
//         return { lineKeys: [inBewteenLineKey], points: 1 };
//     }

//     const otherUnclaimedLine = nextCell.lines
//         .filter(k => k != inBewteenLineKey)
//         .map(lk => board.lines[lk])
//         .filter(line => !line.selected)
//     [0]

//     const nextNextCellPos = otherUnclaimedLine.cells
//         .filter(p => {
//             console.log(`next next cell candidate=${p.x},${p.y}`)
//             console.log(`nextCellPos.x=${nextCellPos.x} nextCellPos.y=${nextCellPos.y}`)
//             !(p.x === nextCellPos.x && p.y == nextCellPos.y)
//         })[0]

//     if (nextNextCellPos === undefined) {
//         console.log(`next cell does not exist (i.e. tunnel leads off board)`)
//         return { lineKeys: [inBewteenLineKey], points: 1 };
//     }

//     console.log(`next line=${lineKey(otherUnclaimedLine.key)}, next cell=${nextNextCellPos.x},${nextNextCellPos.y}`)

//     const nextSteps = getPointsForTunnel(board, nextCellPos, nextNextCellPos)

//     // next may be...
//     // [{l2, l3}, {l2}]
//     // and iblk is l1
//     // must return 
//     // [{l1, l2, l3},{l1, l2},{l1}]

//     // add current step before next steps
//     const steps = nextSteps.map(s => {
//         return { lineKeys: [inBewteenLineKey, ...s.lineKeys], points: 1 + s.points }
//     })
//     return [
//         ...steps,
//         // include just current step
//         { lineKeys: [inBewteenLineKey], points: 1 },
//     ]
// }

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

function moveKey(lineKeys: string[]) {
    return [...lineKeys].sort().join(" ")
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