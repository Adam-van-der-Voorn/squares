import { expect, test } from '@playwright/test';
import { getTunnelMap } from '../src/worker_ai/quick/lib'
import { newGame, selectLine } from '../src/main/game';

test('canary - no tunnels', () => {
    const game = newGame(4, 4)
    const tunnels = getTunnelMap(game.board)
    expect(Object.keys(tunnels).length).toEqual(0)
});

test.skip('3 diff donuts', () => {
    const state = {
        "rows": 5,
        "cols": 5,
        "moves":
            ["2,1h", "3,5h", "1,3h", "2,3h", "0,1v", "2,2v", "0,0h", "2,0v", "0,0v", "1,4h", "0,4v", "1,1v", "0,3v", "1,0h", "0,2v", "4,4v", "0,5h", "4,2v", "1,5h", "5,1v", "5,4v", "5,2v", "5,3v", "5,0v", "4,0h", "4,1v", "3,0h", "2,1v", "0,3h", "2,4h", "2,5h", "3,1h", "3,3h", "4,3v", "2,0h"]
    }
    const expected = [] // TODO
    const actual = getTunnelsForState(state)
    expect(actual).toEqual(expected)
});

function getTunnelsForState({ rows, cols, moves }) {
    const game = newGame(cols, rows)
    for (const x of moves) {
        selectLine(game, x)
    }
    return getTunnelMap(game.board)
}