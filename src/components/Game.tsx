import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useState } from "react";
import { getPxValue, useWindowDimensions } from "../util";
import { Grid } from "./Grid";
import { SquaresGame, getWinner, newGame, selectLine } from "../game";
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
            setStyle(prev => ({ ...prev,
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
                setSquaresGame({...squaresGame});
            }, 500)
        }
    }, [squaresGame])

    const winState = useMemo(() => getWinner(squaresGame.board), [squaresGame])

    let message;
    if (winState == null) {
        if (squaresGame.turn == "p1") {
            message = `Player one's turn`
        }
        else {
            message = `Player two's turn`
        }
    }
    else if (winState.winner == `p1`) {
        message = `Player one wins, ${winState.p1}-${winState.p2}!`
    }
    else if (winState.winner == `p2`) {
        message = `Player two wins, ${winState.p2}-${winState.p1}!`
    }
    else {
        message = `It was a tie, ${winState.p1} all!`
    }

    const gridIsEnabled = !vsAI || squaresGame.turn === "p1";

    return <div className="card" style={style} ref={ref}>
        <Grid squaresGame={squaresGame} setSquaresGame={setSquaresGame} enabled={gridIsEnabled} rows={height} cols={width} />
        <div className="message-box">
            {message}
        </div>
    </div>
}