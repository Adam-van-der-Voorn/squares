import React, {  } from "react";
import { useState } from "react";
import { SquaresGame, newGame } from "../game";
import { GameController } from "./GameController";

const AI_DELAY_MS = 300;
                        
export function Game({ width, height, vsAI }: any) {
    const [squaresGame, setSquaresGame] = useState<SquaresGame>(newGame(width, height))
    const aiWorkerUrl = vsAI ? "ai.worker.x.bundle.js" : undefined;
    return <GameController squaresGame={squaresGame}
        setSquaresGame={setSquaresGame}
        aiWorkerUrl={aiWorkerUrl}
        aiDelayMs={AI_DELAY_MS}
    />
}