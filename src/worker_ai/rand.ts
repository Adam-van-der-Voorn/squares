import { SquaresGame, selectLine } from "../main/game";

export function doAiMove(squaresGame: SquaresGame): void {
    console.log("AI: choosing move")
    const avalibleLineKeys = Object.entries(squaresGame.board.lines)
        .filter(e => !e[1].selected)
        .map(e => e[0])
        
    const randNum = Math.floor(Math.random() * avalibleLineKeys.length);
    selectLine(squaresGame, avalibleLineKeys[randNum])
    console.log("AI: chose line", avalibleLineKeys[randNum])
}