/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as os from 'os';
import * as utils from './utils';

import {ChromeDebugAdapter as CoreDebugAdapter, logger, utils as coreUtils, ISourceMapPathOverrides,
    telemetry, ITelemetryPropertyCollector, Version } from 'vscode-chrome-debug-core';
import {  fork, execSync } from 'child_process';
import { DebugProtocol } from 'vscode-debugprotocol';

import { ILaunchRequestArgs, IAttachRequestArgs, ICommonRequestArgs, ISetExpressionArgs, VSDebugProtocolCapabilities, ISetExpressionResponseBody } from './chromeDebugInterfaces';

// Keep in sync with sourceMapPathOverrides package.json default
const DefaultWebSourceMapPathOverrides: ISourceMapPathOverrides = {
    'webpack:///./~/*': '${webRoot}/node_modules/*',
    'webpack:///./*': '${webRoot}/*',
    'webpack:///*': '*',
    'webpack:///src/*': '${webRoot}/*',
    'meteor://💻app/*': '${webRoot}/*'
};

interface IExtendedInitializeRequestArguments extends DebugProtocol.InitializeRequestArguments {
    supportsLaunchUnelevatedProcessRequest?: boolean;
}

export class ChromeDebugAdapter extends CoreDebugAdapter {
    private _userRequestedUrl: string;

    public async initialize(args: IExtendedInitializeRequestArguments): Promise<VSDebugProtocolCapabilities> {
        const capabilities: VSDebugProtocolCapabilities = await super.initialize(args);
        capabilities.supportsRestartRequest = true;
        capabilities.supportsSetExpression = true;
        capabilities.supportsLogPoints = true;

        return capabilities;
    }

    public launch(args: ILaunchRequestArgs, telemetryPropertyCollector: ITelemetryPropertyCollector, _seq?: number): Promise<void> {
        if ((args.breakOnLoad || typeof args.breakOnLoad === 'undefined') && !args.breakOnLoadStrategy) {
            args.breakOnLoadStrategy = 'instrument';
        }

        return super.launch(args, telemetryPropertyCollector).then(async () => {

        });
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        if (args.urlFilter) {
            args.url = args.urlFilter;
        }

        return super.attach(args);
    }

    protected doAttach(port: number, targetUrl?: string, address?: string, timeout?: number, websocketUrl?: string, extraCRDPChannelPort?: number): Promise<void> {
        return super.doAttach(port, targetUrl, address, timeout, websocketUrl, extraCRDPChannelPort).then(async () => {
            // Don't return this promise, a failure shouldn't fail attach
            this.globalEvaluate({ expression: 'navigator.userAgent', silent: true })
                .then(
                    evalResponse => logger.log('Target userAgent: ' + evalResponse.result.value),
                    err => logger.log('Getting userAgent failed: ' + err.message));

            const versionInformationPromise = this.chrome.Browser.getVersion().then(
                response => {
                    const properties = {
                        'Versions.Target.CRDPVersion': response.protocolVersion,
                        'Versions.Target.Revision': response.revision,
                        'Versions.Target.UserAgent': response.userAgent,
                        'Versions.Target.V8': response.jsVersion
                    };

                    const parts = (response.product || '').split('/');
                    if (parts.length === 2) { // Currently response.product looks like "Chrome/65.0.3325.162" so we split the project and the actual version number
                        properties['Versions.Target.Project'] =  parts[0];
                        properties['Versions.Target.Version'] =  parts[1];
                    } else { // If for any reason that changes, we submit the entire product as-is
                        properties['Versions.Target.Product'] = response.product;
                    }
                    return properties;
                },
                err => {
                    logger.log('Getting userAgent failed: ' + err.message);
                    const properties = { 'Versions.Target.NoUserAgentReason': 'Error while retriving target user agent' } as telemetry.IExecutionResultTelemetryProperties;
                    coreUtils.fillErrorDetails(properties, err);
                    return properties;
                });

            // Send the versions information as it's own event so we can easily backfill other events in the user session if needed
            /* __GDPR__FRAGMENT__
               "VersionInformation" : {
                  "Versions.Target.CRDPVersion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.Revision" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.UserAgent" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.V8" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.V<NUMBER>" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.Project" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.Version" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.Product" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "Versions.Target.NoUserAgentReason" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "${include}": [ "${IExecutionResultTelemetryProperties}" ]
               }
             */
            /* __GDPR__
               "target-version" : {
                  "${include}": [ "${DebugCommonProperties}" ]
               }
             */
            versionInformationPromise.then(versionInformation => telemetry.telemetry.reportEvent('target-version', versionInformation));

            try {
                if (this._breakOnLoadHelper) {
                    // This is what -core is doing. We only actually care to see if this fails, to see if we need to apply the workaround
                    const browserVersion = (await this._chromeConnection.version).browser;
                    if (!browserVersion.isAtLeastVersion(0, 1)) { // If this is true it means it's unknown version
                        logger.log(`/json/version failed, attempting workaround to get the version`);
                        // If the original way failed, we try to use versionInformationPromise to get this information
                        const versionInformation = await versionInformationPromise;
                        const alternativeBrowserVersion = Version.parse(versionInformation['Versions.Target.Version']);
                        this._breakOnLoadHelper.setBrowserVersion(alternativeBrowserVersion);
                    }
                }
            } catch (exception) {
                // If something fails we report telemetry and we ignore it
                telemetry.telemetry.reportEvent('break-on-load-target-version-workaround-failed', exception);
            }

            /* __GDPR__FRAGMENT__
                "DebugCommonProperties" : {
                    "${include}": [ "${VersionInformation}" ]
                }
            */
            telemetry.telemetry.addCustomGlobalProperty(versionInformationPromise);
        });
    }

