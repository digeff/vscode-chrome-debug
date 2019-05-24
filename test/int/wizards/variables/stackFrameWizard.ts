import { expect } from 'chai';
import { DebugProtocol } from 'vscode-debugprotocol';
import { THREAD_ID, ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { VariablesScopeName } from './variablesWizard';
import { ValidatedSet, IValidatedSet } from '../../core-v2/chrome/collections/validatedSet';
import { singleElementOfArray } from '../../core-v2/chrome/collections/utilities';
import { logger } from 'vscode-debugadapter';
interface IVariablesOfScope {
    scopeName: VariablesScopeName;
    variables: DebugProtocol.Variable[];
}

export class StackFrameWizard {
    public constructor(private readonly _client: ExtendedDebugClient, private readonly _stackFrame: DebugProtocol.StackFrame) { }

    public static async topStackFrame(client: ExtendedDebugClient): Promise<StackFrameWizard> {
        const stackTraceResponse = await client.send('stackTrace', { threadId: THREAD_ID });
        expect(stackTraceResponse.success).to.equal(true);
        const stackFrames = stackTraceResponse.body.stackFrames;
        expect(stackFrames.length).to.be.greaterThan(0);
        return new StackFrameWizard(client, stackFrames[0]);
    }

    public async variablesOfScopes(manyScopeNames: VariablesScopeName[]): Promise<IVariablesOfScope[]> {
        const scopes = await this.scopesByNames(manyScopeNames);
        return Promise.all(scopes.map(async scope => {
            const variablesResponse = await this._client.variablesRequest({ variablesReference: scope!.variablesReference });
            expect(variablesResponse.success).to.equal(true);
            const variables = variablesResponse.body.variables;
            return { scopeName: <VariablesScopeName>scope.name.toLowerCase(), variables };
        }));
    }

    private async scopesByNames(manyScopeNames: VariablesScopeName[]): Promise<DebugProtocol.Scope[]> {
        const scopeNamesSet = new ValidatedSet(manyScopeNames.map(name => name.toLowerCase()));
        const requestedScopes = (await this.scopes()).filter(scope => scopeNamesSet.has(scope.name.toLowerCase()));
        expect(requestedScopes).to.have.lengthOf(manyScopeNames.length);
        return requestedScopes;
    }

    public async scopes(): Promise<DebugProtocol.Scope[]> {
        const scopesResponse = await this._client.scopesRequest({ frameId: this._stackFrame.id });
        logger.log(`Scopes: ${scopesResponse.body.scopes.map(s => s.name).join(', ')}`);
        return scopesResponse.body.scopes;
    }

    public async globalVariableNames(): Promise<IValidatedSet<string>> {
        const existingGlobalVariables = await this.variablesOfScope('global');
        return new ValidatedSet(existingGlobalVariables.map(variable => variable.name));
    }

    public async variablesOfScope(scopeName: VariablesScopeName): Promise<DebugProtocol.Variable[]> {
        return singleElementOfArray(await this.variablesOfScopes([scopeName])).variables;
    }
}
