import * as assert from 'assert';
import { DebugProtocol } from 'vscode-debugprotocol';
import { THREAD_ID } from 'vscode-chrome-debug-core-testsupport';
import { BreakpointWizard } from '../breakpointWizard';
import { InternalFileBreakpointsWizard, CurrentBreakpointsMapping } from './internalFileBreakpointsWizard';
import { BreakpointsWizard } from '../breakpointsWizard';
import { waitUntilReadyWithTimeout } from '../../../utils/waitUntilReadyWithTimeout';

export class BreakpointsAssertions {
    public constructor(
        private readonly _breakpointsWizard: BreakpointsWizard,
        private readonly _internal: InternalFileBreakpointsWizard,
        public readonly currentBreakpointsMapping: CurrentBreakpointsMapping) { }

    public assertIsVerified(breakpoint: BreakpointWizard): void {
        const breakpointStatus = this.currentBreakpointsMapping.get(breakpoint);
        assert(breakpointStatus.verified, `Expected ${breakpoint} to be verified yet it wasn't: ${breakpointStatus.message}`);
        // Convert to one based to match the VS Code potocol and what VS Code does if you try to open that file at that line number
        // const oneBasedExpectedLineNumber = breakpoint.position.lineNumber + 1;
        // const oneBasedExpectedColumnNumber = breakpoint.position.columnNumber + 1;
        // const filePath = this._internal.filePath;

        // TODO: Re-enable this once we figure out how to deal with source-maps that do unexpected things
        // assert.equal(breakpointStatus.line, oneBasedExpectedLineNumber,
        //     `Expected ${breakpoint} actual line to be ${filePath}:${oneBasedExpectedLineNumber}:${oneBasedExpectedColumnNumber}`
        //     + ` yet it was ${filePath}:${breakpointStatus.line}:${breakpointStatus.column}`);
    }

    public async waitUntilVerified(breakpoint: BreakpointWizard): Promise<void> {
        await waitUntilReadyWithTimeout(() => this.currentBreakpointsMapping.get(breakpoint).verified);
    }

    public async assertIsHitThenResumeWhen(breakpoint: BreakpointWizard, lastActionToMakeBreakpointHit: () => Promise<void>, expectedStackTrace: string): Promise<void> {
        const actionResult = lastActionToMakeBreakpointHit();
        const vsCodeStatus = this.currentBreakpointsMapping.get(breakpoint);
        const location = { path: this._internal.filePath, line: vsCodeStatus.line, colum: vsCodeStatus.column };

        // TODO: Merge the two following calls together
        await this._internal.client.assertStoppedLocation('breakpoint', location);
        await this._breakpointsWizard.assertIsPaused();

        const stackTraceResponse = await this._internal.client.send('stackTrace', {
            threadId: THREAD_ID,
            format: {
                parameters: true,
                parameterTypes: true,
                parameterNames: true,
                line: true,
                module: true
            }
        });

        if (!stackTraceResponse.success) {
            throw new Error(`Expected the response to the stack trace request to be succesful yet it was: ${JSON.stringify(stackTraceResponse)}`);
        }

        const formattedExpectedStackTrace = expectedStackTrace.replace(/^\s+/gm, ''); // Remove the white space we put at the start of the lines to make the stack trace align with the code
        const actualStackTrace = this.extractStackTrace(stackTraceResponse);
        assert.equal(actualStackTrace, formattedExpectedStackTrace, `Expected the stack trace when hitting ${breakpoint} to be:\n${formattedExpectedStackTrace}\nyet it is:\n${actualStackTrace}`);

        // const scopesResponse = await this._internal.client.scopesRequest({ frameId: stackTraceResponse.body.stackFrames[0].id });
        /// const scopes = scopesResponse.body.scopes;
        await this._internal.client.continueRequest();
        await this._breakpointsWizard.waitUntilJustResumed();
        await actionResult;
    }

    private extractStackTrace(stackTraceResponse: DebugProtocol.StackTraceResponse): string {
        return stackTraceResponse.body.stackFrames.map(f => this.printStackTraceFrame(f)).join('\n');
    }

    private printStackTraceFrame(frame: DebugProtocol.StackFrame): string {
        return `${frame.name}${frame.presentationHint ? ` (${frame.presentationHint})` : ''}`;
    }
}