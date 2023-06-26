/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFiles: ['./jest.setup.js'],
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                diagnostics: {
                    ignoreCodes: ['TS2322'],
                },
            },
        ],
    },
    testRegex: '\\.(test|spec)\\.ts$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
    detectOpenHandles: true,
    forceExit: true,
};
