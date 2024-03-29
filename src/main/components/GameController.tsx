import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useState } from "react";
import { getPxValue, setTimeoutP, useWindowDimensions } from "../util/simple";
import { Grid } from "./Grid";
import { boardDimensions, getScores, selectLine } from "../game";
import { KeyedMessageEvent, usePromiseWorker } from "../util/promiseWorker";
import { useDebugColoredOpponentLines, useDebugMoveSeqs } from "../util/debug_tools";

export function GameController({ squaresGame, setSquaresGame, aiWorkerUrl, aiDelayMs }: any) {
    const [style, setStyle] = useState<Record<string, string>>({ width: "100%", height: "fit-content" })
    const ref = useRef<HTMLDivElement>(null)
    const { windowHeight, windowWidth } = useWindowDimensions()
    const { rows, cols } = boardDimensions(squaresGame.board);

    const workerOpts = useMemo(() => ({ type: "module" }), [])
    const vsAI = aiWorkerUrl !== undefined;
    const promptAi = usePromiseWorker(aiWorkerUrl, workerOpts as any)

    const rootStyles = getComputedStyle(document.documentElement)

    const debugMarkLineAsOpponent = useDebugColoredOpponentLines()
    useDebugMoveSeqs(squaresGame, setSquaresGame);

    useLayoutEffect(() => {
        if (!ref.current) {
            return;
        }
        if (style.width === "100%") {
            // case 1: card style is configured to work when it is shorter than the window dimensions
            const clientCard = ref.current.getBoundingClientRect();
            const maxHeight = windowHeight - (getPxValue(rootStyles, '--body-padding') * 2);
            if (clientCard.height > maxHeight) {
                // card is taller then window dimensions, switch case
                setStyle(prev => ({ ...prev, height: "100%", width: "fit-content" }))
            }
        }
        else {
            // case 2: card style is configured to work when it is wider than the window dimensions
            const gridTemplateHeightStr = getComputedStyle(ref.current)
                .gridTemplateRows
                .split(' ')?.[0]
            const gridTemplateHeight = parseInt(gridTemplateHeightStr);
            const actualGridHeight = ref.current.querySelector(".squares")!
                .getBoundingClientRect()
                .height;
            if (actualGridHeight < gridTemplateHeight) {
                // card is taller than it should be, switch case
                setStyle(prev => ({ ...prev, height: "fit-content", width: "100%" }))
            }
        }
    }, [windowHeight, windowWidth])

    useLayoutEffect(() => {
        if (!ref.current) {
            return;
        }
        const cardWidthPx = ref.current
            .getBoundingClientRect()
            .width;
        const x = cardWidthPx / (cols + 2);
        const padding = x * 0.7;
        const prevPaddingLeft = parseFloat(style.paddingLeft as string)
        if (isNaN(prevPaddingLeft) || Math.abs(padding - prevPaddingLeft) >= 1) {
            const lesserPadding = x * 0.5;
            setStyle(prev => ({
                ...prev,
                "paddingTop": `${Math.floor(padding)}px`,
                "paddingRight": `${Math.floor(padding)}px`,
                "paddingBottom": `${Math.floor(lesserPadding)}px`,
                "paddingLeft": `${Math.floor(padding)}px`,
                "rowGap": `${Math.floor(padding)}px`
            }))
        }
    })

    const scores = useMemo(() => getScores(squaresGame.board), [squaresGame])

    let message;
    if (scores.winner == null) {
        if (squaresGame.turn == "p1") {
            message = `Player one's turn`
        }
        else {
            message = `Player two's turn`
        }
    }
    else if (scores.winner == `p1`) {
        message = `Player one wins, ${scores.p1}-${scores.p2}!`
    }
    else if (scores.winner == `p2`) {
        message = `Player two wins, ${scores.p2}-${scores.p1}!`
    }
    else {
        message = `It was a tie, ${scores.p1} all!`
    }

    useEffect(() => {
        if (vsAI && squaresGame.turn === "p2" && scores.winner === null) {
            const aiPromise = promptAi(squaresGame.board);
            if (aiPromise !== undefined) {
                const otherPromise = setTimeoutP(aiDelayMs);
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

    const gridIsEnabled = !vsAI || squaresGame.turn === "p1";

    const cat = "cat.jpeg"

    return <div className="card" style={style} ref={ref}>
        <Grid squaresGame={squaresGame} setSquaresGame={setSquaresGame} enabled={gridIsEnabled} rows={rows} cols={cols} />
        <div className="scores">
            <div className={"player-details " + (squaresGame.turn === "p1" ? "player-details-active" : "")}>
                <div className="player-details-2">
                    <img className="player-img" src={cat}></img>
                    <p className="player-score">{scores.p1}</p>
                </div>
                <p className="player-name" >{"Player one"}</p>
            </div>
            <div className={"player-details " + (squaresGame.turn === "p2" ? "player-details-active" : "")}>
                <div className="player-details-2" style={{ "justifyContent": "right" }}>
                    <p className="player-score">{scores.p2}</p>
                    <img className="player-img" src={cat}></img>
                </div>
                <p className="player-name" style={{ "textAlign": "right" }}>{"Player two"}</p>
            </div>
        </div>
        <div className="message-box">
            {message}
        </div>
    </div>
}