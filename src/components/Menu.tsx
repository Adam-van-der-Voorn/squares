import React, { useState } from "react";

export type Props = {
    onStart: (width: number, height: number, vsAi: boolean) => void
}

const MIN_DOTS = 4, MAX_DOTS = 30;

export function Menu({ onStart }: Props) {
    const [width, setWidth] = useState("6");
    const [height, setHeight] = useState("6");

    const parse = (ev: React.ChangeEvent<HTMLInputElement>, set: any) => {
        const val = ev.target.value;
        if (val === "") {
            set(val);
        }
        let num = parseInt(val);
        if (isNaN(num) || num > MAX_DOTS) {
            return;
        }
        set(val)
    }

    const handleSumbit = (ev: React.ChangeEvent<HTMLFormElement>) => {
        ev.preventDefault();
        const widthNum = parseInt(width);
        const heightNum = parseInt(height);
        if (isNaN(widthNum) || isNaN(heightNum)) {
            return;
        }

        // ok so
        // we minus 1 from each varible as the varibles represent the number of cells
        // but it makes more sense to be th number of dots
        onStart(widthNum - 1, heightNum - 1, false)
    }

    return <div>
        <form onSubmit={handleSumbit}>
            <input type="text" name="width" value={width} onChange={ev => parse(ev, setWidth)} />
            <input type="text" name="width" value={height} onChange={ev => parse(ev, setHeight)} />
            <input type="submit" />
        </form>
    </div>

}