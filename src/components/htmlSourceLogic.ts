import { ISource, ILoadedSourceTreeNode, IScript, SourceScriptRelationship, utilities, ISourcesRetriever } from 'vscode-chrome-debug-core';
import { CDTPResourceContentGetter } from '../cdtpComponents/cdtpResourceContentGetter';
import * as _ from 'lodash';

export class HTMLSourceLogic implements ISourcesRetriever {
    constructor(
        private readonly _wrappedSourcesLogic: ISourcesRetriever,
        private readonly _resourceContentGetter: CDTPResourceContentGetter) { }

    public loadedSourcesTrees(): Promise<ILoadedSourceTreeNode[]> {
        return this._wrappedSourcesLogic.loadedSourcesTrees();
    }

    public loadedSourcesTreeForScript(script: IScript): ILoadedSourceTreeNode {
        return this._wrappedSourcesLogic.loadedSourcesTreeForScript(script);
    }

    public async text(source: ISource): Promise<string> {
        return source.tryResolving(
            async loadedSource => {
                if (loadedSource.sourceScriptRelationship === SourceScriptRelationship.SourceIsMoreThanAScript) {
                    const frameIds = _.uniq(loadedSource.scriptMapper().scripts.map(script => script.executionContext.frameId));

                    // For the time being we don't support iframes, so we assume that there is a single frameId in that collection
                    if (frameIds.length > 1) {
                        throw new Error(`iFrames are not currently supported. frame ids: ${JSON.stringify(frameIds)}`);
                    }

                    return this._resourceContentGetter.resourceContent({ url: loadedSource.url, frameId: utilities.singleElementOfArray(frameIds) });
                }
                return this._wrappedSourcesLogic.text(source);
            },
            () => this._wrappedSourcesLogic.text(source));
    }

    public async install(): Promise<this> {
        return this;
    }
}