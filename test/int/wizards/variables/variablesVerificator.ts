import * as _ from 'lodash';
import { expect } from 'chai';
import { DebugProtocol } from 'vscode-debugprotocol';
import { trimWhitespace } from '../breakpoints/implementation/printedTestInputl';
import { ManyVariablesValues, } from './variablesWizard';
import { printVariables } from './variablesPrinting';

/**
 * Provide methods to validate that the variables appearing on the stack trace are what we expect
 */
export class VariablesVerificator {
    public assertVariablesAre(variables: DebugProtocol.Variable[], expectedVariablesPrinted: string | ManyVariablesValues): void {
        if (typeof expectedVariablesPrinted === 'string') {
            this.assertVariablesPrintedAre(variables, expectedVariablesPrinted);
        } else {
            this.assertVariablesValuesAre(variables, expectedVariablesPrinted);
        }
    }

    private assertVariablesPrintedAre(variables: DebugProtocol.Variable[], expectedVariablesPrinted: string): void {
        const trimmedVariables = trimWhitespace(expectedVariablesPrinted);
        expect(printVariables(variables)).to.equal(trimmedVariables);
    }

    private assertVariablesValuesAre(manyVariables: DebugProtocol.Variable[], expectedVariablesValues: ManyVariablesValues): void {
        const expectedVariablesNames = Object.keys(manyVariables);
        expect(expectedVariablesValues).to.have.keys(expectedVariablesNames);
        for (const variable of manyVariables) {
            const variableName = variable.name;
            const expectedValue = expectedVariablesValues[variableName];
            expect(expectedValue).to.not.equal(undefined);
            expect(variable!.evaluateName).to.be.equal(variable!.name); // Is this ever different?
            expect(variable!.variablesReference).to.be.greaterThan(0);
            expect(variable!.value).to.be.equal(expectedValue);
        }
    }
}
