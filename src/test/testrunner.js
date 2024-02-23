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
        console.log("testres PASS:", testName)
    }
    else {
        console.error("testres FAIL:", testName, "\n", res)
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

export const aiTest = async (state, evalBoard, expectedMoveSet) => {
    const game = gameWithState(state)
    let actualMoves = [];
    for (let i = 0; i < expectedMoveSet.length; i++) {
        if (actualMoves.length === expectedMoveSet.length) {
            return; // pass
        }
        if (game.turn !== "p2") {
            return "no longer ai's turn, actual moves = " + JSON.stringify(actualMoves)
        }
        const result = await evalBoard(game.board);
        const chosenLineKey = result?.data?.message;
        selectLine(game, chosenLineKey);
        actualMoves.push(chosenLineKey);
        if (!expectedMoveSet.includes(chosenLineKey)) {
            return "chosen move " + chosenLineKey + " not in expected moveset, actual moves = " + JSON.stringify(actualMoves);
        }
    }
}