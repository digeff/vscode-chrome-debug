import { DebugProtocol } from 'vscode-debugprotocol';
import { BreakpointWizard } from '../breakpointWizard';
import { ValidatedMap } from '../../../core-v2/chrome/collections/validatedMap';
import { IPerformChangesImmediatelyOrBatchState, InternalFileBreakpointsWizard, CurrentBreakpointsMapping, BreakpointsUpdate } from './internalFileBreakpointsWizard';
import { BreakpointsAssertions } from './breakpointsAssertions';
import { BreakpointsWizard } from '../breakpointsWizard';

export class PerformChangesImmediatelyState implements IPerformChangesImmediatelyOrBatchState {
    private readonly _idToBreakpoint = new ValidatedMap<number, BreakpointWizard>();
    private readonly _breakpointsAssertions = new BreakpointsAssertions(this._breakpointsWizard, this._internal, this.currentBreakpointsMapping);

    public constructor(
        private readonly _breakpointsWizard: BreakpointsWizard,
        private readonly _internal: InternalFileBreakpointsWizard,
        public readonly currentBreakpointsMapping: CurrentBreakpointsMapping) {
        this.currentBreakpointsMapping.forEach((vsCodeStatus, breakpoint) => {
            this._idToBreakpoint.set(vsCodeStatus.id, breakpoint);
        });
    }

    public async set(breakpointWizard: BreakpointWizard): Promise<void> {
        if (this.currentBreakpointsMapping.has(breakpointWizard)) {
            throw new Error(`Can't set the breakpoint: ${breakpointWizard} because it's already set`);
        }

        await this._internal.sendBreakpointsToClient(new BreakpointsUpdate([breakpointWizard], [], this.currentBreakpoints()));
    }

    public async unset(breakpointWizard: BreakpointWizard): Promise<void> {
        if (!this.currentBreakpointsMapping.has(breakpointWizard)) {
            throw new Error(`Can't unset the breakpoint: ${breakpointWizard} because it is not set`);
        }

        const remainingBreakpoints = this.currentBreakpoints().filter(bp => bp !== breakpointWizard);
        await this._internal.sendBreakpointsToClient(new BreakpointsUpdate([], [breakpointWizard], remainingBreakpoints));
    }

    public onBreakpointStatusChange(breakpointStatusChanged: DebugProtocol.BreakpointEvent): void {
        const breakpoint = this._idToBreakpoint.get(breakpointStatusChanged.body.breakpoint.id);
        this.currentBreakpointsMapping.setAndReplaceIfExist(breakpoint, breakpointStatusChanged.body.breakpoint);
    }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        this._breakpointsAssertions.assertIsVerified(breakpoint);
    }

    public async waitUntilVerified(breakpoint: BreakpointWizard): Promise<void> {
        await this._breakpointsAssertions.waitUntilVerified(breakpoint);
    }

    public async assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<void> {
        await this._breakpointsAssertions.assertIsHitThenResumeWhen(breakpoint, lastActionToMakeBreakpointHit, expectedStackTrace);
    }

    private currentBreakpoints(): BreakpointWizard[] {
        return Array.from(this.currentBreakpointsMapping.keys());
    }
}
