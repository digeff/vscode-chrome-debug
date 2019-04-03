/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Hit count breakpoints' scenarios
 * Hit count breakpoint syntax: (>|>=|=|<|<=|%)?\s*([0-9]+)
 */

import * as _ from 'lodash';
import { puppeteerSuite, puppeteerTest } from '../puppeteer/puppeteerSuite';
import { reactTestSpecification } from '../resources/resourceProjects';
import { BreakpointsWizard as BreakpointsWizard } from '../wizards/breakpointsWizard';
import { asyncRepeatSerially } from '../utils/repeat';
import { utils } from 'vscode-chrome-debug-core';

puppeteerSuite('React Framework Tests', reactTestSpecification, (suiteContext) => {
    suite('Hit count breakpoints tests', () => {

        puppeteerTest('DIEGO1 = 3 hit count breakpoint hits on the 3rd click', suiteContext, async (_context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');
            await utils.promiseTimeout(null, 100);

            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            const setStateBreakpoint = await counterBreakpoints.hitCountBreakpoint({
                lineText: 'this.setState({ count: newval });',
                hitCountCondition: '= 3'
            });

            await asyncRepeatSerially(2, () => incBtn.click());

            // TODO: Verify is onClick [Counter.jsx] Line 24 is correct
            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 16 (normal)
                onClick [Counter.jsx] Line 24 (normal)
                ca [react-dom.production.min.js] Line 48 (normal)
                ja [react-dom.production.min.js] Line 68 (normal)
                ka [react-dom.production.min.js] Line 72 (normal)
                wa [react-dom.production.min.js] Line 139 (normal)
                Aa [react-dom.production.min.js] Line 168 (normal)
                ya [react-dom.production.min.js] Line 157 (normal)
                Da [react-dom.production.min.js] Line 231 (normal)
                Ad [react-dom.production.min.js] Line 1717 (normal)
                Gi [react-dom.production.min.js] Line 5989 (normal)
                Kb [react-dom.production.min.js] Line 659 (normal)
                Dd [react-dom.production.min.js] Line 1759 (normal)
                (anonymous function) [react-dom.production.min.js] Line 6016 (normal)
                push../node_modules/scheduler/cjs/scheduler.production.min.js.exports.unstable_runWithPriority [scheduler.production.min.js] Line 273 (normal)
                Ii [react-dom.production.min.js] Line 6015 (normal)
                Cd [react-dom.production.min.js] Line 1736 (normal)`);

            await incBtn.click();

            // await breakpoints.assertNotPaused();

            await setStateBreakpoint.unset();
        });

        puppeteerTest('DIEGO2 3 hit count breakpoints with different counts hit when appropiated', suiteContext, async (_context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');

            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            const setStateBreakpoint = await counterBreakpoints.hitCountBreakpoint({
                lineText: 'this.setState({ count: newval });',
                hitCountCondition: '= 3'
            });

            const setNewValBreakpoint = await counterBreakpoints.hitCountBreakpoint({
                lineText: 'const newval = this.state.count + 1',
                hitCountCondition: '= 5'
            });

            const stepInBreakpoint = await counterBreakpoints.hitCountBreakpoint({
                lineText: 'this.stepIn();',
                hitCountCondition: '= 4'
            });

            await Promise.all(_.times(3, () => incBtn.click()));

            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `awef
                increment [Counter.jsx] Line 16
                onClick [Counter.jsx] Line 29
                ca [react-dom.production.min.js] Line 48
                ja [react-dom.production.min.js] Line 68
                ka [react-dom.production.min.js] Line 72
                wa [react-dom.production.min.js] Line 139
                Aa [react-dom.production.min.js] Line 168
                ya [react-dom.production.min.js] Line 157
                Da [react-dom.production.min.js] Line 231
                Ad [react-dom.production.min.js] Line 1717
                Gi [react-dom.production.min.js] Line 5989
                Kb [react-dom.production.min.js] Line 659
                Dd [react-dom.production.min.js] Line 1759
                (anonymous function) [react-dom.production.min.js] Line 6016
                push../node_modules/scheduler/cjs/scheduler.production.min.js.exports.unstable_runWithPriority [scheduler.production.min.js] Line 273`);

            await stepInBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `awefeaw
                increment [Counter.jsx] Line 16
                onClick [Counter.jsx] Line 29
                ca [react-dom.production.min.js] Line 48
                ja [react-dom.production.min.js] Line 68
                ka [react-dom.production.min.js] Line 72
                wa [react-dom.production.min.js] Line 139
                Aa [react-dom.production.min.js] Line 168
                ya [react-dom.production.min.js] Line 157
                Da [react-dom.production.min.js] Line 231
                Ad [react-dom.production.min.js] Line 1717
                Gi [react-dom.production.min.js] Line 5989
                Kb [react-dom.production.min.js] Line 659
                Dd [react-dom.production.min.js] Line 1759
                (anonymous function) [react-dom.production.min.js] Line 6016
                push../node_modules/scheduler/cjs/scheduler.production.min.js.exports.unstable_runWithPriority [scheduler.production.min.js] Line 273`);

            await setNewValBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `awefawef
                increment [Counter.jsx] Line 16
                onClick [Counter.jsx] Line 29
                ca [react-dom.production.min.js] Line 48
                ja [react-dom.production.min.js] Line 68
                ka [react-dom.production.min.js] Line 72
                wa [react-dom.production.min.js] Line 139
                Aa [react-dom.production.min.js] Line 168
                ya [react-dom.production.min.js] Line 157
                Da [react-dom.production.min.js] Line 231
                Ad [react-dom.production.min.js] Line 1717
                Gi [react-dom.production.min.js] Line 5989
                Kb [react-dom.production.min.js] Line 659
                Dd [react-dom.production.min.js] Line 1759
                (anonymous function) [react-dom.production.min.js] Line 6016
                push../node_modules/scheduler/cjs/scheduler.production.min.js.exports.unstable_runWithPriority [scheduler.production.min.js] Line 273`);

            await incBtn.click();
            // await breakpoints.assertNotPaused();

            await setStateBreakpoint.unset();
        });

        puppeteerTest('DIEGO3 3 batched hit count breakpoints with different counts hit when appropiated', suiteContext, async (_context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');

            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            const setStateBreakpoint = await counterBreakpoints.unsetHitCountBreakpoint({
                lineText: 'this.setState({ count: newval });',
                hitCountCondition: '= 3'
            });

            const setNewValBreakpoint = await counterBreakpoints.unsetHitCountBreakpoint({
                lineText: 'const newval = this.state.count + 1',
                hitCountCondition: '= 5'
            });

            const stepInBreakpoint = await counterBreakpoints.unsetHitCountBreakpoint({
                lineText: 'this.stepIn();',
                hitCountCondition: '= 4'
            });

            await counterBreakpoints.batch(async () => {
                await setStateBreakpoint.setWithoutVerifying();
                await setNewValBreakpoint.setWithoutVerifying();
                await stepInBreakpoint.setWithoutVerifying();
            });

            await Promise.all(_.times(2, () => incBtn.click()));

            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), '');
            await stepInBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), '');
            await setNewValBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), '');

            await counterBreakpoints.batch(async () => {
                await setStateBreakpoint.unset();
                await setNewValBreakpoint.unset();
                await stepInBreakpoint.unset();
            });

            await Promise.all(_.times(5, () => incBtn.click()));

            await breakpoints.assertNotPaused();
        });
    });
});
