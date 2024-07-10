import { getBestMove } from '../src/worker_ai/quick/lib';
import { test } from '@playwright/test';
import { checkAiMoveSet } from './test_lib';

test('easy decision 1', async ({ page }) => {
    const state = {"rows":2,"cols":2,"moves":["0,0h","1,0h","2,0v","2,1v","1,2h","0,2h","0,1v","0,0v","0,1h","1,0v","1,1h"]}
    const expectedMoveSet = ["1,1v"];
    await checkAiMoveSet(page, state, (board) => getBestMove(board), expectedMoveSet);
});

test('easy decision 2', async ({ page }) => {
    const state = {"rows":2,"cols":2,"moves":["0,0h","1,0h","2,0v","2,1v","1,2h","0,2h","0,1v","0,0v","0,1h"]}
    const expectedMoveSet = ["1,0v", "1,1h", "1,1v"];
    await checkAiMoveSet(page, state, (board) => getBestMove(board), expectedMoveSet);
});

test('easy decision 3', async ({ page }) => {
    const state = {
        "rows": 2,
        "cols": 2,
        "moves": [
            "1,0h", "2,1v", "0,0h", "1,1h", "0,0v", "0,1v", "1,1v", "1,2h", "0,1h", "2,0v"
        ]
    }
    const expectedMoveSet = ["0,2h", "1,0v"];
    await checkAiMoveSet(page, state, (board) => getBestMove(board), expectedMoveSet);
});

test('ai completes closed tunnel', async ({ page }) => {
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
    await checkAiMoveSet(page, state, (board) => getBestMove(board), expectedMoveSet);
});

test('ai completes half open tunnel', async ({ page }) => {
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
    
    await checkAiMoveSet(page, state, (board) => getBestMove(board), expectedMoveSet);
});

test(`ai holds of on completing half open tunnel so it can claim bigger one
(inital state p1 is winning, but p2 has a chance)`, async ({ page }) => {
    const state = {
        "rows":5,
        "cols":5,
        "moves":[
            "0,0h","2,4h","0,1h","4,0v","1,2h","3,3h","2,3h","5,2v","5,2v","4,0h","3,3v","1,0h","1,2v","4,3v",
            "5,1v","5,4v","3,2h","3,2v","3,4v","1,1h","1,3h","0,2v","0,3h","1,0v","2,2h","1,4v","4,2v","2,1h",
            "5,0v","1,5h","2,4v","3,0h","4,4h","2,2v","0,4v","2,3v","2,0v","0,0v","0,3v","0,2h","2,5h","3,4h",
            "3,1h","4,4v","4,1h","3,5h","3,0v","3,2v","4,5h","2,0h"
        ]
    }
    const expectedMoveSet = ["1,4h", "1,3v", "0,5h"];
    await checkAiMoveSet(page, state, (board) => getBestMove(board), expectedMoveSet);
});

test('ai fully completes closed loop', async ({ page }) => {
    const state = {
        "rows":5,
        "cols":5,
        "moves":[
            "2,1h","3,5h","1,3v","2,3h","1,1v","2,2v","0,0v","3,0v","0,1v","1,4h","0,2v","2,1v","0,3v","1,5h",
            "0,4v","0,0h","0,5h","5,2v","2,5h","1,2v","5,4v","5,1v","4,5h","5,0v","5,3v","2,4h","3,3h","3,0h",
            "3,4h","4,0h","1,0h","4,1v","3,2h","4,3h","2,0v","2,0h","4,2v","3,2v","2,2h","3,1v","3,1h","4,0v",
            "4,1h","4,2h","4,4h"
        ]
    }

    const expectedMoveSet = ["4,4v","3,4v","2,4v","1,4v","0,4h","0,3h","0,2h","0,1h","1,0v", "1,1h","1,2h","1,3h","2,3v","3,3v","4,3v"];
    await checkAiMoveSet(page, state, (board) => getBestMove(board), expectedMoveSet);
});