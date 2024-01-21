import { useCallback, useEffect, useState } from "react";

export function unpack<T>(arr: T[][]) {
    // assume outer is rows, inner is cols
    const height = arr.length
    const width = arr[0].length
    const flattened = []
    for (let rowi = 0; rowi < height; rowi++) {
        for (let coli = 0; coli < width; coli++) {
            flattened.push({ x: coli, y: rowi, val: arr[rowi][coli] })
        }
    }
    return flattened;
}

export type ReactSetState<T> = React.Dispatch<React.SetStateAction<T>>

export function useWindowDimensions() {
    const [dimensions, setDimensions] = useState({ height: window.innerHeight, width: window.innerWidth })
    const setWindowHeight = useCallback(() => {
        return setDimensions({ height: window.innerHeight, width: window.innerWidth })
    }, [setDimensions])
    useEffect(() => {
        window.addEventListener("resize", setWindowHeight);
        return () => window.removeEventListener("resize", setWindowHeight);
    }, [])
    return {
        windowWidth: dimensions.width,
        windowHeight: dimensions.height
    };
}

export function getPxValue(style: CSSStyleDeclaration, key: string) {
    const p = style.getPropertyValue(key)
    return parseInt(p)
}

/** https://stackoverflow.com/a/2450976/15250790 */
export function shuffle<T>(array: Array<T>): T[] {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex > 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

export async function setTimeoutP(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms)
    })
}