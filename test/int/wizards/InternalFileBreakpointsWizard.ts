import * as _ from 'lodash';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { findPositionOfTextInFile } from '../utils/findPositionOfTextInFile';
import { createColumnNumber } from '../core-v2/chrome/internal/locations/subtypes';
import { DebugProtocol } from 'vscode-debugprotocol';
import { Position } from '../core-v2/chrome/internal/locations/location';
import { PauseOnHitCount } from '../core-v2/chrome/internal/breakpoints/bpActionWhenHit';
import { BreakpointWizard, VSCodeActionWhenHit } from './breakpointWizard';
import { IValidatedMap, ValidatedMap } from '../core-v2/chrome/collections/validatedMap';
import { FileBreakpointsWizard } from './breakpointsWizard';
import { PromiseOrNot } from 'vscode-chrome-debug-core';
import { ValidatedSet } from '../core-v2/chrome/collections/validatedSet';
import assert = require('assert');
import { BidirectionalMap } from '../core-v2/chrome/collections/bidirectionalMap';

class BreakpointsUpdate {
    public constructor(
        public readonly toAdd: BreakpointWizard[],
        public readonly toRemove: BreakpointWizard[],
        public readonly toKeepAsIs: BreakpointWizard[],
    ) { }
}

interface IInternalFileBreakpointsWizardState {
    readonly currentBreakpointsMapping: CurrentBreakpointsMapping;

    set(breakpointWizard: BreakpointWizard): void;
    unset(breakpointWizard: BreakpointWizard): void;

    assertIsVerified(breakpoint: BreakpointWizard): void;

    onBreakpointStatusChange(breakpointStatusChanged: DebugProtocol.BreakpointEvent): void;
    assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>): Promise<void>;
}

type CurrentBreakpointsMapping = ValidatedMap<BreakpointWizard, DebugProtocol.Breakpoint>;

class BatchingUpdates implements IInternalFileBreakpointsWizardState {
    private readonly _breakpointsToSet = new ValidatedSet<BreakpointWizard>();
    private readonly _breakpointsToUnset = new ValidatedSet<BreakpointWizard>();

    public constructor(private readonly _internal: InternalFileBreakpointsWizard, public readonly currentBreakpointsMapping: CurrentBreakpointsMapping) { }

    public set(breakpointWizard: BreakpointWizard): void {
        this._breakpointsToSet.add(breakpointWizard);
        this._breakpointsToUnset.deleteIfExists(breakpointWizard);
    }

    public unset(breakpointWizard: BreakpointWizard) {
        this._breakpointsToUnset.add(breakpointWizard);
        this._breakpointsToSet.deleteIfExists(breakpointWizard);
    }

    public async processBatch(): Promise<void> {
        const remainingBreakpoints = _.difference(this.currentBreakpointsMapping.keys(), this._breakpointsToSet, this._breakpointsToUnset);
        await this._internal.sendBreakpointsToClient(this.currentBreakpointsMapping, new BreakpointsUpdate(Array.from(this._breakpointsToSet), Array.from(this._breakpointsToUnset), remainingBreakpoints));
    }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        throw new Error(`Breakpoints are not allowed to be verified while doing a batch update`);
    }

    public onBreakpointStatusChange(_breakpointStatusChanged: DebugProtocol.BreakpointEvent): void {
        throw new Error(`Breakpoint status shouldn't be updated while doing a batch update. Is this happening due to a product or test bug?`);
    }

    public assertIsHitThenResumeWhen(_breakpoint: BreakpointWizard, _lastActionToMakeBreakpointHit: () => Promise<void>): Promise<void> {
        throw new Error(`Breakpoint shouldn't be verified while doing a batch update. Is this happening due to a product or test bug?`);
    }
}

class UpdatingImmediately implements IInternalFileBreakpointsWizardState {
    private readonly _idToBreakpoint = new ValidatedMap<number, BreakpointWizard>();

    public constructor(private readonly _internal: InternalFileBreakpointsWizard, public readonly currentBreakpointsMapping: CurrentBreakpointsMapping) {
        this.currentBreakpointsMapping.forEach((vsCodeStatus, breakpoint) => {
            this._idToBreakpoint.set(vsCodeStatus.id, breakpoint);
        });
    }

    public async set(breakpointWizard: BreakpointWizard): Promise<void> {
        await this._internal.sendBreakpointsToClient(this.currentBreakpointsMapping, new BreakpointsUpdate([breakpointWizard], [], this.currentBreakpoints()));
    }

