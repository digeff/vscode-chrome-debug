import * as path from 'path';
import { Position } from '../core-v2/chrome/internal/locations/location';
import { IBPActionWhenHit } from '../core-v2/chrome/internal/breakpoints/bpActionWhenHit';
import { InternalFileBreakpointsWizard } from './internalFileBreakpointsWizard';
import { RemoveProperty } from '../core-v2/typeUtils';
import { DebugProtocol } from 'vscode-debugprotocol';

export class BreakpointWizard {
    private _state: IBreakpointWizardState = new NotSetBreakpointWizard(this, this._internal, this.changeStateFunction());

    public constructor(private readonly _internal: InternalFileBreakpointsWizard, public readonly position: Position, public readonly actionWhenHit: IBPActionWhenHit) { }

    public async set(): Promise<BreakpointWizard> {
        await this._state.set();
        return this;
    }

    public async unset(): Promise<BreakpointWizard> {
        await this._state.unset();
        return this;
    }

    public async assertIsHitThenResumeWhen(lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<BreakpointWizard> {
        await this._state.assertIsHitThenResumeWhen(lastActionToMakeBreakpointHit, expectedStackTrace);
        return this;
    }

    public assertIsVerified(): this {
        this._state.assertIsVerified();
        return this;
    }

    public toString(): string {
        return `(BP ${path.basename(this._internal.filePath)}:${this.position} ${this.actionWhenHit})`;
    }

    private changeStateFunction(): ChangeBreakpointWizardState {
        return newState => this._state = newState;
    }
}

export type VSCodeActionWhenHit = RemoveProperty<DebugProtocol.SourceBreakpoint, 'line' | 'column'>;

export type ChangeBreakpointWizardState = (newState: IBreakpointWizardState) => void;

export interface IBreakpointWizardState {
    set(): Promise<void>;
    unset(): Promise<void>;
    assertIsHitThenResumeWhen(lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<void>;
    assertIsVerified(): void;
}

class SetBreakpointWizard implements IBreakpointWizardState {
    public constructor(
        private readonly _owner: BreakpointWizard,
        private readonly _internal: InternalFileBreakpointsWizard,
        private readonly _changeState: ChangeBreakpointWizardState) {
    }

    public set(): Promise<void> {
        throw new Error(`Can't set a breakpoint that is already set`);
    }

    public async unset(): Promise<void> {
        await this._internal.unset(this._owner);
        this._changeState(new NotSetBreakpointWizard(this._owner, this._internal, this._changeState));
    }

    public assertIsHitThenResumeWhen(lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<void> {
        return this._internal.assertIsHitThenResumeWhen(this._owner, lastActionToMakeBreakpointHit, expectedStackTrace);
    }

    public assertIsVerified(): void {
        this._internal.assertIsVerified(this._owner);
    }
}

export class NotSetBreakpointWizard implements IBreakpointWizardState {
    public constructor(
        private readonly _owner: BreakpointWizard,
        private readonly _internal: InternalFileBreakpointsWizard,
        private readonly _changeState: ChangeBreakpointWizardState) {
    }

    public async set(): Promise<void> {
        await this._internal.set(this._owner);
        this._changeState(new SetBreakpointWizard(this._owner, this._internal, this._changeState));
    }

    public unset(): Promise<void> {
        throw new Error(`Can't unset a breakpoint that is already unset`);
    }

    public assertIsHitThenResumeWhen(_lastActionToMakeBreakpointHit: () => Promise<void>, _expectedStackTrace: string): Promise<void> {
        throw new Error(`Can't expect to hit a breakpoint that is unset`);
    }

    public assertIsVerified(): never {
        throw new Error(`Can't expect an unset breakpoint to be verified`);
    }
}
