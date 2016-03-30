import _ from 'lodash';
import Web3 from 'web3';
import * as contracts from './contracts';
import {promiseCallback} from './lib/callbacks';


export const defaultConfig = {
  defaultGas: 3000000,
  contracts,
};

function buildWeb3() {
  return new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}

export class Config {
  constructor(overrides) {
    // Override defaults with the provided config and assign them to this object.
    _.merge(this, defaultConfig, overrides);

    if (this.web3 == null) {
      this.web3 = buildWeb3();
    }

    if (this.account == null) {
      // Load an account from the web3 provider as a fallback. this.initialize
      // is a Promise that clients can wait on to make sure initialization has
      // completed before they use this data.
      this.initialize = new Promise((resolve, reject) => {
        this.web3.eth.getAccounts(promiseCallback(resolve, reject));
      }).then((result) => {
        this.account = result[0];
      });
    } else {
      this.initialize = Promise.resolve();
    }
  }
}

/**
 * Generate an initialized config.
 * This is less error-prone than directly constructing a Config. It's easy to
 * forget to wait for config.initialize to resolve. This interface avoids that.
 * @return {Promise<Config>}
 */
export function initialize(overrides) {
  const config = new Config(overrides);
  return config.initialize.then(() => config);
}