    protected runConnection(): Promise<void>[] {
        return [
            ...super.runConnection(),
            this.chrome.Page.enable(),
            this.chrome.Network.enable({})
        ];
    }

    protected threadName(): string {
        return 'Chrome';
    }

    protected onResumed(): void {
        this._overlayHelper.wait(() => {
            return this._domains.has('Overlay') ?
                this.chrome.Overlay.setPausedInDebuggerMessage({ }).catch(() => { }) :
                (<any>this.chrome).Page.configureOverlay({ }).catch(() => { });
        });
        super.onResumed();
    }

    private async killChromeOnWindows(chromePID: number): Promise<void> {
        let taskkillCmd = `taskkill /PID ${chromePID}`;
        logger.log(`Killing Chrome process by pid: ${taskkillCmd}`);
        try {
            execSync(taskkillCmd);
        } catch (e) {
            // The command will fail if process was not found. This can be safely ignored.
        }

        for (let i = 0 ; i < 10; i++) {
            // Check to see if the process is still running, with CSV output format
            let tasklistCmd = `tasklist /FI "PID eq ${chromePID}" /FO CSV`;
            logger.log(`Looking up process by pid: ${tasklistCmd}`);
            let tasklistOutput = execSync(tasklistCmd).toString();

            // If the process is found, tasklist will output CSV with one of the values being the PID. Exit code will be 0.
            // If the process is not found, tasklist will give a generic "not found" message instead. Exit code will also be 0.
            // If we see an entry in the CSV for the PID, then we can assume the process was found.
            if (!tasklistOutput.includes(`"${chromePID}"`)) {
                logger.log(`Chrome process with pid ${chromePID} is not running`);
                return;
            }

            // Give the process some time to close gracefully
            logger.log(`Chrome process with pid ${chromePID} is still alive, waiting...`);
            await new Promise<void>((resolve) => {
                setTimeout(resolve, 200);
            });
        }

        // At this point we can assume the process won't close on its own, so force kill it
        let taskkillForceCmd = `taskkill /F /PID ${chromePID}`;
        logger.log(`Killing Chrome process timed out. Killing again using force: ${taskkillForceCmd}`);
        try {
            execSync(taskkillForceCmd);
        } catch (e) {}
    }

    /**
     * Opt-in event called when the 'reload' button in the debug widget is pressed
     */
    public restart(): Promise<void> {
        return this.chrome ?
            this.chrome.Page.reload({ ignoreCache: true }) :
            Promise.resolve();
    }

    private async spawnChromeUnelevatedWithWindowsScriptHost(chromePath: string, chromeArgs: string[]): Promise<number> {
        const semaphoreFile = path.join(os.tmpdir(), 'launchedUnelevatedChromeProcess.id');
        if (fs.existsSync(semaphoreFile)) { // remove the previous semaphoreFile if it exists.
            fs.unlinkSync(semaphoreFile);
        }
        const chromeProc = fork(getChromeSpawnHelperPath(),
            [`${process.env.windir}\\System32\\cscript.exe`, path.join(__dirname, 'launchUnelevated.js'),
            semaphoreFile, chromePath, ...chromeArgs], {});

        chromeProc.unref();
        await new Promise<void>((resolve, _reject) => {
            chromeProc.on('message', resolve);
        });

        const pidStr = await findNewlyLaunchedChromeProcess(semaphoreFile);

        if (pidStr) {
            logger.log(`Parsed output file and got Chrome PID ${pidStr}`);
            return parseInt(pidStr, 10);
        }

        return null;
    }

    private getFullEnv(customEnv: coreUtils.IStringDictionary<string>): coreUtils.IStringDictionary<string> {
        const env = {
            ...process.env,
            ...customEnv
        };

        Object.keys(env).filter(k => env[k] === null).forEach(key => delete env[key]);
        return env;
    }

