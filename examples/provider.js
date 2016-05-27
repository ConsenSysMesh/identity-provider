/**
 * NOTE: To run this, the npm version of eth-lightwallet must be installed, not
 * the minified version used to work around issues in the browser.
 */
import BigNumber from 'bignumber.js';
import _ from 'lodash';
import { combineReducers, createStore } from 'redux';
import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import Web3Subprovider from 'web3-provider-engine/subproviders/web3';
import identity from '../src';
import { waitForReceipt } from '../src/lib/transactions';
import Promise from 'bluebird';
global.Promise = Promise;  // Use bluebird for better error logging during development.


// Using a hardcoded password is equivalent to storing keys unencrypted.
const passwordProvider = (callback) => callback(null, 'identity-provider');
const httpProvider = new Web3.providers.HttpProvider('http://localhost:8545');

async function initializeStore() {
  let store; // Declare the eventual store so it can be closed over by getState.
  const keystoreSubprovider = new identity.keystore.KeystoreSubprovider({
    getState: () => store.getState().keystore,
  });
  const signingProvider = new ProviderEngine();
  signingProvider.addProvider(keystoreSubprovider);
  signingProvider.addProvider(new Web3Subprovider(httpProvider));
  signingProvider.start();

  const identitySubprovider = new identity.IdentitySubprovider({ getState: () => store.getState().identity });
  const identityProvider = new ProviderEngine();
  identityProvider.addProvider(identitySubprovider);
  identityProvider.addProvider(new Web3Subprovider(httpProvider));
  identityProvider.start();

  const initialIdentityState = {
    identities: [],
    signingProvider,
  };
  const identityReducer = identity.state.reducers.create(initialIdentityState);
  const keystoreState = await identity.keystore.dispatchers.initialize(passwordProvider);
  const keystoreReducer = identity.keystore.reducers.create(keystoreState);

  store = createStore(
    combineReducers({
      identity: identityReducer,
      keystore: keystoreReducer,
      providers: () => ({ identity: identityProvider, signing: signingProvider }),
    })
  );

  return store;
}

(async function () {
  const store = await initializeStore();
  const storeKey = await identity.keystore.utils.deriveStoreKey(passwordProvider);
  const keystore = identity.keystore.utils.deserialize(store.getState().keystore.keystore);
  console.log('SEED:', keystore.getSeed(storeKey));

  const state = store.getState();
  const signingProvider = state.providers.signing;
  const identityProvider = state.providers.identity;
  const keyring = identity.keystore.utils.bestKeyring(
    state.keystore.keystore, state.keystore.defaultHdPath);
  const transactionKey = keyring.addresses[0];

  // Fund the new transaction key.
  await identity.transactions.fundAddressFromNode(transactionKey, new BigNumber('1e18'), httpProvider)
    .then((txhash) => waitForReceipt(txhash, httpProvider));

  // Create a contract identity and add it to the state.
  const contractIdentity = await identity.transactions.createContractIdentity(transactionKey)
    .transact(signingProvider, { gas: 3000000 });
  store.dispatch(identity.state.actions.ADD_IDENTITY.create({ identity: contractIdentity }));

  // Send funds to the new contract identity.
  const web3 = new Web3(signingProvider);
  const sendTransaction = Promise.promisify(web3.eth.sendTransaction);
  await sendTransaction({
    from: transactionKey,
    to: contractIdentity.address,
    value: new BigNumber('5e17'),
  }).then((txhash) => waitForReceipt(txhash, signingProvider));

  // Send funds back from the contract to the key.
  const web3ForIdentity = new Web3(identityProvider);
  const sendTransactionForIdentity = Promise.promisify(web3ForIdentity.eth.sendTransaction);
  await sendTransactionForIdentity({
    from: contractIdentity.address,
    to: transactionKey,
    value: new BigNumber('4e17'),
  }).then((txhash) => waitForReceipt(txhash, identityProvider));

  // Check the balances for sanity.
  const getBalance = Promise.promisify(web3.eth.getBalance);
  await getBalance(transactionKey)
    .then((balance) => {
      const meetsExpectations = balance.gt(new BigNumber('8e17'));
      const summary = meetsExpectations ? 'PASS' : 'FAIL';
      console.log(`${summary}: key balance > 8e17, actual ${balance}`);
    });
  await getBalance(contractIdentity.address)
    .then((balance) => {
      const meetsExpectations = balance.eq(new BigNumber('1e17'));
      const summary = meetsExpectations ? 'PASS' : 'FAIL';
      console.log(`${summary}: contract balance == 1e17, actual ${balance}`);
    });

  _.forEach(state.providers, (engine) => engine.stop());
})();
