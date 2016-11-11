import BigNumber from 'bignumber.js';
import Promise from 'bluebird';
import { expect } from 'chai';
import * as utils from 'transaction-monad/lib/utils';
import Web3 from 'web3';
import identity from '../src';
import { setupStore, getProviders } from './utils';

global.Promise = Promise;  // Use bluebird for better error logging during development.


describe('Sending ether to and from a new identity', () => {
  let store;
  let providers;
  let transactionKey;
  let contractIdentity;

  before(async function () {
    store = await setupStore();
    providers = getProviders(store);
    const state = store.getState();
    const keyring = identity.keystore.utils.bestKeyring(
      state.lightwallet.keystore, state.lightwallet.defaultHdPath);
    transactionKey = keyring.addresses[0];

    // Fund the new transaction key.
    await identity.transactions.fundAddressFromNode(transactionKey, new BigNumber('1e18'), providers.daemon)
      .then((txhash) => utils.waitForReceipt(txhash, providers.daemon));

    // Create a contract identity and add it to the state.
    contractIdentity = await identity.transactions.createContractIdentity(transactionKey)
      .transact(providers.signing, { gas: 3000000 });
    store.dispatch(identity.state.actions.ADD_IDENTITY.create({ identity: contractIdentity }));
  });

  after(() => {
    providers.signing.stop();
    providers.identity.stop();
  });

  it('sends ether to the new identity', async function () {
    const web3 = new Web3(providers.signing);
    const sendTransaction = Promise.promisify(web3.eth.sendTransaction);
    await sendTransaction({
      from: transactionKey,
      to: contractIdentity.address,
      value: new BigNumber('5e17'),
    }).then((txhash) => utils.waitForReceipt(txhash, providers.signing));

    const getBalance = Promise.promisify(web3.eth.getBalance);
    const balance = await getBalance(contractIdentity.address);
    expect(balance.eq('5e17')).to.be.true;
  });

  it('returns some ether from the new identity', async function () {
    const web3 = new Web3(providers.identity);
    const sendTransaction = Promise.promisify(web3.eth.sendTransaction);
    await sendTransaction({
      from: contractIdentity.address,
      to: transactionKey,
      value: new BigNumber('4e17'),
    }).then((txhash) => utils.waitForReceipt(txhash, providers.identity));

    const getBalance = Promise.promisify(web3.eth.getBalance);
    const contractBalance = await getBalance(contractIdentity.address);
    expect(contractBalance.eq('1e17')).to.be.true;
    const transactionKeyBalance = await getBalance(transactionKey);
    // The transaction key balance should be 9e17 minus gas costs.
    expect(transactionKeyBalance.gt('8.9e17')).to.be.true;
  });
});
