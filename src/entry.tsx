import React from "react"
import { createRoot } from 'react-dom/client';
import { App } from "./components";

const appContent = createRoot(document.querySelector("#react-root")!)
appContent.render(<App />)