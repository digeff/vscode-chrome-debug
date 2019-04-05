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

puppeteerSuite('React Framework Tests', reactTestSpecification, (suiteContext) => {
    suite('Hit count breakpoints tests', () => {

        puppeteerTest('DIEGO1 = 3 hit count breakpoint hits on the 3rd click', suiteContext, async (context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');

            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            const setStateBreakpoint = await counterBreakpoints.hitCountBreakpoint({
                lineText: 'this.setState({ count: newval });',
                hitCountCondition: '= 3'
            });

            await asyncRepeatSerially(2, () => incBtn.click());

            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
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
                push../node_modules/scheduler/cjs/scheduler.production.min.js.exports.unstable_runWithPriority [scheduler.production.min.js] Line 273
                Ii [react-dom.production.min.js] Line 6015
                Cd [react-dom.production.min.js] Line 1736`);

            await incBtn.click();

            // await breakpoints.assertNotPaused();

            await setStateBreakpoint.unset();
        });

        puppeteerTest('DIEGO2 3 hit count breakpoints with different counts hit when appropiated', suiteContext, async (context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');

            await incBtn.click();

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
                hitCountCondition: '= 3'
            });

            await Promise.all(_.times(2, () => incBtn.click()));

            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
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
            await stepInBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
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
            await setNewValBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
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

        puppeteerTest('DIEGO3 3 batched hit count breakpoints with different counts hit when appropiated', suiteContext, async (context, page) => {
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

            counterBreakpoints.batch(async () => {
                setStateBreakpoint.set();
                setNewValBreakpoint.set();
                stepInBreakpoint.set();
            });

            const incBtn = await page.waitForSelector('#incrementBtn');
            await Promise.all(_.times(2, () => incBtn.click()));

            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), '');
            await stepInBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), '');
            await setNewValBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), '');

            await incBtn.click();
            await breakpoints.assertNotPaused();

            await setStateBreakpoint.unset();
        });
    });
});
