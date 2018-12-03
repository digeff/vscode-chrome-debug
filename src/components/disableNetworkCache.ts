import { IComponent, inject } from 'vscode-chrome-debug-core';
import { ConnectedCDAConfiguration } from 'vscode-chrome-debug-core';
import { ICommonRequestArgs } from '../chromeDebugInterfaces';
import { CDTPNetwork } from 'vscode-chrome-debug-core/lib/src/chrome/target/cdtpSmallerModules';

export class DisableNetworkCache implements IComponent {
    public async configure(configuration: ConnectedCDAConfiguration): Promise<void> {
        const configDisableNetworkCache = (<ICommonRequestArgs>configuration.args).disableNetworkCache;
        const cacheDisabled = typeof configDisableNetworkCache === 'boolean' ?
            configDisableNetworkCache :
            true;

        this._network.setCacheDisabled({ cacheDisabled }).catch(() => {
            // Ignore failure
        });
    }

    constructor(@inject(CDTPNetwork) private readonly _network: CDTPNetwork) { }
}