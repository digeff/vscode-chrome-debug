import * as _ from 'lodash';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { PromiseOrNot } from 'vscode-chrome-debug-core';
import { StackFrameWizard } from './stackFrameWizard';
import { VariablesVerificator } from './variablesVerificator';
import { GlobalVariablesVerificator } from './globalVariablesVerificator';

export interface VariablePrintedProperties {
    value: string;
    type: string;
}

export interface ManyVariablePrintedProperties {
    [variableName: string]: VariablePrintedProperties;
}

export interface ManyVariablesValues {
    [variableName: string]: unknown;
}

export type ManyVariablesPropertiesPrinted = string;  // `${variable.name} = ${variable.value} ${(variable.type)}\n`

export type IScopeExpectedVariables = ManyVariablesPropertiesPrinted | ManyVariablesValues;

export interface IExpectedVariables {
    script?: IScopeExpectedVariables;
    local?: IScopeExpectedVariables;
    global?: IScopeExpectedVariables;
    catch?: IScopeExpectedVariables;
    block?: IScopeExpectedVariables;
    closure?: IScopeExpectedVariables;
    eval?: IScopeExpectedVariables;
    with?: IScopeExpectedVariables;
    module?: IScopeExpectedVariables;
}

export type VariablesScopeName = keyof IExpectedVariables;

export class Ignored { }

export class VariablesWizard {
    public constructor(private readonly _client: ExtendedDebugClient) { }

    public async assertNewGlobalVariariablesAre(actionThatAddsNewVariables: () => PromiseOrNot<void>, variables: ManyVariablesPropertiesPrinted): Promise<void> {
        const variablesToIgnore = await (await this.topStackFrameHelper()).globalVariableNames();
        await actionThatAddsNewVariables();
        await this.globalsVerificator.assertGlobalsOfTopFrameAre(variables, variablesToIgnore);
    }

    /**
     * Verify that the stackFrame contains some variables with a specific value
     */
    public async assertTopFrameVariablesAre(verifications: IExpectedVariables): Promise<void> {
        await this.assertStackFrameVariablesAre(await this.topStackFrameHelper(), verifications);
    }

    public async assertStackFrameVariablesAre(stackFrame: StackFrameWizard, verifications: IExpectedVariables) {
        const manyScopes = await (stackFrame).variablesOfScopes(Object.keys(verifications));
        for (const scope of manyScopes) {
            this.verificator.assertVariablesAre(scope.variables, verifications[scope.scopeName]!);
        }
    }

    private get verificator(): VariablesVerificator {
        return new VariablesVerificator();
    }

    private get globalsVerificator(): GlobalVariablesVerificator {
        return new GlobalVariablesVerificator(this._client);
    }

    private async topStackFrameHelper(): Promise<StackFrameWizard> {
        return await StackFrameWizard.topStackFrame(this._client);
    }
}
