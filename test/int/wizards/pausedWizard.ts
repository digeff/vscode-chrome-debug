import { DebugProtocol } from 'vscode-debugprotocol';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { logger, utils } from 'vscode-chrome-debug-core';
import { isThisV2 } from '../testSetup';
import { waitUntilReadyWithTimeout } from '../utils/waitUntilReadyWithTimeout';
import { StoppedEvent, ContinuedEvent } from 'vscode-debugadapter';
import { expect } from 'chai';

export class PausedWizard {
    private _eventsToBeConsumed: (DebugProtocol.ContinuedEvent | DebugProtocol.StoppedEvent)[] = [];

    public constructor(private readonly _client: ExtendedDebugClient) {
        this._client.on('stopped', stopped => {
            this._eventsToBeConsumed.push(stopped);
            this.logState();
        });
        this._client.on('continued', continued => {
            this._eventsToBeConsumed.push(continued);
            this.logState();
        });
    }

    /**
     * Wait for a little while, and verify that the debuggee is not paused after that
     *
     * @param millisecondsToWaitForPauses How much time to wait for pauses
     */
    public async waitAndAssertNotPaused(millisecondsToWaitForPauses = 1000 /*ms*/): Promise<void> {
        await utils.promiseTimeout(undefined, millisecondsToWaitForPauses); // Wait for 1 second (to anything on flight has time to finish) and verify that we are not paused afterwards
        await this.state.assertNotPaused();
    }

    public isPaused(): boolean {
        return this.state.isPaused();
    }

    public async waitUntilPaused(actionWithPausedInfo: (pausedInfo: DebugProtocol.StoppedEvent['body']) => void): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.state instanceof PausedEventAvailableToBeConsumed);

        actionWithPausedInfo(this.state.assertIsPaused().body);
        this.markNextEventAsConsumed();
    }

    public async waitUntilJustResumed(): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.state instanceof ResumedEventAvailableToBeConsumed);

        await this.state.assertNotPaused();
    }

    /**
     * Instruct the debuggee to resume, and verify that the Debug-Adapter sends the proper notification after that happens
     */
    public async resume(): Promise<void> {
        await this._client.continueRequest();
        if (isThisV2) {
            // TODO: Is getting this event on V2 a bug? See: Continued Event at https://microsoft.github.io/debug-adapter-protocol/specification
            await this.waitUntilJustResumed();
        }
    }

    private logState() {
        logger.log(`Resume/Pause #events = ${this._eventsToBeConsumed.length}, state = ${this.state}`);
    }

    private get state(): IEventForConsumptionAvailabilityState {
        if (this._eventsToBeConsumed.length === 0) {
            return new NoEventAvailableToBeConsumed();
        } else {
            const nextEventToBeConsumed = this._eventsToBeConsumed[0];
            switch (nextEventToBeConsumed.event) {
                case 'stopped':
                    return new PausedEventAvailableToBeConsumed(this.markNextEventAsConsumed(), <StoppedEvent>nextEventToBeConsumed);
                case 'continued':
                    return new ResumedEventAvailableToBeConsumed(this.markNextEventAsConsumed(), <ContinuedEvent>nextEventToBeConsumed);
                default:
                    throw new Error(`Expected the event to be consumed to be either a stopped or continued yet it was: ${JSON.stringify(nextEventToBeConsumed)}`);
            }
        }
    }

    private markNextEventAsConsumed(): () => void {
        return () => {
            this._eventsToBeConsumed.shift();
            this.logState();
        };
    }
}


interface IEventForConsumptionAvailabilityState {
    readonly latestEvent: DebugProtocol.StoppedEvent | DebugProtocol.ContinuedEvent;

    assertIsPaused(): DebugProtocol.StoppedEvent;
    assertNotPaused(): void;

    isPaused(): boolean;
}

type MarkNextEventWasConsumed = () => void;

class PausedEventAvailableToBeConsumed implements IEventForConsumptionAvailabilityState {
    public constructor(protected readonly _markNextEventWasConsumed: MarkNextEventWasConsumed, public readonly latestEvent: DebugProtocol.StoppedEvent) { }

    public isPaused(): boolean {
        return true;
    }

    public assertIsPaused(): DebugProtocol.StoppedEvent {
        return this.latestEvent;
    }

    public assertNotPaused(): void {
        expect(this.latestEvent.event, `Expected that there was not new paused event to be consumed, and that the debugger wasn't paused yet the state was: ${this}`)
            .to.not.equal('stopped');
    }

    public toString(): string {
        return `Event available to be consumed: ${JSON.stringify(this.latestEvent)}`;
    }
}

class ResumedEventAvailableToBeConsumed implements IEventForConsumptionAvailabilityState {
    public constructor(protected readonly _markNextEventWasConsumed: MarkNextEventWasConsumed, public readonly latestEvent: DebugProtocol.ContinuedEvent) { }

    public assertIsPaused(): DebugProtocol.StoppedEvent {
        throw new Error(`The debugger is not paused`);
    }

    public assertNotPaused(): void {
        this._markNextEventWasConsumed();
    }

    public isPaused(): boolean {
        return false;
    }

    public toString(): string {
        return `Resumed Event available to be consumed: ${JSON.stringify(this.latestEvent)}`;
    }
}

class NoEventAvailableToBeConsumed implements IEventForConsumptionAvailabilityState {
    public get latestEvent(): never {
        throw new Error(`There is no event available to be consumed`);
    }

    public assertIsPaused(): never {
        throw new Error(`There is no event available to be consumed`);
    }

    public assertNotPaused(): void {
        // Always true for this state
    }

    public isPaused(): boolean {
        return false;
    }

    public toString(): string {
        return `NoEventAvailableToBeConsumed`;
    }
}
