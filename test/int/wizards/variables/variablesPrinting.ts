import { IExpectedVariables } from './variablesWizard';

export interface IVariableInformation {
    name: string;
    value: string;
    type?: string;
}

export class VariableInformation implements IVariableInformation {
    public constructor(
        public readonly name: string,
        public readonly value: string,
        public readonly type: string,
    ) { }
}

export function printVariables(variables: IVariableInformation[]): string {
    const variablesPrinted = variables.map(variable => printVariable(variable));
    return variablesPrinted.join('\n');
}

export function printVariable(variable: IVariableInformation): string {
    return `${variable.name} = ${variable.value} (${(variable.type)})`;
}

export function printVariableVerifications(variablesVerifications: IExpectedVariables): string {
    return printVariables(toManyVariablesInformation(variablesVerifications));
}

function toManyVariablesInformation(variablesVerifications: IExpectedVariables): IVariableInformation[] {
    return Object.keys(variablesVerifications).map(variableName => new VariableInformation(variableName, `${variablesVerifications[variableName]}`, getTypeName(variablesVerifications[variableName])));
}

function getTypeName(something: unknown): string {
    switch (typeof something) {
        case 'object':
            return something === null ? 'null' : something.constructor.name;
        default:
            return typeof something;
    }
}
