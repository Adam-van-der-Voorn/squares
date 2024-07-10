export function unpack<T>(arr: T[][]) {
    // assume outer is rows, inner is cols
    const height = arr.length
    const width = arr[0].length
    const flattened = []
    for (let rowi = 0; rowi < height; rowi++) {
        for (let coli = 0; coli < width; coli++) {
            flattened.push({ x: coli, y: rowi, val: arr[rowi][coli] })
        }
    }
    return flattened;
}

/** https://stackoverflow.com/a/2450976/15250790 */
export function shuffle<T>(array: Array<T>, seed?: number): T[] {
    const rand = seed
        ? mulberry32(seed)
        : Math.random
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex > 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(rand() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

export async function setTimeoutP(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms)
    })
}

function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}