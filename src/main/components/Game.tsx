import React, { useEffect, useMemo } from "react";
import { useState } from "react";
import { SquaresGame, getScores, newGame, selectLine } from "../game";
import { GameWindow } from "./GameWindow";
import { KeyedMessageEvent, usePromiseWorker } from "../util/promiseWorker";
import { setTimeoutP } from "../util/simple";
import { useDebugColoredOpponentLines, useDebugMoveSeqs } from "../util/debug_tools";

const AI_DELAY_MS = 300;
const AI_WORKER_URL = "js/ai.worker.quick.bundle.js";
                        
export function Game({ width, height, vsAI }: any) {
    const [squaresGame, setSquaresGame] = useState<SquaresGame>(newGame(width, height))
    const workerOpts = useMemo(() => ({ type: "module" }), [])

    const debugMarkLineAsOpponent = useDebugColoredOpponentLines()
    useDebugMoveSeqs(squaresGame, setSquaresGame);

    const promptAI = vsAI ? usePromiseWorker(AI_WORKER_URL, workerOpts as any) : null;
    const scores = useMemo(() => getScores(squaresGame.board), [squaresGame])

    useEffect(() => {
        if (promptAI !== null && squaresGame.turn === "p2" && scores.winner === null) {
            const aiPromise = promptAI(squaresGame.board);
            if (aiPromise !== undefined) {
                const otherPromise = setTimeoutP(AI_DELAY_MS);
                Promise.all([aiPromise, otherPromise]).then(all => {
                    const ev: KeyedMessageEvent = all[0];
                    if (!ev) {
                        return;
                    }
                    const lineKey = ev.data.message;
                    if (typeof lineKey !== 'string') {
                        return;
                    }
                    debugMarkLineAsOpponent(lineKey)
                    selectLine(squaresGame, lineKey);
                    setSquaresGame({ ...squaresGame });
                })
            }
        }
    }, [squaresGame])

    return <GameWindow squaresGame={squaresGame}
        setSquaresGame={setSquaresGame}
        vsAi={vsAI}
        aiDelayMs={AI_DELAY_MS}
    />
}