    private async spawnChromeUnelevatedWithClient(chromePath: string, chromeArgs: string[]): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this._session.sendRequest('launchUnelevated', {
                'process': chromePath,
                'args': chromeArgs
            }, 10000, (response) => {
                if (!response.success) {
                    reject(new Error(response.message));
                } else {
                    resolve(response.body.processId);
                }
            });
        });
    }

    public async setExpression(args: ISetExpressionArgs): Promise<ISetExpressionResponseBody> {
        const reconstructedExpression = `${args.expression} = ${args.value}`;
        const evaluateEventArgs: DebugProtocol.EvaluateArguments = {
            expression: reconstructedExpression,
            frameId: args.frameId,
            format: args.format,
            context: 'repl'
        };

        const evaluateResult = await this.evaluate(evaluateEventArgs);
        return {
            value: evaluateResult.result
        };
        // Beware that after the expression is changed, the variables on the current stackFrame will not
        // be updated, which means the return value of the Runtime.getProperties request will not contain
        // this change until the breakpoint is released(step over or continue).
        //
        // See also: https://bugs.chromium.org/p/chromium/issues/detail?id=820535
    }

}

function getSourceMapPathOverrides(webRoot: string, sourceMapPathOverrides?: ISourceMapPathOverrides): ISourceMapPathOverrides {
    return sourceMapPathOverrides ? resolveWebRootPattern(webRoot, sourceMapPathOverrides, /*warnOnMissing=*/true) :
            resolveWebRootPattern(webRoot, DefaultWebSourceMapPathOverrides, /*warnOnMissing=*/false);
}

/**
 * Returns a copy of sourceMapPathOverrides with the ${webRoot} pattern resolved in all entries.
 *
 * dynamically required by test
 */
export function resolveWebRootPattern(webRoot: string, sourceMapPathOverrides: ISourceMapPathOverrides, warnOnMissing: boolean): ISourceMapPathOverrides {
    const resolvedOverrides: ISourceMapPathOverrides = {};
    for (let pattern in sourceMapPathOverrides) {
        const replacePattern = replaceWebRootInSourceMapPathOverridesEntry(webRoot, pattern, warnOnMissing);
        const replacePatternValue = replaceWebRootInSourceMapPathOverridesEntry(webRoot, sourceMapPathOverrides[pattern], warnOnMissing);

        resolvedOverrides[replacePattern] = replacePatternValue;
    }

    return resolvedOverrides;
}

function replaceWebRootInSourceMapPathOverridesEntry(webRoot: string, entry: string, warnOnMissing: boolean): string {
    const webRootIndex = entry.indexOf('${webRoot}');
    if (webRootIndex === 0) {
        if (webRoot) {
            return entry.replace('${webRoot}', webRoot);
        } else if (warnOnMissing) {
            logger.log('Warning: sourceMapPathOverrides entry contains ${webRoot}, but webRoot is not set');
        }
    } else if (webRootIndex > 0) {
        logger.log('Warning: in a sourceMapPathOverrides entry, ${webRoot} is only valid at the beginning of the path');
    }

    return entry;
}

function getChromeSpawnHelperPath(): string {
    return path.join(__dirname, 'chromeSpawnHelper.js');
}

async function findNewlyLaunchedChromeProcess(semaphoreFile: string): Promise<string> {
    const regexPattern = /processid\s+=\s+(\d+)\s*;/i;
    let lastAccessFileContent: string;
    for (let i = 0 ; i < 25; i++) {
        if (fs.existsSync(semaphoreFile)) {
            lastAccessFileContent = fs.readFileSync(semaphoreFile, {
                encoding: 'utf16le'
            }).toString();

            const lines = lastAccessFileContent.split('\n');

            const matchedLines = (lines || []).filter(line => line.match(regexPattern));
            if (matchedLines.length > 1) {
                throw new Error(`Unexpected semaphore file format ${lines}`);
            }

            if (matchedLines.length === 1) {
                const match = matchedLines[0].match(regexPattern);
                return match[1];
            }
            // else == 0, wait for 200 ms delay and try again.
        }
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 200);
        });
    }

    const error = new Error(`Cannot acquire Chrome process id`);
    let telemetryProperties: any = {
        semaphoreFileContent: lastAccessFileContent
    };

    coreUtils.fillErrorDetails(telemetryProperties, error);

    /* __GDPR__
       "error" : {
          "semaphoreFileContent" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
          "${include}": [
              "${IExecutionResultTelemetryProperties}",
              "${DebugCommonProperties}"
            ]
       }
     */
    telemetry.telemetry.reportEvent('error', telemetryProperties);

    return null;
}