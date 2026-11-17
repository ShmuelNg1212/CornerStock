import type { CountApi } from "@/lib/count/session";
import { addCountScan, cancelCount, correctCountLine, finishCount, startCount } from "./actions";

/** The count actions of the app, for the count screens. */
export const countApi: CountApi = { start: startCount, scan: addCountScan, finish: finishCount, cancel: cancelCount, correct: correctCountLine };
