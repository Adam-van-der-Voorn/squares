import React, { useState } from "react";
import { Game } from "./Game";

type AppState = "menu" | "game";

export function App() {
    const [appState, setAppState] = useState<AppState>("menu");
    
    // fake player input
    const width = 6, height = 6;
    return Game({ width, height, withAI: false })
}