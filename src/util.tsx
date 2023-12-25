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

export type ReactSetState<T> = React.Dispatch<React.SetStateAction<T>>