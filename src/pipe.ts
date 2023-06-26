export type ForwardingFunction<T = unknown> = (payload: T) => Promise<void>;
export type ReplyingFunction<T = unknown> = (ret: T) => void;

// The interface that control the pipeline flow
export interface PipeControl<TForwardingResult, TReplyingResult> {
    forward: ForwardingFunction<TForwardingResult>;
    reply: ReplyingFunction<TReplyingResult>;
}

// The type of functions that can be used within a pipeline
type PipeFunction<TPayload = unknown, TForwardingResult = unknown, TReplyingResult = unknown> = (
    payload: TPayload,
    control: PipeControl<TForwardingResult, TReplyingResult>,
) => void | Promise<void>;

// Either a PipeFunction or a Pipe can be used within a pipeline
export type PipeLike<TPayload = unknown, TForwardingResult = unknown, TReplyingResult = unknown> =
    | PipeFunction<TPayload, TForwardingResult, TReplyingResult>
    | Pipe<TPayload, TForwardingResult, TReplyingResult>;

// Type aliases to simplify code
export type AnyPipeLike = PipeLike<any, any, any>;
export type AnyPipe = Pipe<any, any, any>;
export type InputTypeOf<TPipeLike extends AnyPipeLike> = TPipeLike extends PipeLike<infer TPayload, any, any>
    ? TPayload
    : never;
export type ForwardingResultOf<TPipeLike extends AnyPipeLike> = TPipeLike extends PipeLike<
    any,
    infer TForwardingResult,
    any
>
    ? TForwardingResult
    : never;
export type ReplyingResultOf<TPipeLike extends AnyPipeLike> = TPipeLike extends PipeLike<
    any,
    any,
    infer TReplyingResult
>
    ? TReplyingResult
    : never;

// The type of functions that can be subscribed to the pipeline
type Subscriber<TResult> = (result: TResult) => void | Promise<void>;

export function isPipeLike(pipe: any): boolean {
    return pipe instanceof Pipe || typeof pipe === 'function';
}

// The main class representing a pipeline of operations
export class Pipe<TPayload = unknown, TForwardingResult = unknown, TReplyingResult = unknown> {
    private pipeFunctions: PipeFunction<any, any, any>[] = [];
    private subscribers: Subscriber<TForwardingResult>[] = [];

    public static forwardingPipe<TPayload = unknown, TForwardingResult = TPayload>(
        fn: (payload: TPayload) => TForwardingResult | Promise<TForwardingResult>,
    ): Pipe<TPayload, TForwardingResult, undefined> {
        return Pipe.from<PipeLike<TPayload, TForwardingResult, undefined>>(async (payload, { forward }) => {
            await forward(await fn(payload));
        });
    }

    public static replyingPipe<TPayload = unknown, TReplyingResult = TPayload>(
        fn: (payload: TPayload) => TReplyingResult | Promise<TReplyingResult>,
    ): Pipe<TPayload, undefined, TReplyingResult> {
        return Pipe.from<PipeLike<TPayload, undefined, TReplyingResult>>(async (payload, { reply }) => {
            reply(await fn(payload));
        });
    }

    public static from<T extends AnyPipeLike>(
        pipeLike: T,
    ): Pipe<InputTypeOf<T>, ForwardingResultOf<T>, ReplyingResultOf<T>> {
        return new Pipe<InputTypeOf<T>, any, ReplyingResultOf<T>>().extend(pipeLike);
    }

    private static assertIsPipeLike(pipeLike: unknown): asserts pipeLike is AnyPipeLike {
        if (!isPipeLike(pipeLike)) {
            throw new Error(`'${pipeLike}' is not a 'PipeLike'`);
        }
    }

    public extend<TForwardingResultPipeLike extends PipeLike<TForwardingResult, any, any>>(
        pipeLike: TForwardingResultPipeLike,
    ): Pipe<
        TPayload,
        ForwardingResultOf<TForwardingResultPipeLike>,
        TReplyingResult | ReplyingResultOf<TForwardingResultPipeLike>
    > {
        Pipe.assertIsPipeLike(pipeLike);

        if (this.hasSubscribers) {
            throw new Error('Cannot extend a pipe that has subscribers. You should clone it first.');
        }

        const newPipe = this.clone();
        newPipe.copyPipeFunctionsFrom(pipeLike);
        return newPipe as Pipe<TPayload, ForwardingResultOf<TForwardingResultPipeLike>, TReplyingResult>;
    }

    private get hasSubscribers(): boolean {
        return this.subscribers.length > 0;
    }

    private copyPipeFunctionsFrom(pipeLike: AnyPipeLike): void {
        if (pipeLike instanceof Pipe) {
            this.pipeFunctions.push(...pipeLike.pipeFunctions);
        } else {
            this.pipeFunctions.push(pipeLike);
        }
    }

    public async send(payload: TPayload): Promise<TReplyingResult> {
        return await this.processPayload(payload, false);
    }

    public async blockingSend(payload: TPayload): Promise<TReplyingResult> {
        return await this.processPayload(payload, true);
    }

    // Process payload and optionally wait for subscribers
    private async processPayload(payload: TPayload, shouldWaitForSubscribers: boolean): Promise<TReplyingResult> {
        let replyResult!: TReplyingResult;
        let didReceiveReply = false;

        const finalExecution = async (finalResult: TForwardingResult) => {
            const p = this.notifySubscribers(finalResult);
            if (shouldWaitForSubscribers) {
                await p;
            }
        };

        const executionChain = this.pipeFunctions.reduceRight((chain, pipeFunction) => {
            return async (payload: any) => {
                const next = async (payload: any) => {
                    if (didReceiveReply) {
                        return;
                    }

                    await chain(payload);
                };
                const reply = (result: any) => {
                    replyResult = result;
                    didReceiveReply = true;
                };

                await pipeFunction(payload, { forward: next, reply });
            };
        }, finalExecution);

        await executionChain(payload as any);

        return replyResult;
    }

    private async notifySubscribers(finalResult: TForwardingResult): Promise<void> {
        await Promise.allSettled(this.subscribers.map((subscriber) => subscriber(finalResult)));
    }

    public subscribe(
        subscriber: TForwardingResult extends never | undefined ? never : Subscriber<TForwardingResult>,
    ): void {
        this.subscribers.push(subscriber);
    }

    public clone(): Pipe<TPayload, TForwardingResult, TReplyingResult> {
        const newPipe = new Pipe<TPayload, TForwardingResult, TReplyingResult>();
        newPipe.pipeFunctions = [...this.pipeFunctions];
        return newPipe;
    }

    public routeTo<TForwardingResultPipe extends Pipe<TForwardingResult, any, any>>(
        pipe: TForwardingResultPipe,
    ): Pipe<TPayload, TForwardingResult, TReplyingResult> {
        this.subscribe(((payload: TForwardingResult) => pipe.send(payload)) as any);
        return this;
    }
}
