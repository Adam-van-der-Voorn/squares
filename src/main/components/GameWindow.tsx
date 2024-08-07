import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useState } from "react";
import { getPxValue } from "../util/dom";
import { useWindowDimensions } from "../util/hooks";

import { Grid } from "./Grid";
import { getBoardDimensions, getScores } from "../game";

export function GameWindow({ squaresGame, setSquaresGame, vsAI }: any) {
    const [style, setStyle] = useState<Record<string, string>>({ width: "100%", height: "max-content" })
    const ref = useRef<HTMLDivElement>(null)
    const { windowHeight, windowWidth } = useWindowDimensions()
    const { rows, cols } = getBoardDimensions(squaresGame.board);
    const [squaresStyle, setSquaresStyle] = useState<Record<string, string>>({
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        aspectRatio: `${cols} / ${rows}`
    })

    const rootStyles = getComputedStyle(document.documentElement)

    useLayoutEffect(() => {
        if (!ref.current) {
            return;
        }
        console.log("\ncall useLayoutEffect- currently:", "width=", style.width)
        if (style.width === "100%") {
            // case 1: card style is configured to work when it is shorter than the window dimensions
            const clientCard = ref.current.getBoundingClientRect();
            const maxHeight = windowHeight - (getPxValue(rootStyles, '--body-padding') * 2);
            console.log("card height =", clientCard.height, "max =", maxHeight)
            if (clientCard.height > maxHeight) {
                // card is taller then window dimensions, switch case
                console.log("switch to width max-content")
                setStyle(prev => ({ ...prev, height: "100%", width: "max-content" }))
            }
        }
        else {
            // case 2: card style is configured to work when it is wider than the window dimensions
            const clientCard = ref.current.getBoundingClientRect();
            const maxWidth = windowWidth - (getPxValue(rootStyles, '--body-padding') * 2);
            console.log("card width =", clientCard.width, "max =", maxWidth)
            if (clientCard.width > maxWidth) {
                // card is wider than it should be, switch case
                console.log("switch to height max-content")
                setStyle(prev => ({ ...prev, height: "max-content", width: "100%" }))
            }
        }
    }, [windowHeight, windowWidth])

    useLayoutEffect(() => {
        if (!ref.current) {
            return
        }
        if (style.width === "max-content") {
            const gridTemplateHeightStr = getComputedStyle(ref.current)
                .gridTemplateRows
                .split(' ')?.[0]
            setSquaresStyle(prev => ({ ...prev, height: gridTemplateHeightStr }))
            console.log("set squares height to", gridTemplateHeightStr)
        }
        else {
            setSquaresStyle(prev => ({ ...prev, height: "" }))
            console.log("reset squares height")

        }
    }, [style])

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

    const gridIsEnabled = !vsAI || squaresGame.turn === "p1";

    const cat = "img/cat.jpeg"

    return <div className="card" style={style} ref={ref}>
        <div className="squares" style={squaresStyle}>
            <Grid squaresGame={squaresGame} setSquaresGame={setSquaresGame} enabled={gridIsEnabled} rows={rows} cols={cols} />
        </div>
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