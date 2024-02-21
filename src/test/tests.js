// @ts-nocheck
import { gameWithState, test } from "./testrunner";
import { getPromiseWorker } from "../main/util/promiseWorker";


test("ai chooses loop", async () => {
    const { workerRequest: evalBoard, terminateWorker } = getPromiseWorker("ai.worker.x.bundle.js", { type: "module" });
    const state = {
        "rows": 5,
        "cols": 5,
        "moves": [
            "2,1v", "3,2v", "4,1v", "4,2v", "4,3v", "4,4v", "3,5h", "3,3v", "2,5h",
            "2,4v", "2,3v", "2,2v", "2,1h", "3,1h", "0,1h", "1,0v", "1,2v", "1,3v",
            "1,4v", "0,5h", "0,3v", "0,2v", "0,1v", "1,0h", "2,0h", "3,0h", "4,0h",
            "5,0v", "5,1v", "5,2v", "5,3v", "5,4v"
        ]
    }
    const game = gameWithState(state)
    // ... what should the chosen be? 
    const expectedMoveSet = ["5,4v","3,1v","3,2h","3,3h","3,4h","3,4v","2,4h","2,3h","2,2h"];
    for (let i = 0; i < expectedMoveSet.length; i++) {
        const result = await evalBoard(game.board);
        const chosenLineKey = result?.data?.message;
        if (!expectedMoveSet.includes(chosenLineKey)) {
            terminateWorker()
            return "chosen line key " + chosenLineKey + " not in expected moveset";
        }
    }
    terminateWorker()
})