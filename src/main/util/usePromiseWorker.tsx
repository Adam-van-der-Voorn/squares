import { useRef, useEffect, useCallback } from "react";

let idPool = 0;

export type KeyedMessageEvent = MessageEvent<{ key: number, message: unknown }>;

export type WorkerRequest = (message: unknown) => Promise<KeyedMessageEvent> | undefined

export function usePromiseWorker(workerFilename: string, workerOpts?: WorkerOptions): WorkerRequest {
    const worker = useRef<Worker | null>(null);
    const resolvers = useRef<Record<number, any>>({});

    useEffect(() => {
        worker.current = new Worker(workerFilename, workerOpts);
        worker.current.onmessage = (ev: KeyedMessageEvent) => {
            const resolve = resolvers.current[ev.data.key];
            if (resolve === undefined) {
                console.error("worker sent a message without a corresponding resolver, this should never happen")
                return;
            }
            resolve(ev);
            delete resolvers.current[ev.data.key];
        }
        // cleanup
        return () => {
            if (worker.current !== null) {
                worker.current.terminate()
            }
        }
    }, [workerFilename, workerOpts])

    const workerRequest = useCallback((message: unknown) => {
        if (worker?.current === null) {
            return;
        }
        const id = idPool++;
        // re: race condiiton. The lambda in the promse is run before the message is posted,
        // so the resolver is always set before the message is even sent
        const p = new Promise(resolve => {
            resolvers.current[id] = resolve;
        }) as Promise<KeyedMessageEvent>
        worker.current!.postMessage({key: id, message});
        return p;
    }, [])

    return workerRequest;
}