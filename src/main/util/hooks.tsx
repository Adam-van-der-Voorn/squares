import { useCallback, useEffect, useState } from "react";

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