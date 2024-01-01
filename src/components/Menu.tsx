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

    const handleSumbit = ({ withAI }: { withAI: boolean}) => {
        const msg = "Pretty big board bro. You wanna go there?";
        if (isSubmitAllowed === "ask" && !confirm(msg)) {
            return;
        }
        // ok so
        // we minus 1 from each varible as the varibles represent the number of cells
        // but it makes more sense to be th number of dots
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

    return <div>
        <input type="text" name="width" value={width} placeholder={`${MIN_DOTS}`} onChange={ev => parse(ev, setWidth)} />
        <input type="text" name="width" value={height} placeholder={`${MIN_DOTS}`} onChange={ev => parse(ev, setHeight)} />
        <button disabled={isSubmitAllowed === false} onClick={() => handleSumbit({withAI: true})}>Play the computer</button>
        <button disabled={isSubmitAllowed === false} onClick={() => handleSumbit({withAI: false})}>Two player game</button>
    </div>

}