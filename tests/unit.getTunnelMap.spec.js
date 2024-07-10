import { expect, test } from '@playwright/test';
import { getTunnelMap } from '../src/worker_ai/quick/lib'
import { newGame, selectLine } from '../src/main/game';

test('canary - no tunnels', () => {
    const game = newGame(4, 4)
    const tunnels = getTunnelMap(game.board)
    expect(Object.keys(tunnels).length).toEqual(0)
});

test('3 diff donuts', () => {
    const state = {
        "rows": 5,
        "cols": 5,
        "moves":
            ["2,1h", "3,5h", "1,3h", "2,3h", "0,1v", "2,2v", "0,0h", "2,0v", "0,0v", "1,4h", "0,4v", "1,1v", "0,3v", "1,0h", "0,2v", "4,4v", "0,5h", "4,2v", "1,5h", "5,1v", "5,4v", "5,2v", "5,3v", "5,0v", "4,0h", "4,1v", "3,0h", "2,1v", "0,3h", "2,4h", "2,5h", "3,1h", "3,3h", "4,3v", "2,0h"]
    }
    const expected = [
        ["3,0v", "4,0v", "4,1h", "4,2h", "4,3h", "4,4h", "4,5h"],
        ["3,3v", "2,3v", "1,3v", "0,4h", "1,4v", "2,4v", "3,4v", "3,4h"],
        ["3,1v", "2,2h", "3,2v", "3,2h"],
        ["1,1h", "1,0v", "0,1h", "0,2h", "1,2v", "1,2h"]
    ]
    const actual = getTunnelsForState(state)
    expect(actual).toEqual(expected)
});

test('junction', () => {
    const state = {
        "rows": 5,
        "cols": 5,
        "moves":
            ["0,2h", "1,2h", "2,1v", "2,0v", "3,0v", "3,1v", "3,2v", "3,3v", "3,4v", "2,4v", "2,3v", "1,3h", "0,3h"]
    }
    const expected = [
        ["2,3h", "2,4h", "2,5h"],
        ["1,3v", "1,4h"],
        ["2,0h", "2,1h", "2,2h"],
        ["1,1v", "1,1h"],
        ["0,2v", "1,2v", "2,2v"]
    ]
    const actual = getTunnelsForState(state)
    expect(actual).toEqual(expected)
})

function getTunnelsForState({ rows, cols, moves }) {
    const game = newGame(cols, rows)
    for (const x of moves) {
        selectLine(game, x)
    }
    return Object.values(getTunnelMap(game.board))
}



// does not work :(((
function assertAllTunnelEquality(actualSet, expectedSet) {
    for (const actualTunnel of actualSet) {
        if (!expectedSet.find((expectedTunnel) => assertTunnelEquality(actualTunnel, expectedTunnel))) {
            return false;
        }
    }
    return true;
}

function assertTunnelEquality(actual, expected) {
    const a = areTunnelsEqualNoOrder(actual, expected);
    if (a === true) {
        return true;
    }
    const expectedRev = [...expected];
    expectedRev.reverse()
    return areTunnelsEqualNoOrder(actual, expectedRev)

}

function areTunnelsEqualNoOrder(a, b) {
    if (a.length !== b.length) {
        return false;
    }

    // try find b starting index
    let bStartIndex = 0;
    for (let i = 0; i < a.length; i++) {
        const bVal = b[bStartIndex];
        if (a[0] === bVal) {
            break
        }
        bStartIndex = (bStartIndex + 1) % a.length
    }

    // compare tunnels
    console.log("\n\ncompare", a, b)
    for (let i = 0; i < a.length; i++) {
        const bIdx = (i + bStartIndex) % a.length
        console.log(a[i], "=", b[bIdx])
        if (a[i] != b[bIdx]) {
            return false;
        }
    }

    return true;
}