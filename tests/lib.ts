import { SquaresGame } from '../src/main/game';
import { expect } from '@playwright/test';

export function selectLine(page: any, lineKey: string): Promise<unknown> {
    return bulkSelectLines(page, [lineKey])
}

export function bulkSelectLines(page: any, lineKeys: string[]): Promise<unknown> {
    return page.evaluate(([lineKeys]) => {
        return (window as any)._squares_applyMoveSeq(lineKeys);
    }, [lineKeys])
}

export function getGameState(page: any): Promise<SquaresGame> {
    return page.evaluate(() => {
        return (window as any)._squares_getGameState()
    });
}

export async function aiTest(page, state, evalBoard, expectedMoveSet) {
    try {
        // load page and initial state
        await page.goto(`/test.html?width=${state.cols}&height=${state.rows}`);
        await bulkSelectLines(page, state.moves)

        // game loop
        let actualMoves = [];
        for (let i = 0; i < expectedMoveSet.length; i++) {
            if (actualMoves.length === expectedMoveSet.length) {
                return; // pass
            }
            const game = await getGameState(page);
            expect(game.turn).toBe("p2")
            const chosenLineKey = await evalBoard(game.board);
            await selectLine(page, chosenLineKey);
            actualMoves.push(chosenLineKey);
            expect(expectedMoveSet).toContain(chosenLineKey);
        }
    }
    catch (e) {
        // no stack trace in pw errors >:(
        console.error("error:", e);
        throw e;
    }
}