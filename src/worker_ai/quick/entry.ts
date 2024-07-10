import { getMoveSequence } from "./lib";
import { getAiOnMessage } from "../getAiOnMessage";

self.onmessage = getAiOnMessage(getMoveSequence)

