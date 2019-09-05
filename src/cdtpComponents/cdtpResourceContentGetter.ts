/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { TYPES, inject, injectable, CDTPEnableableDiagnosticsModule, CDTP, CDTPDomainsEnabler, SourceContents } from 'vscode-chrome-debug-core';

/**
 * Chrome API to get the contents of a web-page resource. We use this to obtain the contents of an .html file which has inline scripts inside
 */
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

    public async resourceContent(params: CDTP.Page.GetResourceContentRequest): Promise<SourceContents> {
        return new SourceContents((await this.api.getResourceContent(params)).content);
    }
}
