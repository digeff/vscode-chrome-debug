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
import { BreakpointsWizard as BreakpointsWizard } from '../wizards/breakpoints/breakpointsWizard';
import { asyncRepeatSerially } from '../utils/repeat';

puppeteerSuite('Hit count breakpoints on a React project', reactTestSpecification, (suiteContext) => {
    suite('Some basic tests', () => {

        const reactCounterAppBaseStack = `
            ca [react-dom.production.min.js] Line 49:1 (normal)
            ja [react-dom.production.min.js] Line 69:1 (normal)
            ka [react-dom.production.min.js] Line 73:1 (normal)
            wa [react-dom.production.min.js] Line 140:1 (normal)
            Aa [react-dom.production.min.js] Line 169:6 (normal)
            ya [react-dom.production.min.js] Line 158:1 (normal)
            Da [react-dom.production.min.js] Line 232:1 (normal)
            Ad [react-dom.production.min.js] Line 1718:1 (normal)
            Gi [react-dom.production.min.js] Line 5990:1 (normal)
            Kb [react-dom.production.min.js] Line 660:1 (normal)
            Dd [react-dom.production.min.js] Line 1760:1 (normal)
            (anonymous function) [react-dom.production.min.js] Line 6017:1 (normal)
            push../node_modules/scheduler/cjs/scheduler.production.min.js.exports.unstable_runWithPriority [scheduler.production.min.js] Line 274:1 (normal)
            Ii [react-dom.production.min.js] Line 6016:1 (normal)
            Cd [react-dom.production.min.js] Line 1737:1 (normal)`;

        puppeteerTest("Hit count breakpoint = 3 pauses on the button's 3rd click", suiteContext, async (_context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');

            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            const setStateBreakpoint = await counterBreakpoints.hitCountBreakpoint({
                lineText: 'this.setState({ count: newval });',
                hitCountCondition: '% 3'
            });

            await asyncRepeatSerially(2, () => incBtn.click());

            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 17:12 (normal)
                onClick [Counter.jsx] Line 30:60 (normal)
                ${reactCounterAppBaseStack}`);

            await incBtn.click();

            await breakpoints.assertNotPaused();

            await setStateBreakpoint.unset();
        });

        puppeteerTest("Hit count breakpoints = 3, = 4 and = 5 pause on the button's 3rd, 4th and 5th clicks", suiteContext, async (_context, page) => {
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

            await asyncRepeatSerially(2, () => incBtn.click());

            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 17:12 (normal)
                onClick [Counter.jsx] Line 30:60 (normal)
                ${reactCounterAppBaseStack}`);

            await stepInBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 18:12 (normal)
                onClick [Counter.jsx] Line 30:60 (normal)
                ${reactCounterAppBaseStack}`);

            await setNewValBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 16:27 (normal)
                onClick [Counter.jsx] Line 30:60 (normal)
                ${reactCounterAppBaseStack}`);

            await incBtn.click();

            await breakpoints.assertNotPaused();

            await setStateBreakpoint.unset();
            await setNewValBreakpoint.unset();
            await stepInBreakpoint.unset();
        });

        puppeteerTest("Hit count breakpoints = 3, = 4 and = 5 set in batch pause on the button's 3rd, 4th and 5th clicks", suiteContext, async (_context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');

            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            const { setStateBreakpoint, stepInBreakpoint, setNewValBreakpoint } = await counterBreakpoints.batch(async () => ({
                setStateBreakpoint: await counterBreakpoints.hitCountBreakpoint({
                    lineText: 'this.setState({ count: newval });',
                    hitCountCondition: '= 3'
                }),

                setNewValBreakpoint: await counterBreakpoints.hitCountBreakpoint({
                    lineText: 'const newval = this.state.count + 1',
                    hitCountCondition: '= 5'
                }),

                stepInBreakpoint: await counterBreakpoints.hitCountBreakpoint({
                    lineText: 'this.stepIn();',
                    hitCountCondition: '= 4'
                })
            }));

            await asyncRepeatSerially(2, () => incBtn.click());

            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 17:12 (normal)
                onClick [Counter.jsx] Line 30:60 (normal)
                ${reactCounterAppBaseStack}`);

            await stepInBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 18:12 (normal)
                onClick [Counter.jsx] Line 30:60 (normal)
                ${reactCounterAppBaseStack}`);

            await setNewValBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 16:27 (normal)
                onClick [Counter.jsx] Line 30:60 (normal)
                ${reactCounterAppBaseStack}`);

            await incBtn.click();

            await breakpoints.assertNotPaused();

            await counterBreakpoints.batch(async () => {
                await setStateBreakpoint.unset();
                await setNewValBreakpoint.unset();
                await stepInBreakpoint.unset();
            });
        });
    });
});
