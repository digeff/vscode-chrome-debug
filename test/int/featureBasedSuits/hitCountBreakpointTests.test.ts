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

        puppeteerTest("Hit count breakpoint = 3 pauses on the button's 3rd click", suiteContext, async (_context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');

            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            const setStateBreakpoint = await counterBreakpoints.hitCountBreakpoint({
                lineText: 'this.setState({ count: newval });',
                hitCountCondition: '% 3'
            });

            await asyncRepeatSerially(2, () => incBtn.click());

            // TODO: Verify is onClick [Counter.jsx] Line 24 is correct
            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 17 (normal)
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

            await breakpoints.assertNotPaused();

            await setStateBreakpoint.unset();
        });

        puppeteerTest("Hit count breakpoints = 3 and = 5 pause on the button's 3rd and 5th clicks", suiteContext, async (_context, page) => {
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

            // const stepInBreakpoint = await counterBreakpoints.hitCountBreakpoint({
            //     lineText: 'this.stepIn();',
            //     hitCountCondition: '= 4'
            // });

            await asyncRepeatSerially(2, () => incBtn.click());

            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 17 (normal)
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

            await setNewValBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 15 (normal)
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

            await breakpoints.assertNotPaused();

            await setStateBreakpoint.unset();
            await setNewValBreakpoint.unset();
        });

        puppeteerTest("Hit count breakpoints = 3 and = 5 set in batch pause on the button's 3rd and 5th clicks", suiteContext, async (_context, page) => {
            const incBtn = await page.waitForSelector('#incrementBtn');

            const breakpoints = BreakpointsWizard.create(suiteContext.debugClient, reactTestSpecification);
            const counterBreakpoints = breakpoints.at('Counter.jsx');

            const { setStateBreakpoint, setNewValBreakpoint } = await counterBreakpoints.batch(async () => ({
                setStateBreakpoint: await counterBreakpoints.hitCountBreakpoint({
                    lineText: 'this.setState({ count: newval });',
                    hitCountCondition: '= 3'
                }),

                setNewValBreakpoint: await counterBreakpoints.hitCountBreakpoint({
                    lineText: 'const newval = this.state.count + 1',
                    hitCountCondition: '= 5'
                }),

                // const stepInBreakpoint = await counterBreakpoints.hitCountBreakpoint({
                //     lineText: 'this.stepIn();',
                //     hitCountCondition: '= 4'
                // });
            }));

            await asyncRepeatSerially(2, () => incBtn.click());

            await setStateBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 17 (normal)
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

            await setNewValBreakpoint.assertIsHitThenResumeWhen(() => incBtn.click(), `
                increment [Counter.jsx] Line 15 (normal)
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

            await breakpoints.assertNotPaused();

            await counterBreakpoints.batch(async () => {
                await setStateBreakpoint.unset();
                await setNewValBreakpoint.unset();
            });
        });
    });
});
