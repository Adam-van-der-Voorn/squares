import { Board, _selectLineOnBoard, _unselectLineOnBoard } from "../main/game";
import { KeyedMessageEvent } from "../main/util/promiseWorker";
import { getBestMove } from "./x_lib";

let selectionQueue: string[] = [];

self.onmessage = (ev: KeyedMessageEvent) => {
    // validate message, we expect a board in `message` (lines prop is proof enough) and a key
    // I have no idea why, but it seems that react devtools is triggering this event?
    // so we also validate "type safe" stuff
    const v = ev.data as any;
    if (v?.message?.lines === undefined || v?.key === undefined) {
        return;
    }

    const board = ev.data?.message as Board;
    const key = ev.data?.key
    if (selectionQueue.length === 0) {
        try {
            console.time("ai-move")
            selectionQueue = getBestMove(board);
        }
        catch (e) {
            console.error("ai failed to get a move", e)
        }
        finally {
            console.timeEnd("ai-move")
        }
        console["log"]("new selection queue =", JSON.stringify(selectionQueue))
    }
    else {
        console["log"]("selection queue =", JSON.stringify(selectionQueue))
    }

    const lineKey = selectionQueue[0]
    selectionQueue = selectionQueue.slice(1)
    postMessage({ key, message: lineKey })
}