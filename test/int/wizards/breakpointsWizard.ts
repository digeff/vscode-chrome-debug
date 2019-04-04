import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { BreakpointWizard } from './breakpointWizard';
import { InternalFileBreakpointsWizard } from './internalFileBreakpointsWizard';
import { DebugProtocol } from 'vscode-debugprotocol';
import { PromiseOrNot } from 'vscode-chrome-debug-core';
import { ValidatedMap } from '../core-v2/chrome/collections/validatedMap';
import { wrapWithMethodLogger } from '../core-v2/chrome/logging/methodsCalledLogger';

interface IEventsConsumptionState {
    readonly latestEvent: DebugProtocol.StoppedEvent | DebugProtocol.ContinuedEvent;

    onPaused(stopped: DebugProtocol.StoppedEvent): void;
    onResumed(continued: DebugProtocol.ContinuedEvent): void;
}

type ChangeState = (newState: IEventsConsumptionState) => void;

class EventAvailableToBeConsumed implements IEventsConsumptionState {
    public constructor(private readonly _changeState: ChangeState, public readonly latestEvent: DebugProtocol.StoppedEvent | DebugProtocol.ContinuedEvent) { }

    public onPaused(stopped: DebugProtocol.StoppedEvent): void {
        throw new Error(`Expected to consume previous event: ${JSON.stringify(this.latestEvent)} before receiving a new stopped event: ${JSON.stringify(stopped)}`);
    }

    public onResumed(continued: DebugProtocol.ContinuedEvent): void {
        throw new Error(`Expected to consume previous event: ${JSON.stringify(this.latestEvent)} before receiving a new continued event: ${JSON.stringify(continued)}`);
    }
}

class NoEventAvailableToBeConsumed implements IEventsConsumptionState {
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
}

export class BreakpointsWizard {
    private _state: IEventsConsumptionState = new NoEventAvailableToBeConsumed(this.changeStateFunction);
    private readonly _pathToFileWizard = new ValidatedMap<string, InternalFileBreakpointsWizard>();

    private constructor(private readonly _client: ExtendedDebugClient, private readonly _project: TestProjectSpec) {
        this._client.on('stopped', stopped => this.onPaused(stopped));
        this._client.on('continued', continued => this.onResumed(continued));
        this._client.on('breakpoint', breakpointStatusChange => this.onBreakpointStatusChange(breakpointStatusChange));
    }

    public static create(debugClient: ExtendedDebugClient, testProjectSpecification: TestProjectSpec): BreakpointsWizard {
        return wrapWithMethodLogger(new this(debugClient, testProjectSpecification));
    }

    public at(filePath: string): FileBreakpointsWizard {
        return wrapWithMethodLogger(new FileBreakpointsWizard(this._pathToFileWizard.getOrAdd(filePath,
            () => new InternalFileBreakpointsWizard(this._client, this._project.src(filePath)))));
    }

    public async assertNotPaused(): Promise<void> {
        if (this._state.latestEvent.event === 'paused') {
            this._state = new NoEventAvailableToBeConsumed(this.changeStateFunction);
        }
    }

    public toString(): string {
        return 'Breakpoints';
    }

    private onPaused(stopped: DebugProtocol.StoppedEvent): void {
        this._state.onPaused(stopped);
    }

    private onResumed(continued: DebugProtocol.ContinuedEvent): void {
        this._state.onResumed(continued);
    }

    private onBreakpointStatusChange(breakpointStatusChanged: DebugProtocol.BreakpointEvent): void {
        for (const fileWizard of this._pathToFileWizard.values()) {
            fileWizard.onBreakpointStatusChange(breakpointStatusChanged);
        }
    }

    private changeStateFunction(): (newState: IEventsConsumptionState) => void {
        return newState => this._state = newState;
    }
}

export class FileBreakpointsWizard {
    public constructor(private readonly _internal: InternalFileBreakpointsWizard) { }

    public async hitCountBreakpoint(options: { lineText: string; hitCountCondition: string; }): Promise<BreakpointWizard> {
        return (await (await this.unsetHitCountBreakpoint(options)).set()).assertIsVerified();
    }

    public async unsetHitCountBreakpoint(options: { lineText: string; hitCountCondition: string; }): Promise<BreakpointWizard> {
        return wrapWithMethodLogger(await this._internal.hitCountBreakpoint(options));
    }

    public batch(batchAction: (fileBreakpointsWizard: FileBreakpointsWizard) => PromiseOrNot<void>): Promise<void> {
        return this._internal.batch(batchAction);
    }

    public toString(): string {
        return `Breakpoints for ${this._internal.filePath}`;
    }
}
