import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useState } from "react";
import { getPxValue, useWindowDimensions } from "../util";
import { Grid } from "./Grid";
import { SquaresGame, getScores, newGame, selectLine } from "../game";
import { doAiMove } from "../ai";

export function Game({ width, height, vsAI }: any) {
    const [squaresGame, setSquaresGame] = useState<SquaresGame>(newGame(width, height))
    const [style, setStyle] = useState<React.CSSProperties>({ width: "100%", height: "fit-content" })
    const ref = useRef<HTMLDivElement>(null)
    const { windowHeight, windowWidth } = useWindowDimensions()

    const rootStyles = getComputedStyle(document.documentElement)

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

    useEffect(() => {
        if (!ref.current) {
            return;
        }
        const cardWidthPx = ref.current
            .getBoundingClientRect()
            .width;
        const x = cardWidthPx / (width + 2);
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

    useEffect(() => {
        if (vsAI && squaresGame.turn === "p2") {
            setTimeout(() => {
                doAiMove(squaresGame)
                setSquaresGame({ ...squaresGame });
            }, 500)
        }
    }, [squaresGame])

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

    const cat = "https://upload.wikimedia.org/wikipedia/commons/4/44/Cat_img.jpg"

    return <div className="card" style={style} ref={ref}>
        <Grid squaresGame={squaresGame} setSquaresGame={setSquaresGame} enabled={gridIsEnabled} rows={height} cols={width} />
        <div className="scores">
            <div className="player-details">
                <div className="player-details-2">
                    <img className="player-img" src={cat}></img>
                    <p className="player-score">{scores.p1}</p>
                </div>
                <p className="player-name" >{"Player one"}</p>
            </div>
            <div className="player-details">
                <div className="player-details-2" style={{ "justifyContent": "right"}}>
                    <p className="player-score">{scores.p2}</p>
                    <img className="player-img" src={cat}></img>
                </div>
                <p className="player-name" style={{ "textAlign": "right"}}>{"Player two"}</p>
            </div>
        </div>
        <div className="message-box">
            {message}
        </div>
    </div>
}

function PlayerBox({ score, imgUrl, name }: any) {
    return <div className="player-details">
        <img className="player-img" src={imgUrl}></img>
        <p className="player-score">{score}</p>
        <p className="player-name">{name}</p>
    </div>
}