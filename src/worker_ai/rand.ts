import { Board } from "../main/game";
import { KeyedMessageEvent } from "../main/util/promiseWorker";

self.onmessage = (ev: KeyedMessageEvent) => {
    // validate message, we expect a baord in `message` (lines prop is proof enough) and a key
    // I have no idea why, but it seems that react devtools is triggering this event?
    // so we also validate "type safe" stuff
    const v = ev.data as any;
    if (v?.message?.lines === undefined || v?.key === undefined) {
        return;
    }

    const board = ev.data?.message as Board;
    const key = ev.data?.key
     
    console.log("AI: choosing move", ev)
    const avalibleLineKeys = Object.entries(board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0])

    let randNum = 0;
    for (let i = 0; i < 999999; i++) {
        randNum = Math.floor(Math.random() * avalibleLineKeys.length);
    }
    const choice = avalibleLineKeys[randNum];
    postMessage({ key, message: choice });
    console.log("AI: chose line", choice)
};
// }
