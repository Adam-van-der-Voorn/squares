// query params:
// ai url 1, ai url 2, width, height
// dont get xxs'd or ../../../'d

// UNFINISHED - DOES NOT WORK

import { SquaresGame, getScores, newGame, selectLine } from "../main/game";
import { KeyedMessageEvent, getPromiseWorker } from "../main/util/promiseWorker";

// make board of width,height
// 1 starts

async function doMove(game: SquaresGame, promptAi: any): Promise<string | undefined> {
    const aiPromise = promptAi(game.board);
    if (aiPromise !== undefined) {
        return aiPromise.then((ev: KeyedMessageEvent) => {
            if (!ev) {
                return undefined;
            }
            const lineKey = ev.data.message;
            if (typeof lineKey !== 'string') {
                return undefined;
            }
            return lineKey;
        })
    }
}

type SimResult = {
    winner: string | null
    moveSeq: string[]
}

async function sim(worker1Url: string, worker2Url: string, numCellsX: number, numCellsY: number): Promise<SimResult> {
    const p1 = getPromiseWorker(worker1Url, { type: "module" })
    const p2 = getPromiseWorker(worker2Url, { type: "module" })
    const squaresGame = newGame(numCellsX, numCellsY);
    const moveSeq: string[] = []
    let winner = null;
    while (winner === null) {
        let move;
        if (squaresGame.turn === "p1") {
            move = await doMove(squaresGame, p1.workerRequest)
        }
        else {
            move = await doMove(squaresGame, p2.workerRequest)
        }
        if (!move) {
            return { winner: null, moveSeq };
        }
        moveSeq.push(move)
        selectLine(squaresGame, move)
        winner = getScores(squaresGame.board).winner
    }
    return { winner, moveSeq };
}

export async function compare(worker1Url: string, worker2Url: string, numCellsX: number, numCellsY: number, iters: number) {
    const results = []
    for (let i = 0; i < iters; i++) {
        //const res = sim(w)
    }
}