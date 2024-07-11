import { exit } from "process";
import { getNumUnselectedLines, getScores, newGame, selectLine,  } from "../src/main/game";
import { getMoveSequence as getMoveSeqQuick } from '../src/worker_ai/quick/lib'
import { getMoveSequence as getMoveSeqRng } from '../src/worker_ai/rng/lib'
import { mulberry32 } from "../src/main/util/simple";
import { GetMoveSequence } from "../src/worker_ai/types"

const LOG_TAG = "fuzz:"

// TODO
// only currently works with `rng quick` as ai params, bc the quick ai assumes it is p2

const fnMap: Record<string, GetMoveSequence> = {
    rng: getMoveSeqRng,
    quick: getMoveSeqQuick,
}

const ARGS_MSG = "args: <ai filename> <ai filename> [<seed>]";

async function main() {
    const aiIds = {
        p1: process.argv[2],
        p2: process.argv[3]
    }

    const getMoveSequence = {
        p1: fnMap[aiIds.p1],
        p2: fnMap[aiIds.p2]
    }
    const cellsX = parseInt(process.argv[4]);
    const cellsY = parseInt(process.argv[5]);

    const seed = process.argv[6]
        ? parseInt(process.argv[6])
        : Math.floor(Math.random() * 13229108) // any old rand int will do

    const rng = {
        p1: mulberry32(seed), 
        p2: mulberry32(seed)
    }
    
    if (process.argv.length < 6) {
        console.error(ARGS_MSG)
        exit(1)
    }
    
    const game = newGame(cellsX, cellsY)
    const history = []
    let remainingLines = getNumUnselectedLines(game.board);
    try {
        while (remainingLines > 0) {
            console.log(LOG_TAG, "remaining", remainingLines)
            const player = game.turn;
            const moves = getMoveSequence[player](game.board, rng[player]);
            for (const move of moves) {
                if (game.turn !== player) {
                    throw `short circut- the ai "${aiIds[player]}" wants to do more moves, but it's turn is over
                    this indicates a bug of some sort!
                    intended move seq = [${moves.join(' ')}]`
                }
                history.push(move)
                selectLine(game, move)
            }
            remainingLines = getNumUnselectedLines(game.board);
        }
        const winner = getScores(game.board).winner
        console.log(LOG_TAG, "completed", seed + ", winner is", winner ?? "<null>")
    }
    catch (e) {
        console.log(LOG_TAG + " failure:", e)
        console.log(LOG_TAG + " failure: - history", history.join(" "))
        console.log(LOG_TAG + " failure: - seed", seed)
        exit(1)
    }
}

main();




