/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import { BaseSourceMapTransformer, ChromeDebugSession, logger, OnlyProvideCustomLauncherExtensibilityPoints, telemetry, UrlPathTransformer, TYPES, ISourcesLogic, interfaces } from 'vscode-chrome-debug-core';
import { ChromeDebugAdapter } from './chromeDebugAdapter';
import { ChromeLauncher } from './launcherAndRuner/chromeLauncher';
import { defaultTargetFilter } from './utils';
import { ChromeRunner } from './launcherAndRuner/chromeRunner';
import { ArgumentsUpdater } from './argumentsUpdater';
import { HTMLSourceLogic } from './components/htmlSourceLogic';
import { CDTPResourceContentGetter } from './cdtpComponents/cdtpResourceContentGetter';
import { GetComponentByID } from 'vscode-chrome-debug-core/lib/src/chrome/dependencyInjection.ts/di';

const EXTENSION_NAME = 'debugger-for-chrome';

// Start a ChromeDebugSession configured to only match 'page' targets, which are Chrome tabs.
// Cast because DebugSession is declared twice - in this repo's vscode-debugadapter, and that of -core... TODO
const logFilePath = path.resolve(os.tmpdir(), 'vscode-chrome-debug.txt');

function customizeComponents<T>(identifier: interfaces.ServiceIdentifier<T>, component: T, getComponentById: GetComponentByID): T {
    return identifier === TYPES.SourcesLogic
        ? <T><unknown>new HTMLSourceLogic(<ISourcesLogic><unknown>component, getComponentById(CDTPResourceContentGetter))
        : component;
}
const extensibilityPoints = new OnlyProvideCustomLauncherExtensibilityPoints(logFilePath, ChromeLauncher, ChromeRunner, customizeComponents);
extensibilityPoints.updateArguments = args => new ArgumentsUpdater().updateArguments(args);

ChromeDebugSession.run(ChromeDebugSession.getSession(
    {
        adapter: ChromeDebugAdapter,
        extensionName: EXTENSION_NAME,
        logFilePath: logFilePath,
        targetFilter: defaultTargetFilter,
        extensibilityPoints: extensibilityPoints,
        pathTransformer: UrlPathTransformer,
        sourceMapTransformer: BaseSourceMapTransformer,
    }));

/* tslint:disable:no-var-requires */
const debugAdapterVersion = require('../package.json').version;
logger.log(EXTENSION_NAME + ': ' + debugAdapterVersion);

/* __GDPR__FRAGMENT__
    "DebugCommonProperties" : {
        "Versions.DebugAdapter" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    }
*/
telemetry.telemetry.addCustomGlobalProperty({ 'Versions.DebugAdapter': debugAdapterVersion });
