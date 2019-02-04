import * as utils from '../utils';
import { CDTP, IPausedOverlay, ISupportedDomains, Internal, ICommunicator, inject, TYPES, CDTPEventsEmitterDiagnosticsModule, ConnectedCDAConfiguration, CDTPDomainsEnabler } from 'vscode-chrome-debug-core';
import { ILaunchRequestArgs } from '../chromeDebugInterfaces';

export class ShowOverlayWhenPaused {
    private _pagePauseMessage = 'Paused in Visual Studio Code';
    private _overlayHelper = new utils.DebounceHelper(/*timeoutMs=*/200);
    private _removeMessageOnResume = false;

    protected async onGoingToPauseClient(): Promise<void> {
        this._overlayHelper.doAndCancel(async () => {
            try {
                this._supportedDomains.isSupported('Overlay') ?
                    await this._pausedOverlay.setPausedInDebuggerMessage({ message: this._pagePauseMessage }) :
                    await this._deprecatedPage.configureOverlay({ message: this._pagePauseMessage });
                this._removeMessageOnResume = true;
            } catch {
                // Ignore any errors caused by this feature given that it's not critical
                // TODO: Add telemetry
            }
        });
    }

    protected onResumed(): void {
        this._overlayHelper.wait(async () => {
            if (this._removeMessageOnResume) {
                this._removeMessageOnResume = false;
                try {
                    this._supportedDomains.isSupported('Overlay') ?
                        await this._pausedOverlay.setPausedInDebuggerMessage({}) :
                        await this._deprecatedPage.configureOverlay({});
                } catch {
                    // Ignore any errors caused by this feature given that it's not critical
                    // TODO: Add telemetry
                }
            }
        });
    }

    constructor(
        @inject(TYPES.IPausedOverlay) private readonly _pausedOverlay: IPausedOverlay,
        @inject(CDTPDeprecatedPage) private readonly _deprecatedPage: CDTPDeprecatedPage,
        @inject(TYPES.ISupportedDomains) private readonly _supportedDomains: ISupportedDomains,
        @inject(TYPES.communicator) readonly communicator: ICommunicator,
        @inject(TYPES.ConnectedCDAConfiguration) _configuration: ConnectedCDAConfiguration,
    ) {
        const subscribeToGoingToPauseClient = this.communicator.getSubscriber(Internal.Breakpoints.OnGoingToPauseClient);
        subscribeToGoingToPauseClient(this.onGoingToPauseClient);
        const clientOverlayPausedMessage = (<ILaunchRequestArgs>_configuration.args)._clientOverlayPausedMessage;
        if (clientOverlayPausedMessage) {
            this._pagePauseMessage = clientOverlayPausedMessage;
        }
    }
}

export class CDTPDeprecatedPage extends CDTPEventsEmitterDiagnosticsModule<CDTP.PageApi> {
    public configureOverlay(params: unknown): Promise<void> {
        return (<any>this.api).configureOverlay(params);
    }

    constructor(
        protected api: CDTP.PageApi,
        _domainsEnabler: CDTPDomainsEnabler) {
        super(_domainsEnabler);
    }
}
