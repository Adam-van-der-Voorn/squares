import { Board } from "../main/game"

export type GetMoveSequence = (board: Board, rng?: () => number) => string[]
