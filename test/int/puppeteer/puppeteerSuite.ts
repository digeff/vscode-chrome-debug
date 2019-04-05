/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createServer } from 'http-server';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as testSetup from '../testSetup';
import { launchTestAdapter } from '../intTestSupport';
import { getPageByUrl, connectPuppeteer } from './puppeteerSupport';
import { FrameworkTestContext, TestProjectSpec } from '../framework/frameworkTestSupport';
import { loadProjectLabels } from '../labels';
import { wrapWithMethodLogger, MethodsCalledLogger, MethodsCalledLoggerConfiguration, IMethodsCalledLoggerConfiguration, ReplacementInstruction } from '../core-v2/chrome/logging/methodsCalledLogger';
import { logger } from 'vscode-debugadapter';
import { LogLevel } from 'vscode-debugadapter/lib/logger';
import { HumanSlownessSimulator } from '../utils/humanSlownessSimulator';

// const dateTime = new Date().toISOString().replace(/:/g, '').replace('T', ' ').replace(/\.[0-9]+^/, '');
// const logPath = path.resolve(process.cwd(), 'logs', `testRun-${dateTime}.log`);
const logPath = path.resolve(process.cwd(), 'logs', `testRun.log`);
logger.init(null, logPath);
logger.setup(LogLevel.Verbose, logPath);

/**
 * Extends the normal debug adapter context to include context relevant to puppeteer tests.
 */
export interface PuppeteerTestContext extends FrameworkTestContext {
  /** The connected puppeteer browser object */
  browser: puppeteer.Browser;
  /** The currently running html page in Chrome */
  page: puppeteer.Page;
}

class PuppeteerMethodsCalledLoggerConfiguration implements IMethodsCalledLoggerConfiguration {
  public readonly replacements: ReplacementInstruction[] = [];

  public decideWhetherToWrapMethodResult(methodName: string | symbol | number, args: any, result: unknown, wrapWithName: (name: string) => void): void {
    if (methodName === 'waitForSelector') {
      wrapWithName(args[0]);
    }
  }

  public decideWhetherToWrapEventEmitterListener(receiverName: string, methodName: string | symbol | number, args: unknown[], wrapWithName: (name: string) => void): void {
  }
}

const humanSlownessSimulator = new HumanSlownessSimulator();

/**
 * Launch a test with default settings and attach puppeteer. The test will start with the debug adapter
 * and chrome launched, and puppeteer attached.
 *
 * @param description Describe what this test should be testing
 * @param context The test context for this test sutie
 * @param testFunction The inner test function that will run a test using puppeteer
 */
export async function puppeteerTest(
  description: string,
  context: FrameworkTestContext,
  testFunction: (context: PuppeteerTestContext, page: puppeteer.Page) => Promise<any>
) {
  return test(description, async function () {
    this.timeout(60000);

    logger.log(`Starting test: ${description}`);
    let debugClient = await context.debugClient;
    await launchTestAdapter(debugClient, context.testSpec.props.launchConfig);
    let browser = await connectPuppeteer(9222);



    let page = await getPageByUrl(browser, context.testSpec.props.url);
    if (process.env.MSFT_RUN_TESTS_SLOWLY === 'true') {
      page = humanSlownessSimulator.wrap(page);
    }
    const wrappedPage = new MethodsCalledLogger(new PuppeteerMethodsCalledLoggerConfiguration(), page, 'PuppeterPage').wrapped();
    await testFunction({ ...context, browser, page: wrappedPage }, wrappedPage);
    logger.log(`Ending test: ${description}`);
  });
}

/**
 * Defines a custom test suite which will:
 *     1) automatically launch a server from a test project directory,
 *     2) launch the debug adapter (with chrome)
 *
 * From there, consumers can either launch a puppeteer instrumented test, or a normal test (i.e. without puppeteer) using
 * the test methods defined here, and can get access to the relevant variables.
 *
 * @param description Description for the mocha test suite
 * @param testSpec Info about the test project on which this suite will be based
 * @param callback The inner test suite that uses this context
 */
export function puppeteerSuite(
  description: string,
  testSpec: TestProjectSpec,
  callback: (suiteContext: FrameworkTestContext) => any
): Mocha.ISuite {
  return suite(description, () => {
    let suiteContext: FrameworkTestContext = { testSpec };

    let server: any;

    setup(async () => {
      let debugClient = wrapWithMethodLogger(await testSetup.setup(), 'DebugAdapterClient');
      if (process.env.MSFT_RUN_TESTS_SLOWLY === 'true') {
        debugClient = humanSlownessSimulator.wrap(debugClient);
      }
      suiteContext.debugClient = debugClient;
      await suiteContext.debugClient;

      suiteContext.breakpointLabels = await loadProjectLabels(testSpec.props.webRoot);

      server = createServer({ root: testSpec.props.webRoot });
      server.listen(7890);
    });

    teardown(() => {
      if (server) {
        server.close();
      }
      return testSetup.teardown();
    });

    callback(suiteContext);
  });
}
