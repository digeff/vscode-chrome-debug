import { ISourcesLogic, IResourceIdentifier, ISource, ILoadedSourceTreeNode, IScript, SourceScriptRelationship, utilities } from 'vscode-chrome-debug-core';
import { CDTPResourceContentGetter } from '../cdtpComponents/cdtpResourceContentGetter';
import * as _ from 'lodash';

export class HTMLSourceLogic implements ISourcesLogic {
    constructor(private readonly _wrappedSourcesLogic: ISourcesLogic, private readonly _resourceContentGetter: CDTPResourceContentGetter) { }

    public createSourceResolver(sourceIdentifier: IResourceIdentifier<string>): ISource {
        return this._wrappedSourcesLogic.createSourceResolver(sourceIdentifier);
    }

    public getLoadedSourcesTrees(): Promise<ILoadedSourceTreeNode[]> {
        return this._wrappedSourcesLogic.getLoadedSourcesTrees();
    }

    public getLoadedSourcesTreeForScript(script: IScript): ILoadedSourceTreeNode {
        return this._wrappedSourcesLogic.getLoadedSourcesTreeForScript(script);
    }

    public async getText(source: ISource): Promise<string> {
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
                return this._wrappedSourcesLogic.getText(source);
            },
            () => this._wrappedSourcesLogic.getText(source));
    }

    public async install(): Promise<this> {
        await this._wrappedSourcesLogic.install();
        return this;
    }
}