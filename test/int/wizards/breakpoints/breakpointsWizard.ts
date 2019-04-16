import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { TestProjectSpec } from '../../framework/frameworkTestSupport';
import { InternalFileBreakpointsWizard } from './implementation/internalFileBreakpointsWizard';
import { DebugProtocol } from 'vscode-debugprotocol';
import { ValidatedMap } from '../../core-v2/chrome/collections/validatedMap';
import { wrapWithMethodLogger } from '../../core-v2/chrome/logging/methodsCalledLogger';
import assert = require('assert');
import { FileBreakpointsWizard } from './fileBreakpointsWizard';
import { waitUntilReadyWithTimeout } from '../../utils/waitUntilReadyWithTimeout';

export class BreakpointsWizard {
    private _state: IEventForConsumptionAvailabilityState = new NoEventAvailableToBeConsumed(this.changeStateFunction());
    private readonly _pathToFileWizard = new ValidatedMap<string, InternalFileBreakpointsWizard>();

    private constructor(private readonly _client: ExtendedDebugClient, private readonly _project: TestProjectSpec) {
        this._client.on('stopped', stopped => this._state.onPaused(stopped));
        this._client.on('continued', continued => this._state.onResumed(continued));
        this._client.on('breakpoint', breakpointStatusChange => this.onBreakpointStatusChange(breakpointStatusChange));
    }

    public static create(debugClient: ExtendedDebugClient, testProjectSpecification: TestProjectSpec): BreakpointsWizard {
        return wrapWithMethodLogger(new this(debugClient, testProjectSpecification));
    }

    public at(filePath: string): FileBreakpointsWizard {
        return wrapWithMethodLogger(new FileBreakpointsWizard(this._pathToFileWizard.getOrAdd(filePath,
            () => new InternalFileBreakpointsWizard(this, this._client, this._project.src(filePath)))));
    }

    public async assertNotPaused(): Promise<void> {
        assert(this._state instanceof NoEventAvailableToBeConsumed,
            `Expected that there was not new paused event to be consumed, and that the debugger wasn't paused yet the state was: ${this._state}`);
    }

    public assertIsPaused(): void {
        this._state.assertIsPaused();
    }

    public async waitUntilJustResumed(): Promise<void> {
        await waitUntilReadyWithTimeout(() => this._state instanceof EventAvailableToBeConsumed);

        await this._state.waitUntilJustResumed();
    }

    public toString(): string {
        return 'Breakpoints';
    }

    private onBreakpointStatusChange(breakpointStatusChanged: DebugProtocol.BreakpointEvent): void {
        for (const fileWizard of this._pathToFileWizard.values()) {
            fileWizard.onBreakpointStatusChange(breakpointStatusChanged);
        }
    }

    private changeStateFunction(): (newState: IEventForConsumptionAvailabilityState) => void {
        return newState => this._state = newState;
    }
}

interface IEventForConsumptionAvailabilityState {
    readonly latestEvent: DebugProtocol.StoppedEvent | DebugProtocol.ContinuedEvent;

    onPaused(stopped: DebugProtocol.StoppedEvent): void;
    onResumed(continued: DebugProtocol.ContinuedEvent): void;

    waitUntilJustResumed(): Promise<void>;
    assertIsPaused(): void;
}

type ChangeState = (newState: IEventForConsumptionAvailabilityState) => void;

class EventAvailableToBeConsumed implements IEventForConsumptionAvailabilityState {
    public constructor(private readonly _changeState: ChangeState, public readonly latestEvent: DebugProtocol.StoppedEvent | DebugProtocol.ContinuedEvent) { }

    public onPaused(stopped: DebugProtocol.StoppedEvent): void {
        throw new Error(`Expected to consume previous event: ${JSON.stringify(this.latestEvent)} before receiving a new stopped event: ${JSON.stringify(stopped)}`);
    }

    public onResumed(continued: DebugProtocol.ContinuedEvent): void {
        throw new Error(`Expected to consume previous event: ${JSON.stringify(this.latestEvent)} before receiving a new continued event: ${JSON.stringify(continued)}`);
    }

    public async waitUntilJustResumed(): Promise<void> {
        if (this.latestEvent.event === 'continued') {
            this._changeState(new NoEventAvailableToBeConsumed(this._changeState));
        }
    }

    public assertIsPaused(): void {
        if (this.latestEvent.event === 'stopped') {
            this._changeState(new NoEventAvailableToBeConsumed(this._changeState));
        }
    }
}

class NoEventAvailableToBeConsumed implements IEventForConsumptionAvailabilityState {
    public constructor(private readonly _changeState: ChangeState) { }

    public get latestEvent(): never {
        throw new Error(`There is no event available to be consumed`);
    }

    public onPaused(stopped: DebugProtocol.StoppedEvent): void {
        this._changeState(new EventAvailableToBeConsumed(this._changeState, stopped));
    }

    public onResumed(continued: DebugProtocol.ContinuedEvent): void {
        this._changeState(new EventAvailableToBeConsumed(this._changeState, continued));
    }

    public waitUntilJustResumed(): Promise<void> {
        throw new Error(`There is no event available to be consumed`);
    }

    public assertIsPaused(): void {
        throw new Error(`There is no event available to be consumed`);
    }
}
