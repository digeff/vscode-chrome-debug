/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import { BaseSourceMapTransformer, ChromeDebugSession, logger, OnlyProvideCustomLauncherExtensibilityPoints, ISourcesRetriever, telemetry, UrlPathTransformer, TYPES, interfaces, GetComponentByID, DependencyInjection } from 'vscode-chrome-debug-core';
import { ChromeDebugAdapter } from './chromeDebugAdapter';
import { ChromeLauncher } from './launcherAndRuner/chromeLauncher';
import { defaultTargetFilter } from './utils';
import { ChromeRunner } from './launcherAndRuner/chromeRunner';
import { ArgumentsUpdater } from './argumentsUpdater';
import { HTMLSourceLogic } from './components/htmlSourceLogic';
import { CDTPResourceContentGetter } from './cdtpComponents/cdtpResourceContentGetter';
import { ShowOverlayWhenPaused, CDTPDeprecatedPage } from './features/showOverlayWhenPaused';

const EXTENSION_NAME = 'debugger-for-chrome';

// Start a ChromeDebugSession configured to only match 'page' targets, which are Chrome tabs.
// Cast because DebugSession is declared twice - in this repo's vscode-debugadapter, and that of -core... TODO
const logFilePath = path.resolve(os.tmpdir(), 'vscode-chrome-debug.txt');

function customizeComponents<T>(identifier: interfaces.ServiceIdentifier<T>, component: T, getComponentById: GetComponentByID): T {
    switch (identifier) {
        case TYPES.ISourcesRetriever:
            return <T><unknown>new HTMLSourceLogic(<ISourcesRetriever><unknown>component, getComponentById(CDTPResourceContentGetter));
        default:
            return component;
    }
}
const extensibilityPoints = new OnlyProvideCustomLauncherExtensibilityPoints(logFilePath, ChromeLauncher, ChromeRunner, customizeComponents);
extensibilityPoints.updateArguments = (scenario, args) => new ArgumentsUpdater().updateArguments(scenario, args);
extensibilityPoints.targetFilter = defaultTargetFilter;
extensibilityPoints.pathTransformer = UrlPathTransformer;
extensibilityPoints.sourceMapTransformer = BaseSourceMapTransformer;
extensibilityPoints.bindAdditionalComponents = (diContainer: DependencyInjection) => {
    diContainer.configureClass(TYPES.IServiceComponent, ShowOverlayWhenPaused);
    diContainer.configureClass(CDTPDeprecatedPage, CDTPDeprecatedPage);
};

ChromeDebugSession.run(ChromeDebugSession.getSession(
    {
        adapter: ChromeDebugAdapter,
        extensionName: EXTENSION_NAME,
        logFilePath: logFilePath,
        extensibilityPoints: extensibilityPoints
    }));

/* tslint:disable:no-var-requires */
const debugAdapterVersion = require('../../package.json').version;
logger.log(EXTENSION_NAME + ': ' + debugAdapterVersion);

/* __GDPR__FRAGMENT__
    "DebugCommonProperties" : {
        "Versions.DebugAdapter" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    }
*/
telemetry.telemetry.addCustomGlobalProperty({ 'Versions.DebugAdapter': debugAdapterVersion });
