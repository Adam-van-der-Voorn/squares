import { useEffect, useState } from "react";

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
                label.style.top = `${rect.height/4}px`;
                label.style.left = `${rect.width/4}px`;
                label.innerText = line.getAttribute("data-key") ?? ""
                line.appendChild(label)
            })
            
    }, [])
}