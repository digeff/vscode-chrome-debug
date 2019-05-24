export function trimWhitespace(printedTestInput: string): string {
    return printedTestInput.replace(/^\s+/gm, '').replace(/ ?\/\/.*$/gm, ''); // Remove the white space we put at the start of the lines to make the printed test input align with the code
}