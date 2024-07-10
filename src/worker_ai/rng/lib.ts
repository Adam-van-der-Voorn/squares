import { Board } from "../../main/game";
import { mulberry32, shuffle } from "../../main/util/simple";

const DEFAULT_SEED = 4398798765;

export function getMoveSequence(board: Board, rng?: () => number) {   
    rng = rng ?? mulberry32(DEFAULT_SEED)

    const avalibleLineKeys = Object.entries(board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0])

    const shuffled = shuffle(avalibleLineKeys, rng)
    return [shuffled[0]];
};