import identity from '../src';
import Promise from 'bluebird';
import Web3 from 'web3';

global.window = {};
global.Promise = Promise;  // Use bluebird for better error logging during development.

const passwordProvider = (callback) => callback(null, "hardcoded passwords are insecure but that's okay");
const httpProvider = new Web3.providers.HttpProvider('http://localhost:8545');
const state = {
  passwordProvider,
  identities: [],
  web3Provider: httpProvider,
};

identity.provider.IdentityProvider.initialize({ state })
  .then((provider) => provider.addNewContractIdentity(provider.substore))
  .then((id) => {
    console.log(id);
  });
