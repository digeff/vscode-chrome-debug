/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Integration tests for the React framework
 */

import * as path from 'path';
import * as testSetup from '../testSetup';
import { setBreakpoint, setConditionalBreakpoint } from '../intTestSupport';
import { puppeteerSuite, puppeteerTest } from '../puppeteer/puppeteerSuite';
import { FrameworkTestSuite } from './frameworkCommonTests';
import { TestProjectSpec } from './frameworkTestSupport';
import { loadLabelsFromFile, loadProjectLabels } from '../labels';

const DATA_ROOT = testSetup.DATA_ROOT;
const REACT_PROJECT_ROOT = path.join(DATA_ROOT, 'react', 'dist');
const TEST_SPEC = new TestProjectSpec( { projectRoot: REACT_PROJECT_ROOT } );

puppeteerSuite('React Framework Tests', TEST_SPEC, (suiteContext) => {

    suite('Common Framework Tests', () => {
        const frameworkTests = new FrameworkTestSuite('React', suiteContext);
        frameworkTests.testPageReloadBreakpoint('react_App_render');
        frameworkTests.testPauseExecution();
        frameworkTests.testBreakOnLoad('react_App_render');
    });

    suite('React specific tests', () => {

        puppeteerTest('Should hit breakpoint in .jsx file', suiteContext, async (context, page) => {
            let location = suiteContext.breakpointLabels.get('react_Counter_increment');
            await setBreakpoint(suiteContext.debugClient, location);
            let incBtn = await page.waitForSelector('#incrementBtn');
            incBtn.click();
            await suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);
            suiteContext.debugClient.continueRequest();
        });

        puppeteerTest('Should hit conditional breakpoint in .jsx file', suiteContext, async (context, page) => {
            let location = suiteContext.breakpointLabels.get('react_Counter_increment');
            await setConditionalBreakpoint(suiteContext.debugClient, location, 'this.state.count == 2');
            let incBtn = await page.waitForSelector('#incrementBtn');
            // click 3 times, state will be = 2 on the third click
            await incBtn.click();
            await incBtn.click();
            let blub = suiteContext.debugClient.assertStoppedLocation('breakpoint',  location);
            incBtn.click()
            //setTimeout(() => incBtn.click(), 250);
            // don't await the last click, as the stopped debugger will deadlock it
            await blub;
            await suiteContext.debugClient.continueRequest();
        });
    });
});
