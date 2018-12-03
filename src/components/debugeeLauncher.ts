import * as fs from 'fs';
import * as path from 'path';
import * as utils from '../utils';

import {ChromeDebugAdapter as CoreDebugAdapter, logger, utils as coreUtils, ISourceMapPathOverrides, ChromeDebugSession, telemetry, ITelemetryPropertyCollector, IOnPausedResult, Version } from 'vscode-chrome-debug-core';
import { spawn, ChildProcess, fork, execSync } from 'child_process';

import { IDebugeeLauncher, ITelemetryPropertyCollector } from 'vscode-chrome-debug-core';
import * as errors from '../errors';

import * as nls from 'vscode-nls';
let localize = nls.loadMessageBundle();

export class DebugeeLauncher implements IDebugeeLauncher {
    private _chromePID: number;
    private _chromeProc: ChildProcess;

    public async launch(telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<void> {
        let runtimeExecutable: string;
        if (this._configuration.args.shouldLaunchChromeUnelevated !== undefined) {
            telemetryPropertyCollector.addTelemetryProperty('shouldLaunchChromeUnelevated', this._configuration.args.shouldLaunchChromeUnelevated.toString());
        }
        if (this._configuration.clientCapabilities.supportsLaunchUnelevatedProcessRequest) {
            telemetryPropertyCollector.addTelemetryProperty('doesHostSupportLaunchUnelevated', 'true');
        }
        if (this._configuration.args.runtimeExecutable) {
            const re = findExecutable(this._configuration.args.runtimeExecutable);
            if (!re) {
                return errors.getNotExistErrorResponse('runtimeExecutable', this._configuration.args.runtimeExecutable);
            }

            runtimeExecutable = re;
        }

        runtimeExecutable = runtimeExecutable || utils.getBrowserPath();
        if (!runtimeExecutable) {
            return coreUtils.errP(localize('attribute.chrome.missing', "Can't find Chrome - install it or set the \"runtimeExecutable\" field in the launch config."));
        }

        // Start with remote debugging enabled
        const port = this._configuration.args.port || 9222;
        const chromeArgs: string[] = [];
        const chromeEnv: coreUtils.IStringDictionary<string> = this._configuration.args.env || null;
        const chromeWorkingDir: string = this._configuration.args.cwd || null;

        if (!this._configuration.args.noDebug) {
            chromeArgs.push('--remote-debugging-port=' + port);
        }

        // Also start with extra stuff disabled
        chromeArgs.push(...['--no-first-run', '--no-default-browser-check']);
        if (this._configuration.args.runtimethis._configuration.args) {
            telemetryPropertyCollector.addTelemetryProperty('numberOfChromeCmdLineSwitchesBeingUsed', String(this._configuration.args.runtimethis._configuration.args.length));
            chromeArgs.push(...this._configuration.args.runtimethis._configuration.args);
        }

        // Set a default userDataDir, if the user opted in explicitly with 'true' or if this._configuration.args.userDataDir is not set (only when runtimeExecutable is not set).
        // Can't set it automatically with runtimeExecutable because it may not be desired with Electron, other runtimes, random scripts.
        if (
            this._configuration.args.userDataDir === true ||
            (typeof this._configuration.args.userDataDir === 'undefined' && !this._configuration.args.runtimeExecutable)
        ) {
            this._configuration.args.userDataDir = path.join(os.tmpdir(), `vscode-chrome-debug-userdatadir_${port}`);
        }

        if (this._configuration.args.userDataDir) {
            chromeArgs.push('--user-data-dir=' + this._configuration.args.userDataDir);
        }

        if (this._configuration.args._clientOverlayPausedMessage) {
            this._pagePauseMessage = this._configuration.args._clientOverlayPausedMessage;
        }

        let launchUrl: string;
        if (this._configuration.args.file) {
            launchUrl = coreUtils.pathToFileURL(this._configuration.args.file);
        } else if (this._configuration.args.url) {
            launchUrl = this._configuration.args.url;
        }

        if (launchUrl && !this._configuration.args.noDebug) {
            // We store the launch file/url provided and temporarily launch and attach to about:blank page. Once we receive configurationDone() event, we redirect the page to this file/url
            // This is done to facilitate hitting breakpoints on load
            this._userRequestedUrl = launchUrl;
            launchUrl = 'about:blank';
        }

        if (launchUrl) {
            chromeArgs.push(launchUrl);
        }

        this._chromeProc = await this.spawnChrome(runtimeExecutable, chromeArgs, chromeEnv, chromeWorkingDir, !!this._configuration.args.runtimeExecutable,
            this._configuration.args.shouldLaunchChromeUnelevated);
        if (this._chromeProc) {
            this._chromeProc.on('error', (err) => {
                const errMsg = 'Chrome error: ' + err;
                logger.error(errMsg);
                this.terminateSession(errMsg);
            });
        }

        return this._configuration.args.noDebug ? undefined :
            this.doAttach(port, launchUrl || this._configuration.args.urlFilter, this._configuration.args.address, this._configuration.args.timeout, undefined, this._configuration.args.extraCRDPChannelPort);
    }


    private async spawnChrome(chromePath: string, chromeArgs: string[], env: coreUtils.IStringDictionary<string>,
        cwd: string, usingRuntimeExecutable: boolean, shouldLaunchUnelevated: boolean): Promise<ChildProcess> {
        /* __GDPR__FRAGMENT__
        "StepNames" : {
        "LaunchTarget.LaunchExe" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
        }
        */
        this.events.emitStepStarted('LaunchTarget.LaunchExe');
        const platform = coreUtils.getPlatform();
        if (platform === coreUtils.Platform.Windows && shouldLaunchUnelevated) {
            let chromePid: number;

            if (this._doesHostSupportLaunchUnelevatedProcessRequest) {
                chromePid = await this.spawnChromeUnelevatedWithClient(chromePath, chromeArgs);
            } else {
                chromePid = await this.spawnChromeUnelevatedWithWindowsScriptHost(chromePath, chromeArgs);
            }

            this._chromePID = chromePid;
            // Cannot get the real Chrome process, so return null.
            return null;
        } else if (platform === coreUtils.Platform.Windows && !usingRuntimeExecutable) {
            const options = {
                execArgv: [],
                silent: true
            };
            if (env) {
                options['env'] = this.getFullEnv(env);
            }
            if (cwd) {
                options['cwd'] = cwd;
            }
            const chromeProc = fork(getChromeSpawnHelperPath(), [chromePath, ...chromeArgs], options);
            chromeProc.unref();

            chromeProc.on('message', data => {
                const pidStr = data.toString();
                logger.log('got chrome PID: ' + pidStr);
                this._chromePID = parseInt(pidStr, 10);
            });

            chromeProc.on('error', (err) => {
                const errMsg = 'chromeSpawnHelper error: ' + err;
                logger.error(errMsg);
            });

            chromeProc.stderr.on('data', data => {
                logger.error('[chromeSpawnHelper] ' + data.toString());
            });

            chromeProc.stdout.on('data', data => {
                logger.log('[chromeSpawnHelper] ' + data.toString());
            });

            return chromeProc;
        } else {
            logger.log(`spawn('${chromePath}', ${JSON.stringify(chromeArgs)})`);
            const options = {
                detached: true,
                stdio: ['ignore'],
            };
            if (env) {
                options['env'] = this.getFullEnv(env);
            }
            if (cwd) {
                options['cwd'] = cwd;
            }
            const chromeProc = spawn(chromePath, chromeArgs, options);
            chromeProc.unref();

            this._chromePID = chromeProc.pid;

            return chromeProc;
        }
    }

    public async disconnect(args: DebugProtocol.DisconnectArguments): Promise<void> {
        const hadTerminated = this._hasTerminated;

        // Disconnect before killing Chrome, because running "taskkill" when it's paused sometimes doesn't kill it
        super.disconnect(args);

        if ( (this._chromeProc || this._chromePID) && !hadTerminated) {
            // Only kill Chrome if the 'disconnect' originated from vscode. If we previously terminated
            // due to Chrome shutting down, or devtools taking over, don't kill Chrome.
            if (coreUtils.getPlatform() === coreUtils.Platform.Windows && this._chromePID) {
                await this.killChromeOnWindows(this._chromePID);
            } else if (this._chromeProc) {
                logger.log('Killing Chrome process');
                this._chromeProc.kill('SIGINT');
            }
        }

        this._chromeProc = null;
    }

    protected onFrameNavigated(params: Crdp.Page.FrameNavigatedEvent): void {
        if (this._userRequestedUrl) {
            const url = params.frame.url;
            const requestedUrlNoAnchor = this._userRequestedUrl.split('#')[0]; // Frame navigated url doesn't include the anchor
            if (url === requestedUrlNoAnchor || decodeURI(url) === requestedUrlNoAnchor) { // 'http://localhost:1234/test%20page' will use the not decoded version, 'http://localhost:1234/test page' will use the decoded version
                // Chrome started to navigate to the user's requested url
                this.events.emit(ChromeDebugSession.FinishedStartingUpEventName, { requestedContentWasDetected: true } as FinishedStartingUpEventArguments);
            } else if (url === 'chrome-error://chromewebdata/') {
                // Chrome couldn't retrieve the web-page in the requested url
                this.events.emit(ChromeDebugSession.FinishedStartingUpEventName, { requestedContentWasDetected: false, reasonForNotDetected: 'UnreachableURL'} as FinishedStartingUpEventArguments);
            } else if (url.startsWith('chrome-error://')) {
                // Uknown chrome error
                this.events.emit(ChromeDebugSession.FinishedStartingUpEventName, { requestedContentWasDetected: false, reasonForNotDetected: 'UnknownChromeError'} as FinishedStartingUpEventArguments);
            }
        }
    }

    public waitForDebugeeToBeReady(): Promise<void> {
        throw new Error('Method not implemented. Wait until we navigate to the frame');
    }

    public async configurationDone(): Promise<void> {
        if (this._userRequestedUrl) {
            // This means all the setBreakpoints requests have been completed. So we can navigate to the original file/url.
            this.chrome.Page.navigate({ url: this._userRequestedUrl }).then(() => {
                /* __GDPR__FRAGMENT__
                   "StepNames" : {
                      "RequestedNavigateToUserPage" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
                   }
                 */
                this.events.emitMilestoneReached('RequestedNavigateToUserPage');
            });
        }
    }

    protected install(): void {
        this.chrome.Page.on('frameNavigated', params => this.onFrameNavigated(params));
    }

    constructor(@inject(ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration) {

    }
}

function findExecutable(program: string): string | undefined {
    if (process.platform === 'win32' && !path.extname(program)) {
        const PATHEXT = process.env['PATHEXT'];
        if (PATHEXT) {
            const executableExtensions = PATHEXT.split(';');
            for (const extension of executableExtensions) {
                const programPath = program + extension;
                if (fs.existsSync(programPath)) {
                    return programPath;
                }
            }
        }
    }

    if (fs.existsSync(program)) {
        return program;
    }

    return undefined;
}
