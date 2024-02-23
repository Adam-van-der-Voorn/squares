import { useRef, useEffect, useCallback, useMemo } from "react";

let idPool = 0;

export type KeyedMessageEvent = MessageEvent<{ key: number, message: unknown }>;

export type WorkerRequest = (message: unknown) => Promise<KeyedMessageEvent> | undefined

export function usePromiseWorkerOld(workerFilename: string, workerOpts?: WorkerOptions): WorkerRequest {
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

const noop = () => { return undefined }

export function usePromiseWorker(workerFilename: string | undefined, workerOpts?: WorkerOptions): WorkerRequest {
    if (workerFilename === undefined) {
        return () => { return undefined }
    }
    const internalWorkerRequestRef = useRef<(message: unknown) => Promise<KeyedMessageEvent> | undefined>(noop);

    const workerRequest = useCallback((message: unknown) => {
        return internalWorkerRequestRef.current(message)
    }, [internalWorkerRequestRef])

    useEffect(() => {
        const { workerRequest, terminateWorker } = getPromiseWorker(workerFilename, workerOpts);
        internalWorkerRequestRef.current = workerRequest;
        // cleanup
        return () => terminateWorker()
    }, [workerFilename, workerOpts, internalWorkerRequestRef])

    return workerRequest;
}

export function getPromiseWorker(workerFilename: string, workerOpts?: WorkerOptions) {
    const resolvers: Record<number, any> = {};

    const worker = new Worker(workerFilename, workerOpts);
    worker.onmessage = (ev: KeyedMessageEvent) => {
        const resolve = resolvers[ev.data.key];
        if (resolve === undefined) {
            console.error("worker sent a message without a corresponding resolver, this should never happen")
            return;
        }
        resolve(ev);
        delete resolvers[ev.data.key];
    }

    const terminateWorker = () => {
        worker.terminate()
        // TODO reject promises?
    }

    const workerRequest = (message: unknown) => {
        const id = idPool++;
        // re: race condiiton. The lambda in the promse is run before the message is posted,
        // so the resolver is always set before the message is even sent
        const p = new Promise(resolve => {
            resolvers[id] = resolve;
        }) as Promise<KeyedMessageEvent>
        worker.postMessage({key: id, message});
        return p;
    }

    return { workerRequest, terminateWorker };
}