/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ChromeDebugAdapter as CoreDebugAdapter, logger, utils as coreUtils } from 'vscode-chrome-debug-core';
import { ChildProcess, execSync } from 'child_process';
import { DebugProtocol } from 'vscode-debugprotocol';

import { IAttachRequestArgs, ISetExpressionArgs, VSDebugProtocolCapabilities, ISetExpressionResponseBody } from './chromeDebugInterfaces';

interface IExtendedInitializeRequestArguments extends DebugProtocol.InitializeRequestArguments {
    supportsLaunchUnelevatedProcessRequest?: boolean;
}

export class ChromeDebugAdapter extends CoreDebugAdapter {
    private _chromeProc: ChildProcess;
    private _chromePID: number;
    private _hasTerminated: boolean;

    public async initialize(args: IExtendedInitializeRequestArguments): Promise<VSDebugProtocolCapabilities> {
        const capabilities: VSDebugProtocolCapabilities = await super.initialize(args);
        capabilities.supportsRestartRequest = true;
        capabilities.supportsSetExpression = true;
        capabilities.supportsLogPoints = true;
        return capabilities;
    }

    public attach(args: IAttachRequestArgs): Promise<void> {
        if (args.urlFilter) {
            args.url = args.urlFilter;
        }

        return super.attach(args);
    }

    protected threadName(): string {
        return 'Chrome';
    }

    public async disconnect(args: DebugProtocol.DisconnectArguments): Promise<void> {
        const hadTerminated = this._hasTerminated;

        // Disconnect before killing Chrome, because running "taskkill" when it's paused sometimes doesn't kill it
        super.disconnect(args);

        if ((this._chromeProc || this._chromePID) && !hadTerminated) {
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

    private async killChromeOnWindows(chromePID: number): Promise<void> {
        let taskkillCmd = `taskkill /PID ${chromePID}`;
        logger.log(`Killing Chrome process by pid: ${taskkillCmd}`);
        try {
            execSync(taskkillCmd);
        } catch (e) {
            // The command will fail if process was not found. This can be safely ignored.
        }

        for (let i = 0; i < 10; i++) {
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
        } catch (e) { }
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
