import React from "react";
import { createRoot } from 'react-dom/client';
import { Game } from "../main/components/Game"

console.log("test asd")

const urlParams = new URLSearchParams(window.location.search);
const height = parseInt(urlParams.get("height"));
const width = parseInt(urlParams.get("width"));

const appContent = createRoot(document.querySelector("#react-root")!)
appContent.render(<Game width={width} height={height} vsAi={false} />)