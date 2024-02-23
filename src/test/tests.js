// @ts-nocheck
import { aiTest, test } from "./testrunner";
import { getPromiseWorker } from "../main/util/promiseWorker";


test("ai chooses loop", async () => {
    const state = {
        "rows": 5,
        "cols": 5,
        "moves": [
            "2,1v", "3,2v", "4,1v", "4,2v", "4,3v", "4,4v", "3,5h", "3,3v", "2,5h",
            "2,4v", "2,3v", "2,2v", "2,1h", "3,1h", "0,1h", "1,0v", "1,2v", "1,3v",
            "1,4v", "0,5h", "0,3v", "0,2v", "0,1v", "1,0h", "2,0h", "3,0h", "4,0h",
            "5,0v", "5,1v", "5,2v", "5,3v"
        ]
    }
    const expectedMoveSet = ["5,4v", "3,1v", "3,2h", "3,3h", "3,4h", "3,4v", "2,4h", "2,3h", "2,2h"];
    const { workerRequest: evalBoard, terminateWorker } = getPromiseWorker("ai.worker.x.bundle.js", { type: "module" });
    const res = await aiTest(state, evalBoard, expectedMoveSet);
    terminateWorker()
    return res;
})

test("ai chooses loop 2", async () => {
    const state = {
        "rows": 5,
        "cols": 5,
        "moves": [
            "0,1h", "4,4h", "1,1v", "2,4h", "1,2v", "1,1h", "1,3v", "0,3h", "1,4v", "4,1h", "1,5h", "3,0v",
            "2,5h", "2,0v", "2,2v", "5,2v", "3,2v", "5,1v", "4,2v", "4,5h", "4,0h", "5,3v", "0,0h", "3,0h",
            "0,4v", "3,3v", "3,4h", "3,1v", "3,5h", "2,0h", "2,1h", "0,5h", "0,4h", "0,3v", "1,0h", "0,2v",
            "0,2h", "1,0v", "0,0v", "0,1v", "3,1h", "5,0v", "4,0v", "5,4v", "4,4v", "3,4v", "1,4h", "2,4v",
            "1,2h", "1,3h", "2,3v", "2,3h", "2,2h", "2,1v", "3,2h"
        ]
    }
    const expectedMoveSet = ["4,1v", "4,2h", "4,3h", "4,3v", "3,3h"];
    const { workerRequest: evalBoard, terminateWorker } = getPromiseWorker("ai.worker.x.bundle.js", { type: "module" });
    const res = await aiTest(state, evalBoard, expectedMoveSet);
    terminateWorker()
    return res;
})

test("ai chooses half open tunnel", async () => {
    const state = {
        "rows":5,
        "cols":5,
        "moves":[
            "2,0v","0,1v","3,1v","4,4h","3,2v","4,0h","3,3v","0,2v","3,4h","2,1h","2,4v","0,0v","1,4h","2,4h",
            "1,2v","5,1v","1,2h","5,2v","1,0v","3,2h","0,4h","4,1h","4,5h","0,3v","4,2v","3,3h","4,3v","3,0h",
            "0,5h","1,1v","3,5h","2,2v","1,3h","3,0v","2,0h","0,4v","1,4v","1,5h","2,5h","3,4v","4,4v","5,0v",
            "4,0v","3,1h","4,1v","4,2h","4,3h","5,3v","5,4v","1,0h"
        ]
    }
    const expectedMoveSet = ["1,1h", "2,1v", "2,2h", "2,3h", "2,3v", "1,3v", "0,3h", "0,2h", "0,1h", "0,0h"];
    const { workerRequest: evalBoard, terminateWorker } = getPromiseWorker("ai.worker.x.bundle.js", { type: "module" });
    const res = await aiTest(state, evalBoard, expectedMoveSet);
    terminateWorker()
    return res;
})