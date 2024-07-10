import { getBestMove } from "./lib";
import { getAiOnMessage } from "../getAiOnMessage";

self.onmessage = getAiOnMessage(getBestMove)
