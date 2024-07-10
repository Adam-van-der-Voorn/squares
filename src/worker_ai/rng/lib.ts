import { Board } from "../../main/game";
import { shuffle } from "../../main/util/simple";

const RNG_SEED = 4398798765;

export function getBestMove(board: Board) {     
    const avalibleLineKeys = Object.entries(board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0])

    const shuffled = shuffle(avalibleLineKeys, RNG_SEED)
    return [shuffled[0]];
};