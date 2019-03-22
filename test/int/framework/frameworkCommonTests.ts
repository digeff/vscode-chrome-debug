/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { puppeteerTest } from '../puppeteer/puppeteerSuite';
import { setBreakpoint, BreakpointLocation } from '../intTestSupport';
import { FrameworkTestContext } from './frameworkTestSupport';

/**
 * A common framework test suite that allows for easy (one-liner) testing of various
 * functionality in different framework projects (note: this isn't a suite in the mocha sense, but rather
 * a collection of functions that return mocha tests)
 */
export class FrameworkTestSuite {
    constructor(
        private frameworkName: string,
        private suiteContext: FrameworkTestContext
    ) {}

    /**
     * Test that we can stop on a breakpoint set before launch
     * @param bpLabel Label for the breakpoint to set
     */
    testBreakOnLoad(bpLabel: string) {
        return test(`${this.frameworkName} - Should stop on breakpoint on initial page load`, async () => {
            const testSpec = this.suiteContext.testSpec;
            const location = this.suiteContext.breakpointLabels.get(bpLabel);
            await this.suiteContext.debugClient
                .hitBreakpointUnverified(testSpec.props.launchConfig, location);
        });
    }

    /**
     * Test that a breakpoint set after the page loads is hit on reload
     * @param bpLabel Label for the breakpoint to set
     */
    testPageReloadBreakpoint(bpLabel: string) {
        return puppeteerTest(`${this.frameworkName} - Should hit breakpoint on page reload`, this.suiteContext,
            async (context, page) => {
                const debugClient = context.debugClient;
                const bpLocation = context.breakpointLabels.get(bpLabel);
                await setBreakpoint(debugClient, bpLocation);
                let reloaded = page.reload();
                await debugClient.assertStoppedLocation('breakpoint', bpLocation);
                debugClient.continueRequest();
                await reloaded;
            });
    }

    /**
     * Test that step in command works as expected.
     * @param bpLabelStop Label for the breakpoint to set
     * @param bpLabelStepIn Label for the location where the 'step out' command should land us
     */
    testStepIn(bpLabelStop: string, bpLabelStepIn: string) {
        return puppeteerTest(`${this.frameworkName} - Should step in correctly`, this.suiteContext,
        async (context, page) => {
            let location = this.suiteContext.breakpointLabels.get(bpLabelStop);
            let stepInLocation = this.suiteContext.breakpointLabels.get(bpLabelStepIn);
            await setBreakpoint(this.suiteContext.debugClient, location);
            let incBtn = await page.waitForSelector('#incrementBtn');
            incBtn.click();
            await this.suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);
            let stopOnStep = this.suiteContext.debugClient.assertStoppedLocation('step', stepInLocation);
            await this.suiteContext.debugClient.stepInAndStop();
            await stopOnStep;
            await this.suiteContext.debugClient.continueRequest();
        });
    }

    /**
     * Test that step over (next) command works as expected.
     * Note: currently this test assumes that next will land us on the very next line in the file.
     * @param bpLabel Label for the breakpoint to set
     */
    testStepOver(bpLabel: string) {
        return puppeteerTest(`${this.frameworkName} - Should step over correctly`, this.suiteContext,
        async (context, page) => {
            let location = this.suiteContext.breakpointLabels.get(bpLabel);
            await setBreakpoint(this.suiteContext.debugClient, location);
            let incBtn = await page.waitForSelector('#incrementBtn');
            incBtn.click();
            await this.suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);
            let stopOnStep = this.suiteContext.debugClient.assertStoppedLocation('step',  { ...location, line: location.line + 1 });
            await this.suiteContext.debugClient.nextAndStop();
            await stopOnStep;
            await this.suiteContext.debugClient.continueRequest();
        });
    }

    /**
     * Test that step out command works as expected.
     * @param bpLabelStop Label for the breakpoint to set
     * @param bpLabelStepOut Label for the location where the 'step out' command should land us
     */
    testStepOut(bpLabelStop: string, bpLabelStepOut: string) {
        return puppeteerTest(`${this.frameworkName} - Should step out correctly`, this.suiteContext,
        async (context, page) => {
            let location = this.suiteContext.breakpointLabels.get(bpLabelStop);
            let stepOutLocation = this.suiteContext.breakpointLabels.get(bpLabelStepOut);
            await setBreakpoint(this.suiteContext.debugClient, location);
            let incBtn = await page.waitForSelector('#incrementBtn');
            incBtn.click();
            await this.suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);
            let stopOnStep = this.suiteContext.debugClient.assertStoppedLocation('step', stepOutLocation);
            await this.suiteContext.debugClient.stepOutAndStop();
            await stopOnStep;
            await this.suiteContext.debugClient.continueRequest();
        });
    }

    /**
     * Test that the debug adapter can correctly pause execution
     * @param bpLocation
     */
    testPauseExecution() {
        return puppeteerTest(`${this.frameworkName} - Should correctly pause execution on a pause request`, this.suiteContext, async (context, page) => {
            const debugClient = context.debugClient;
            await debugClient.pauseRequest({ threadId: 0 });
            await debugClient.waitForEvent('stopped');
            debugClient.continueRequest();
        });
    }
}
