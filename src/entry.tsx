import React from "react"
import { createRoot } from 'react-dom/client';

const appContent = createRoot(document.querySelector("#react-root")!)
appContent.render(<p>Hello world</p>)

