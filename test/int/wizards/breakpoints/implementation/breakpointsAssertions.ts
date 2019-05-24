import * as path from 'path';
import { expect, use } from 'chai';
import * as chaiString from 'chai-string';
import { DebugProtocol } from 'vscode-debugprotocol';
import { THREAD_ID } from 'vscode-chrome-debug-core-testsupport';
import { BreakpointWizard } from '../breakpointWizard';
import { InternalFileBreakpointsWizard, CurrentBreakpointsMapping } from './internalFileBreakpointsWizard';
import { BreakpointsWizard } from '../breakpointsWizard';
import { waitUntilReadyWithTimeout } from '../../../utils/waitUntilReadyWithTimeout';
import { ExpectedFrame, StackTraceObjectAssertions } from './stackTraceObjectAssertions';
import { StackTraceStringAssertions } from './stackTraceStringAssertions';
import { VariablesWizard, IExpectedVariables } from '../../variables/variablesWizard';
import { StackFrameWizard } from '../../variables/stackFrameWizard';

use(chaiString);

export interface IVerifications {
    variables?: IExpectedVariables;
    stackTrace?: string | ExpectedFrame[];
    stackFrameFormat?: DebugProtocol.StackFrameFormat;
}

interface IObjectWithLocation {
    source?: DebugProtocol.Source;
    line?: number; // One based line number
    column?: number; // One based colum number
}

export class BreakpointsAssertions {
    private readonly _variableAssertions = new VariablesWizard(this._internal.client);

    private readonly _defaultStackFrameFormat: DebugProtocol.StackFrameFormat = {
        parameters: true,
        parameterTypes: true,
        parameterNames: true,
        line: true,
        module: true
    };

    public constructor(
        private readonly _breakpointsWizard: BreakpointsWizard,
        private readonly _internal: InternalFileBreakpointsWizard,
        public readonly currentBreakpointsMapping: CurrentBreakpointsMapping) { }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        // Convert to one based to match the VS Code potocol and what VS Code does if you try to open that file at that line number

        const breakpointStatus = this.currentBreakpointsMapping.get(breakpoint);
        this.assertLocationMatchesExpected(breakpointStatus, breakpoint);
        expect(breakpointStatus.verified, `Expected ${breakpoint} to be verified yet it wasn't: ${breakpointStatus.message}`).to.equal(true);
    }

    public async waitUntilVerified(breakpoint: BreakpointWizard): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.currentBreakpointsMapping.get(breakpoint).verified);
    }

    public async assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>, verifications: IVerifications): Promise<void> {
        const actionResult = lastActionToMakeBreakpointHit();

        await this.assertIsHitThenResume(breakpoint, verifications);

        await actionResult;
    }

    public async assertIsHitThenResume(breakpoint: BreakpointWizard, verifications: IVerifications): Promise<void> {
        await this._breakpointsWizard.waitUntilPaused(breakpoint);

        const stackFrameFormat = verifications.stackFrameFormat || this._defaultStackFrameFormat;

        const stackTraceResponse = await this._internal.client.send('stackTrace', {
            threadId: THREAD_ID,
            format: stackFrameFormat
        });
        const topFrame = stackTraceResponse.body.stackFrames[0];

        // Validate that the topFrame is locate in the same place as the breakpoint
        this.assertLocationMatchesExpected(topFrame, breakpoint);

        if (typeof verifications.stackTrace === 'string') {
            const assertions = new StackTraceStringAssertions(breakpoint);
            assertions.assertResponseMatches(stackTraceResponse, verifications.stackTrace);
        } else if (typeof verifications.stackTrace === 'object') {
            const assertions = new StackTraceObjectAssertions(this._breakpointsWizard);
            assertions.assertResponseMatches(stackTraceResponse, verifications.stackTrace);
        }

        if (verifications.variables !== undefined) {
            this._variableAssertions.assertStackFrameVariablesAre(new StackFrameWizard(this._internal.client, topFrame), verifications.variables);
        }

        await this._breakpointsWizard.resume();
    }

    private assertLocationMatchesExpected(objectWithLocation: IObjectWithLocation, breakpoint: BreakpointWizard): void {
        const expectedFilePath = this._internal.filePath;

        expect(objectWithLocation.source).to.not.equal(undefined);
        expect(objectWithLocation.source!.path).to.be.equal(expectedFilePath);
        expect(objectWithLocation.source!.name).to.be.equal(path.basename(expectedFilePath));

        const expectedLineNumber = breakpoint.boundPosition.lineNumber + 1;
        const expectedColumNumber = breakpoint.boundPosition.columnNumber + 1;
        const expectedBPLocationPrinted = `${expectedFilePath}:${expectedLineNumber}:${expectedColumNumber}`;
        const actualBPLocationPrinted = `${objectWithLocation.source!.path}:${objectWithLocation.line}:${objectWithLocation.column}`;

        expect(actualBPLocationPrinted).to.be.equal(expectedBPLocationPrinted);
    }
}