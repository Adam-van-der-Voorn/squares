import { Board, SquaresGame } from '../src/main/game';
import { expect } from '@playwright/test';

export function applyMove(page: any, lineKey: string): Promise<unknown> {
    return applyMoveSeq(page, [lineKey])
}

export function applyMoveSeq(page: any, lineKeys: string[]): Promise<unknown> {
    return page.evaluate(([lineKeys]) => {
        return (window as any)._squares_applyMoveSeq(lineKeys);
    }, [lineKeys])
}

export function getGameState(page: any): Promise<SquaresGame> {
    return page.evaluate(() => {
        return (window as any)._squares_getGameState()
    });
}

export async function checkAiMoveSet(page, state, evalBoard: (board: Board) => string[], expectedMoveSet) {
    try {
        // load page and initial state
        await page.goto(`/test.html?width=${state.cols}&height=${state.rows}`);
        await applyMoveSeq(page, state.moves)

        // game loop
        let actualMoves = [];
        for (let i = 0; i < expectedMoveSet.length; i++) {
            if (actualMoves.length === expectedMoveSet.length) {
                return; // pass
            }
            const game = await getGameState(page);
            expect(game.turn).toBe("p2")
            const chosenLineKeys = await evalBoard(game.board);
            if (chosenLineKeys.length === 0) {
                const s = '[' + actualMoves.join(', ') + ']'
                throw "ai unable to find further move. actuall move set = " + s;
            }
            for (const lk of chosenLineKeys) {
                await applyMove(page, lk);
                actualMoves.push(lk);
                expect(expectedMoveSet).toContain(lk);
            }
        }
    }
    catch (e) {
        // no stack trace in pw errors >:(
        console.error("error:", e);
        console.error("expected move set:", '[' + expectedMoveSet.join(', ') + ']')
        throw e;
    }
}

// not working
function diffMoveSets(expected: string[], actual: string[]): string {
    const actualMoveSeq = `[${actual.join(",")}]`
    const sortedExpected = [...expected]
    sortedExpected.sort()
    const sortedActual = [...actual]
    sortedActual.sort()
    const flr = "----" // filler, same len as a lk
    let s = "";
    let ei, ai = 0;
    while (ei < expected.length || ai < actual.length) {
        const exp = sortedExpected.at(ei);
        const act = sortedActual.at(ai);
        if (exp === undefined) {
            s += `${flr} ${act}\n`
            ai ++;
            continue;
        }
        if (act === undefined) {
            s += `${exp} ${flr}\n`
            ei ++;
            continue;
        }
        if (exp === act) {
            s += `${exp} ${act}\n`
            ai ++;
            ei ++;
            continue;
        }
        const futherExpected = sortedExpected.slice(ei, -1)
        if (futherExpected.includes(act)){
            s += `${flr} ${act}\n`
            ai ++;
            continue;
        }
        s += `${exp} ${flr}\n`
        ei ++;
    }
    return s;
} 

/*
diffMoveSets(["aaaa", "bbbb", "cccc"], ["bbbb", "cccc", "dddd"])
`
a -
b b
c c
- d
`

diffMoveSets(["aaaa", "bbbb", "xxxx", "zzzz"], ["aaaa", "dddd", "yyyy", "zzzz"])
`
a a
b -
x -
- d
- y
z z`
*/