    public async unset(breakpointWizard: BreakpointWizard): Promise<void> {
        if (!this.currentBreakpointsMapping.has(breakpointWizard)) {
            throw new Error(`Expected the breakpoint: ${breakpointWizard} to be set yet it wasn't`);
        }

        const remainingBreakpoints = this.currentBreakpoints().filter(bp => bp !== breakpointWizard);
        await this._internal.sendBreakpointsToClient(this.currentBreakpointsMapping, new BreakpointsUpdate([], [breakpointWizard], remainingBreakpoints));
    }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        const breakpointStatus = this.currentBreakpointsMapping.get(breakpoint);
        assert(breakpointStatus.verified, `Expected breakpoint ${breakpoint} to be verified yet it wasn't: ${breakpointStatus.message}`);
    }

    public onBreakpointStatusChange(breakpointStatusChanged: DebugProtocol.BreakpointEvent): void {
        const breakpoint = this._idToBreakpoint.get(breakpointStatusChanged.body.breakpoint.id);
        this.currentBreakpointsMapping.set(breakpoint, breakpointStatusChanged.body.breakpoint);
    }


    private currentBreakpoints(): BreakpointWizard[] {
        return Array.from(this.currentBreakpointsMapping.keys());
    }

    public async assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>): Promise<void> {
        const actionResult = lastActionToMakeBreakpointHit();
        const vsCodeStatus = this.currentBreakpointsMapping.get(breakpoint);
        const location = { path: this._internal.filePath, line: vsCodeStatus.line, colum: vsCodeStatus.column };
        await this._internal.client.assertStoppedLocation('breakpoint', location);
        await actionResult;
        await this._internal.client.continueRequest();
    }
}

export class InternalFileBreakpointsWizard {
    private _state: IInternalFileBreakpointsWizardState = new UpdatingImmediately(this, new ValidatedMap());

    public constructor(public readonly client: ExtendedDebugClient, public readonly filePath: string) { }

    public async batch(batchAction: (fileBreakpointsWizard: FileBreakpointsWizard) => PromiseOrNot<void>): Promise<void> {
        const batchingUpdates = new BatchingUpdates(this, this._state.currentBreakpointsMapping);
        this._state = batchingUpdates;
        await batchAction(new FileBreakpointsWizard(this));
        batchingUpdates.processBatch();
    }

    public async set(breakpointWizard: BreakpointWizard): Promise<void> {
        await this._state.set(breakpointWizard);
    }

    public async unset(breakpointWizard: BreakpointWizard): Promise<void> {
        await this._state.unset(breakpointWizard);
    }

    public async sendBreakpointsToClient(currentBreakpointsMapping: CurrentBreakpointsMapping, update: BreakpointsUpdate): Promise<void> {
        const updatedBreakpoints = update.toKeepAsIs.concat(update.toAdd);
        const vsCodeBps = updatedBreakpoints.map(bp => this.toVSCodeProtocol(bp));
        const response = await this.client.setBreakpointsRequest({ breakpoints: vsCodeBps, source: { path: this.filePath } });
        if (!response.success) {
            throw new Error(`Failed to set the breakpoints for: ${this.filePath}`);
        }

        const expected = vsCodeBps.length;
        const actual = response.body.breakpoints.length;
        if (actual !== expected) {
            throw new Error(`Expected to receive ${expected} breakpoints yet we got ${actual}. Received breakpoints: ${JSON.stringify(response.body.breakpoints)}`);
        }

        const breakpointToStatus = new ValidatedMap<BreakpointWizard, DebugProtocol.Breakpoint>(_.zip(updatedBreakpoints, response.body.breakpoints));
        this._state = new UpdatingImmediately(this, breakpointToStatus);
    }

    public async hitCountBreakpoint(options: { lineText: string; hitCountCondition: string; }): Promise<BreakpointWizard> {
        const position = await findPositionOfTextInFile(this.filePath, options.lineText);
        return new BreakpointWizard(this, position, new PauseOnHitCount(options.hitCountCondition));
    }

    public async assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>): Promise<void> {
        this._state.assertIsHitThenResumeWhen(breakpoint, lastActionToMakeBreakpointHit);
    }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        this._state.assertIsVerified(breakpoint);
    }

    public toVSCodeProtocol(breakpoint: BreakpointWizard): DebugProtocol.SourceBreakpoint {
        // VS Code protocol is 1-based so we add one to the line and colum numbers
        const commonInformation = { line: breakpoint.position.lineNumber + 1, column: breakpoint.position.columnNumber + 1 };
        const actionWhenHitInformation = this.actionWhenHitToVSCodeProtocol(breakpoint);
        return Object.assign({}, commonInformation, actionWhenHitInformation);
    }

    private actionWhenHitToVSCodeProtocol(breakpoint: BreakpointWizard): VSCodeActionWhenHit {
        if (breakpoint.actionWhenHit instanceof PauseOnHitCount) {
            return { hitCondition: breakpoint.actionWhenHit.pauseOnHitCondition };
        } else {
            throw new Error('Not yet implemented');
        }
    }

    public onBreakpointStatusChange(breakpointStatusChanged: DebugProtocol.BreakpointEvent): void {
        this._state.onBreakpointStatusChange(breakpointStatusChanged);
    }
}
