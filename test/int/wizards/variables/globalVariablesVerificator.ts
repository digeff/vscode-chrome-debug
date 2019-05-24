import { expect } from 'chai';
import { ManyVariablesPropertiesPrinted } from "./ManyVariablesPropertiesPrinted";
import { trimWhitespace } from '../breakpoints/implementation/printedTestInputl';
import { printVariables } from './variablesPrinting';
import { IValidatedSet } from '../../core-v2/chrome/collections/validatedSet';
import { StackFrameWizard } from './stackFrameWizard';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';

export class GlobalVariablesVerificator {
    public constructor(private readonly _client: ExtendedDebugClient) { }

    public async assertGlobalsOfTopFrameAre(expectedGlobals: ManyVariablesPropertiesPrinted, namesOfGlobalsToIgnore: IValidatedSet<string>): Promise<void> {
        const globalsOnFrame = await (await this.topStackFrameHelper()).variablesOfScope('global');
        const nonIgnoredGlobals = globalsOnFrame.filter(global => !namesOfGlobalsToIgnore.has(global.name));
        const expectedGlobalsTrimmed = trimWhitespace(expectedGlobals);
        expect(printVariables(nonIgnoredGlobals)).to.equal(expectedGlobalsTrimmed);
    }

    private async topStackFrameHelper(): Promise<StackFrameWizard> {
        return await StackFrameWizard.topStackFrame(this._client);
    }
}