import { useEffect, useState } from "react";
import { SquaresGame, getBoardDimensions, selectLine, setMoveListener } from "../game";

const DEBUG_COLORED_OPPONENT_LINES = true;

const DEBUG_LINE_LABELS = true;

export function useDebugColoredOpponentLines() {
    const [opponentLines, setOpponentLines] = useState<string[]>([])

    const addOpponentLine = (lineKey: string) => setOpponentLines(prev => {
        return [...prev, lineKey]
    })

    useEffect(() => {
        if (!DEBUG_COLORED_OPPONENT_LINES) {
            return;
        }
        document.querySelectorAll(".line")
            .forEach(line => {
                const lineKey = line.getAttribute('data-key');
                if (opponentLines.find(lk => lk === lineKey)) {
                    (line as HTMLElement).style.backgroundColor = "blue"
                }
            })
    })

    return addOpponentLine;
}

export function useDebugLineLabels() {
    useEffect(() => {
        if (!DEBUG_LINE_LABELS) {
            return;
        }
        document.querySelectorAll(".line")
            .forEach(line => {
                const rect = line.getBoundingClientRect()
                const label = document.createElement('div')
                label.style.color = "red"
                label.style.fontSize = "11px"
                label.style.backgroundColor = "white"
                label.style.display = "inline-block"
                label.style.position = "absolute"
                label.style.top = `50%`;
                label.style.left = `50%`;
                label.className = "line-label"
                label.innerText = line.getAttribute("data-key") ?? ""
                line.appendChild(label)
            })
            
    }, [])
}

// so we can reproduce matches in tests, and vice versa
export function useDebugMoveSeqs(squaresGame: SquaresGame, setSquaresGame: any) {
    const { rows, cols } = getBoardDimensions(squaresGame.board)
    let [moveList, setMoveList] = useState<string[]>([])
    useEffect(() => {
        (window as any)._squares_applyMoveSeq = (seq: string[]) => {
            seq.forEach((lk: string) => selectLine(squaresGame, lk))
            setSquaresGame({...squaresGame})
        }
        (window as any)._squares_getGameState = () => {
            return squaresGame;
        }
        setMoveListener(squaresGame, "debug-listener", lk => {
            const newMoveList = [...moveList, lk]
            console.log("history\n", JSON.stringify({ rows, cols, moves: newMoveList }))
            setMoveList(newMoveList)
        })
    })
}