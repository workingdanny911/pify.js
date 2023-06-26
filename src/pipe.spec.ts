/* eslint @typescript-eslint/no-unused-vars: 0 */

import { AnyPipe, ForwardingFunction, Pipe, PipeLike } from "./pipe";

describe('Pipe', () => {
    beforeAll(() => {
        jest.setTimeout(1000);
    });

    test('pipe can only be created from a function or a pipe', () => {
        // @ts-expect-error
        expect(() => Pipe.from()).toThrowError(/.*is not a 'PipeLike'.*/);
        // @ts-expect-error
        expect(() => Pipe.from(null)).toThrowError(/.*is not a 'PipeLike'.*/);
        // @ts-expect-error
        expect(() => Pipe.from(['a', 'b'])).toThrowError(/.*is not a 'PipeLike'.*/);
        // @ts-expect-error
        expect(() => Pipe.from({})).toThrowError(/.*is not a 'PipeLike'.*/);
        // @ts-expect-error
        expect(() => Pipe.from(1)).toThrowError(/.*is not a 'PipeLike'.*/);
    });

    test('creating from function', () => {
        expect(
            Pipe.from(() => {
                return;
            }),
        ).toBeInstanceOf(Pipe);
        expect(
            Pipe.from<PipeLike<number>>((payload, { forward, reply }) => {
                return;
            }),
        ).toBeInstanceOf(Pipe);
    });

    test('creating from pipe', () => {
        expect(
            Pipe.from(
                Pipe.from(() => {
                    return;
                }),
            ),
        ).toBeInstanceOf(Pipe);
    });

    test('creating from function for forwarding', () => {
        expect(Pipe.forwardingPipe(() => 'foo')).toBeInstanceOf(Pipe);
    });

    test('creating from function for replying', () => {
        expect(Pipe.replyingPipe(() => 'foo')).toBeInstanceOf(Pipe);
    });

    it('can reply', async () => {
        expect(await Pipe.from((payload: number, { reply }) => reply(payload + 1)).send(0)).toBe(1);
        expect(await Pipe.replyingPipe((payload: number) => payload + 1).send(0)).toBe(1);
    });

    test('each send creates a new context', async () => {
        const pipe = Pipe.from((payload: number, { reply }) => reply(payload + 1));

        const results = await Promise.all(Array.from({ length: 10 }).map(() => pipe.send(0)));

        expect(results).toEqual(Array.from({ length: 10 }).map(() => 1));
    });

    test('return value is used as reply if created for replying', async () => {
        const pipe = Pipe.replyingPipe(() => 'foo');

        const result = await pipe.send(null);

        expect(result).toBe('foo');
    });

    it('notifies subscribers with value forwarded from the last pipe', async () => {
        await new Promise((resolve) => {
            const initialValue = 0;
            const pipe = Pipe.forwardingPipe<number>((payload) => payload + 1);

            pipe.subscribe((result) => {
                expect(result).toBe(initialValue + 1);
                resolve(undefined);
            });

            pipe.send(initialValue);
        });
    });

    test('return value is used as relay value if created for forwarding', async () => {
        await new Promise((resolve) => {
            const pipe = Pipe.forwardingPipe(() => 'foo');

            pipe.subscribe((result) => {
                expect(result).toBe('foo');
                resolve(undefined);
            });

            pipe.send(null);
        });
    });

    it('does not notify subscribers if replied', async () => {
        const pipe = Pipe.replyingPipe(() => null);
        const subscriber = jest.fn();

        // @ts-expect-error
        pipe.subscribe(subscriber);

        await pipe.blockingSend(null);
        expect(subscriber).not.toHaveBeenCalled();
    });

    test('multiple subscribers', async () => {
        await new Promise((resolve) => {
            const pipe = Pipe.forwardingPipe(() => null);
            let callCount = 0;

            function resolver() {
                if (++callCount === 2) {
                    resolve(undefined);
                }
            }

            pipe.subscribe(resolver);
            pipe.subscribe(resolver);

            pipe.send(undefined);
        });
    });

    it('does not wait for subscribers to complete execution', async () => {
        let isSubscriberExecutionCompleted = false;
        const pipe = Pipe.forwardingPipe(() => null);
        pipe.subscribe(async () => {
            await new Promise((resolve) => {
                setTimeout(() => {
                    isSubscriberExecutionCompleted = true;
                    resolve(undefined);
                }, 0);
            });
        });

        await pipe.send(null);

        expect(isSubscriberExecutionCompleted).toBe(false);
    });

    it('waits for all subscribers to complete execution when client sends payload in blocking mode', async () => {
        const numberOfListeners = 5;
        let numberOfListenersNotified = 0;
        const pipe = Pipe.forwardingPipe(() => null);

        for (let i = 0; i < numberOfListeners; i++) {
            pipe.subscribe(async () => {
                await new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(undefined);
                    }, i * 10);
                });

                numberOfListenersNotified++;
            });
        }

        await pipe.blockingSend(null);

        expect(numberOfListenersNotified).toBe(numberOfListeners);
    });

    it('keeps going even when some of the subscribers fail', async () => {
        const numberOfListeners = 5;
        let isLastListenerNotified = false;
        const pipe = Pipe.forwardingPipe(() => null);

        for (let i = 0; i < numberOfListeners; i++) {
            pipe.subscribe(async () => {
                if (i < numberOfListeners - 1) {
                    throw new Error(`Listener ${i} failed`);
                }

                await new Promise((resolve) => {
                    setTimeout(() => {
                        isLastListenerNotified = true;
                        resolve(undefined);
                    });
                });
            });
        }
        await pipe.blockingSend(0);

        expect(isLastListenerNotified).toBe(true);
    });

    it('can clone itself', async () => {
        const pipe = Pipe.replyingPipe(() => 'original');
        const clonedPipe = pipe.clone();

        expect(await clonedPipe.send(null)).toBe('original');

        expect(clonedPipe).not.toBe(pipe);
    });

    const CLONING_METHODS = [(pipe: AnyPipe) => Pipe.from(pipe), (pipe: AnyPipe) => pipe.clone()];
    test.each(CLONING_METHODS)('cloned pipe does not preserve subscribers of the original pipe', async (clone) => {
        const pipe = Pipe.forwardingPipe(() => null);
        const subscriber = jest.fn();
        pipe.subscribe(subscriber);

        const clonedPipe = clone(pipe);

        await clonedPipe.send(null);

        expect(subscriber).not.toHaveBeenCalled();
    });

    it('returns a new, extended instance', async () => {
        const pipe = Pipe.from<PipeLike<number, number>>((payload, { forward }) => forward(payload));

        const extendedPipe = pipe.extend(Pipe.replyingPipe((payload: number) => payload + 1));

        expect(extendedPipe).not.toBe(pipe);
    });

    it('can be extended with a pipe function', async () => {
        const result = await Pipe.forwardingPipe((payload: number) => payload)
            .extend((payload, { forward }: { forward: ForwardingFunction<number> }) => forward(payload + 1))
            .extend((payload, { reply }) => reply(payload + 1))
            .send(0);

        expect(result).toBe(2);
    });

    it('throws error when trying to extend with not a PipeLike', () => {
        // @ts-expect-error
        expect(() => Pipe.from(() => null).extend(null)).toThrowError(/.*is not a 'PipeLike'.*/);
        // @ts-expect-error
        expect(() => Pipe.from(() => null).extend(1)).toThrowError(/.*is not a 'PipeLike'.*/);
        // @ts-expect-error
        expect(() => Pipe.from(() => null).extend({})).toThrowError(/.*is not a 'PipeLike'.*/);
        // @ts-expect-error
        expect(() => Pipe.from(() => null).extend(['a', 'b'])).toThrowError(/.*is not a 'PipeLike'.*/);
    });

    it('throws error when trying to extend if it has subscribers', async () => {
        const pipe = Pipe.forwardingPipe(() => null);
        pipe.subscribe(() => {
            return;
        });

        expect(() => pipe.extend(Pipe.forwardingPipe(() => null))).toThrowError(/.*has subscribers.*/);
    });

    test('when extending pipe A with pipe B, payloads sent through pipe A does not affect pipe B', async () => {
        const pipeA = Pipe.forwardingPipe(() => null);
        const pipeB = Pipe.forwardingPipe(() => null);
        const pipeA_B = pipeA.extend(pipeB);
        const pipeBSubscriber = jest.fn();
        const pipeA_BSubscriber = jest.fn();
        pipeB.subscribe(pipeBSubscriber);
        pipeA_B.subscribe(pipeA_BSubscriber);

        await pipeA_B.blockingSend(0);

        expect(pipeBSubscriber).not.toHaveBeenCalled();
        expect(pipeA_BSubscriber).toHaveBeenCalledTimes(1);
    });

    test('pipe function nests the next pipe function call stack with its own', async () => {
        const pipeA = Pipe.from(async (payload, { forward }) => {
            try {
                await forward(payload);
            } catch (error) {
                expect((error as Error).message).toBe('error from pipeB');
                throw new Error('pipe A caught error from pipe B');
            }
        });
        const pipeB = Pipe.from((payload, { forward }) => {
            throw new Error('error from pipeB');
        });
        const pipeA_B = pipeA.extend(pipeB);

        await expect(pipeA_B.send(null)).rejects.toThrowError('pipe A caught error from pipe B');
    });

    test('pipes can be async', async () => {
        const ret = await Pipe.forwardingPipe(async (payload: number) => payload)
            .extend(
                Pipe.forwardingPipe(async (payload: number) => {
                    return await new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(payload + 1);
                        }, 0);
                    });
                }),
            )
            .extend(
                Pipe.replyingPipe(async (payload: number) => {
                    return await new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(payload + 1);
                        }, 0);
                    });
                }),
            )
            .send(0);

        expect(ret).toBe(2);
    });

    it('aborts pipe processing in the middle when one of the pipes replies', async () => {
        const pipeMock = jest.fn();

        await Pipe.replyingPipe(() => 'replied at the beginning')
            .extend(pipeMock)
            .send(null);

        expect(pipeMock).not.toHaveBeenCalled();
    });

    // the main difference between extending a pipe and routing to a pipe to another pipe is that
    // extending a pipe will clone the pipe extending and the target and return a new instance,
    // while routing will return the same instance and will not clone any pipes
    // this means that routing to a pipe will preserve the subscribers of both pipes
    it('can route the result to another pipe', async () => {
        const pipe = Pipe.forwardingPipe(() => null);
        const connectedPipe = Pipe.forwardingPipe(() => null);
        const subscriber = jest.fn();
        connectedPipe.subscribe(subscriber);

        pipe.routeTo(connectedPipe);

        await pipe.blockingSend(null);
        expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('preserves its subscribers when routing to another pipe', async () => {
        const pipe = Pipe.forwardingPipe(() => null);
        const connectedPipe = Pipe.forwardingPipe(() => null);
        const subscriber = jest.fn();
        pipe.subscribe(subscriber);

        pipe.routeTo(connectedPipe);

        await pipe.blockingSend(null);
        expect(subscriber).toHaveBeenCalledTimes(1);
    });
});
