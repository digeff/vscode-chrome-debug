import { ISourcesLogic, IResourceIdentifier, ISource, ILoadedSourceTreeNode, IScript, SourceScriptRelationship } from 'vscode-chrome-debug-core';
import { CDTPResourceContentGetter } from '../cdtpComponents/cdtpResourceContentGetter';

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
                    return this._resourceContentGetter.resourceContent({ url: loadedSource.url, frameId: 0 });
                }
                return this._wrappedSourcesLogic.getText(source);
            },
            () => this._wrappedSourcesLogic.getText(source));
    }
}