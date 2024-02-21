import { _selectLineOnBoard, newGame, selectLine } from "../main/game";

export const test = async (testName, fn) => {
    let res;
    try {
        res = await fn();
    }
    catch (e) {
        res = e;
    }
    if (res === undefined) {
        console.log("PASS:", testName)
    }
    else {
        console.error("FAIL:", testName, "\n", res)
    }
}

// eg state:  {"rows":5,"cols":5,"moves":["2,1v","3,2v","4,1v"]}
export const gameWithState = (state) => {
    const game = newGame(state.cols, state.rows);
    for (const lk of state.moves) {
        selectLine(game, lk)
    }
    return game;
    
}