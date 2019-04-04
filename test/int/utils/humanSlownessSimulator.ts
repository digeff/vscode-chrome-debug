/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { utils } from 'vscode-chrome-debug-core';

export class HumanSlownessSimulator {
    public constructor(private readonly _slownessInMillisecondsValueGenerator: () => number = () => 500) { }

    public simulateSlowness(): Promise<void> {
        return utils.promiseTimeout(null, this._slownessInMillisecondsValueGenerator());
    }

    public wrap<T extends object>(object: T): T {
        return new HumanSpeedProxy(this, object).wrapped();
    }
}

export class HumanSpeedProxy<T extends object> {
    constructor(
        private readonly _humanSlownessSimulator: HumanSlownessSimulator,
        private readonly _objectToWrap: T) {
    }

    public wrapped(): T {
        const handler = {
            get: <K extends keyof T>(target: T, propertyKey: K, _receiver: any) => {
                this._humanSlownessSimulator.simulateSlowness();
                const originalPropertyValue = target[propertyKey];
                if (typeof originalPropertyValue === 'function') {
                    return (...args: any) => {
                        const result = originalPropertyValue.apply(target, args);
                        if (result && result.then) {
                            // Currently we only slow down async operations
                            return result.then(async (promiseResult: object) => {
                                await this._humanSlownessSimulator.simulateSlowness();
                                return typeof promiseResult === 'object'
                                    ? this._humanSlownessSimulator.wrap(promiseResult)
                                    : promiseResult;
                            }, (rejection: unknown) => {
                                return rejection;
                            });
                        }
                    };
                } else {
                    return originalPropertyValue;
                }
            }
        };

        return new Proxy<T>(this._objectToWrap, handler);
    }
}
