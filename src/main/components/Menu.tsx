import React, { useState } from "react";

export type Props = {
    onStart: (width: number, height: number, vsAi: boolean) => void
}

const MIN_DOTS = 2, MAX_DOTS = 30;

export function Menu({ onStart }: Props) {
    const [width, setWidth] = useState("6");
    const [height, setHeight] = useState("6");
    const widthNum = parseInt(width);
    const heightNum = parseInt(height);

    const parse = (ev: React.ChangeEvent<HTMLInputElement>, set: any) => {
        const val = ev.target.value;
        if (val === "") {
            set(val);
        }
        let num = parseInt(val);
        if (isNaN(num)) {
            return;
        }
        set(val)
    }

    const handleSumbit = ({ withAI }: { withAI: boolean }) => {
        const msg = "Pretty big board bro. You wanna go there?";
        if (isSubmitAllowed === "ask" && !confirm(msg)) {
            return;
        }
        // ok so
        // we minus 1 from each varible as the varibles represent the number of cells
        // but it makes more sense to be the number of dots, so the inputs are that
        onStart(widthNum - 1, heightNum - 1, withAI)
    }

    let isSubmitAllowed: true | false | "ask";
    if (isNaN(widthNum) || isNaN(heightNum) || widthNum < MIN_DOTS || heightNum < MIN_DOTS) {
        isSubmitAllowed = false;
    }
    else if (widthNum > MAX_DOTS || heightNum > MAX_DOTS) {
        isSubmitAllowed = "ask";
    }
    else {
        isSubmitAllowed = true;
    }

    const cat = "img/cat.jpeg"

    return <div className="menu-container">
        <button className="menu-card menu-button-a" disabled={isSubmitAllowed === false} onClick={() => handleSumbit({ withAI: true })}>
            <img className="player-img" src={cat}></img>
            <p>Play the computer</p>
        </button>
        <button className="menu-card menu-button-b" disabled={isSubmitAllowed === false} onClick={() => handleSumbit({ withAI: false })}>
            <img className="player-img" src={cat}></img>
            <p>Two player game</p>
        </button>
        <div className="menu-card menu-inputs">
            <div className="dots-input-container">
                <label className="dots-input-label" htmlFor="width-inp">Width:</label>
                <input className="dots-input dots-input-width" type="text" id="width-inp" value={width} placeholder={`${MIN_DOTS}`} autoComplete="off" onChange={ev => parse(ev, setWidth)} />
            </div>
            <div className="dots-input-container">
            <label className="dots-input-label" htmlFor="height-inp">Height:</label>
                <input className="dots-input dots-input-height" type="text" id="height-inp" value={height} placeholder={`${MIN_DOTS}`} autoComplete="off" onChange={ev => parse(ev, setHeight)} />
            </div>
        </div>
    </div>

}