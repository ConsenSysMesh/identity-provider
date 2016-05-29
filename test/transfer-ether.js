import BigNumber from 'bignumber.js';
import Promise from 'bluebird';
import { expect } from 'chai';
import { utils } from 'transaction-monad';
import Web3 from 'web3';
import identity from '../src';
import { setupStoreWithKeystore } from './utils';

global.Promise = Promise;  // Use bluebird for better error logging during development.


// Using a hardcoded password is equivalent to storing keys unencrypted.
const passwordProvider = (callback) => callback(null, 'identity-provider');

describe('Sending ether to and from a new identity', () => {
  let store;
  let transactionKey;
  let contractIdentity;

  before(async function (done) {
    store = await setupStoreWithKeystore(passwordProvider);
    const storeKey = await identity.keystore.utils.deriveStoreKey(passwordProvider);
    const keystore = identity.keystore.utils.deserialize(store.getState().signing.keystore);

    const state = store.getState();
    const signingProvider = state.providers.signing;
    const keyring = identity.keystore.utils.bestKeyring(
      state.signing.keystore, state.signing.defaultHdPath);
    transactionKey = keyring.addresses[0];

    // Fund the new transaction key.
    await identity.transactions.fundAddressFromNode(transactionKey, new BigNumber('1e18'), state.providers.http)
      .then((txhash) => utils.waitForReceipt(txhash, state.providers.http));

    // Create a contract identity and add it to the state.
    contractIdentity = await identity.transactions.createContractIdentity(transactionKey)
      .transact(signingProvider, { gas: 3000000 });
    store.dispatch(identity.state.actions.ADD_IDENTITY.create({ identity: contractIdentity }));
    done();
  });

  it('sends ether to the new identity', async function (done) {
    const signingProvider = store.getState().providers.signing;
    const web3 = new Web3(signingProvider);
    const sendTransaction = Promise.promisify(web3.eth.sendTransaction);
    await sendTransaction({
      from: transactionKey,
      to: contractIdentity.address,
      value: new BigNumber('5e17'),
    }).then((txhash) => utils.waitForReceipt(txhash, signingProvider));

    const getBalance = Promise.promisify(web3.eth.getBalance);
    const balance = await getBalance(contractIdentity.address);
    expect(balance.eq('5e17')).to.be.true;
    done();
  });
});
