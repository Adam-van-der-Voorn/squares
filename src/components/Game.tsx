import React, { useLayoutEffect, useRef } from "react";
import { useState } from "react";
import { getPxValue, useWindowDimensions } from "../util";
import { Grid, Props as GridProps} from "./Grid";

export function Game({ width, height, vsAI }: any) {
    const [winState, setWinState] = useState<any>(null);
    const [turn, setTurn] = useState<GridProps["turn"]>("p1");
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

    useLayoutEffect(() => {
        if (!ref.current) {
            return;
        }
        const cellSize = ref.current.querySelector(".cell")!
            .getBoundingClientRect()
            .width;

        if (cellSize) {
            const padding = cellSize * 0.7;
            const prevPadding = parseFloat(style.padding as string)
            if (isNaN(prevPadding) || Math.abs(padding - prevPadding) >= 1) {
                const paddingPx = `${Math.floor(padding)}px`
                setStyle(prev => ({ ...prev, "padding": paddingPx, "rowGap": paddingPx }))
            }
        }
    })

    console.log({ windowHeight, windowWidth })

    let message;
    if (winState == null) {
        if (turn == "p1") {
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

    return <div className="card" style={style} ref={ref}>
        <Grid onWin={setWinState} turn={turn} setTurn={setTurn} rows={height} cols={width} />
        <div className="message-box">
            {message}
        </div>
    </div>
}