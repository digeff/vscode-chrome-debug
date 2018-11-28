import * as utils from '../utils';
import { Crdp } from 'vscode-chrome-debug-core';

export class DisplayOverlayWhenPaused {
    private _pagePauseMessage = 'Paused in Visual Studio Code';

    private _overlayHelper = new utils.DebounceHelper(/*timeoutMs=*/200);

    protected async onPaused(notification: Crdp.Debugger.PausedEvent, expectingStopReason = this._expectingStopReason): Promise<IOnPausedResult> {
        const result = (await super.onPaused(notification, expectingStopReason));

        if (result.didPause) {
            this._overlayHelper.doAndCancel(() => {
                return this._domains.has('Overlay') ?
                    this.chrome.Overlay.setPausedInDebuggerMessage({ message: this._pagePauseMessage }).catch(() => { }) :
                    (<any>this.chrome).Page.configureOverlay({ message: this._pagePauseMessage }).catch(() => { });
            });
        }

        return result;
    }

}