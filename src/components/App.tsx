import React, { useState } from "react";
import { Game } from "./Game";
import { Menu } from "./Menu";

type AppState =
"menu" |
{ name: "game", width: number, height: number, withAI: boolean };

export function App() {
    const [appState, setAppState] = useState<AppState>("menu");

    if (appState === "menu") {
        return <Menu onStart={(width, height, withAI) => setAppState({ name: "game", width, height, withAI })}/>
    }
    else {
        const { width, height, withAI } = appState;
        return <Game width={width} height={height} vsAI={withAI} />
    }
}