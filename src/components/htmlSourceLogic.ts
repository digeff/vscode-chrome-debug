/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { SourceScriptRelationship, utilities, ISourceTextRetriever,
    IPossiblyRetrievableText, ILoadedSource, RetrievableText, NonRetrievableText, SourceContents } from 'vscode-chrome-debug-core';
import { CDTPResourceContentGetter } from '../cdtpComponents/cdtpResourceContentGetter';
import * as _ from 'lodash';
import { logger } from 'vscode-debugadapter';

/**
 * We use our own version of the ISourcesRetriever component which adds support for getting the source of .html files with potentially multiple inline scripts
 */
export class HTMLSourceRetriever implements ISourceTextRetriever {
    constructor(
        private readonly _wrappedSourcesLogic: ISourceTextRetriever,
        private readonly _resourceContentGetter: CDTPResourceContentGetter) { }

    public retrievability(loadedSource: ILoadedSource): IPossiblyRetrievableText {
        const existingRetrievability = this._wrappedSourcesLogic.retrievability(loadedSource);

        logger.log(`DIEGO ${existingRetrievability.isRetrievable} LALA ${loadedSource.sourceScriptRelationship === SourceScriptRelationship.SourceIsMoreThanAScript}`);
        if (!existingRetrievability.isRetrievable && loadedSource.sourceScriptRelationship === SourceScriptRelationship.SourceIsMoreThanAScript) {
            const frameIds = _.uniq(loadedSource.scriptMapper().scripts.map(script => script.executionContext.frameId));

            // For the time being we don't support iframes, so we assume that there is a single frameId in that collection
            if (frameIds.length > 1) {
                return new NonRetrievableText(() => {
                    throw new Error(`iFrames are not currently supported. frame ids: ${JSON.stringify(frameIds)}`);
                });
            }

            return new RetrievableText(() => this._resourceContentGetter.resourceContent({ url: loadedSource.url, frameId: utilities.singleElementOfArray(frameIds) }));
        }

        return existingRetrievability;
    }

    public async text(loadedSource: ILoadedSource): Promise<SourceContents> {
        return this._wrappedSourcesLogic.text(loadedSource);
    }

    public async install(): Promise<this> {
        return this;
    }
}