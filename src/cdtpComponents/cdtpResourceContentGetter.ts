import { TYPES, inject, injectable, CDTPEnableableDiagnosticsModule, CDTP } from 'vscode-chrome-debug-core';
import { CDTPDomainsEnabler } from 'vscode-chrome-debug-core/lib/src/chrome/cdtpDebuggee/infrastructure/cdtpDomainsEnabler';

@injectable()
export class CDTPResourceContentGetter extends CDTPEnableableDiagnosticsModule<CDTP.PageApi>  {
    protected api = this._protocolApi.Page;

    constructor(
        @inject(TYPES.CDTPClient)
        protected _protocolApi: CDTP.ProtocolApi,
        @inject(TYPES.IDomainsEnabler) domainsEnabler: CDTPDomainsEnabler,
    ) {
        super(domainsEnabler);
    }

    public async resourceContent(params: CDTP.Page.GetResourceContentRequest): Promise<string> {
        return (await this.api.getResourceContent(params)).content;
    }
}
