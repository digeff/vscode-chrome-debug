import { IExtensibilityPoints, BasePathTransformer, BaseSourceMapTransformer, LineColTransformer, ILaunchRequestArgs, IAttachRequestArgs, IDebugeeLauncher } from 'vscode-chrome-debug-core';
import { ITargetFilter, ChromeConnection } from 'vscode-chrome-debug-core/lib/src/chrome/chromeConnection';

export class ChromeExtensibilityPoints implements IExtensibilityPoints {
    public readonly isPromiseRejectExceptionFilterEnabled = false;

    targetFilter?: ITargetFilter;
    chromeConnection?: typeof ChromeConnection;
    pathTransformer?: new () => BasePathTransformer;
    sourceMapTransformer?: new (enableSourcemapCaching?: boolean) => BaseSourceMapTransformer;
    lineColTransformer?: new (session: any) => LineColTransformer;

    public updateArguments<T extends ILaunchRequestArgs | IAttachRequestArgs>(argumentsFromClient: T): T {
        return argumentsFromClient;
    }

    constructor(public readonly debugeeLauncher: interfaces.Newable<IDebugeeLauncher>) {

    }
}