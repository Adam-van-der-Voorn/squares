import { Board } from "../../main/game";
import { mulberry32, shuffle } from "../../main/util/simple";

const RNG = mulberry32(4398798765);

export function getBestMove(board: Board) {     
    const avalibleLineKeys = Object.entries(board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0])

    const shuffled = shuffle(avalibleLineKeys, RNG)
    return [shuffled[0]];
};