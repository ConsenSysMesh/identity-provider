import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import identity from '../src';
import {waitForReceipt} from '../src/lib/transactions';
import Promise from 'bluebird';
global.Promise = Promise;  // Use bluebird for better error logging during development.


// Using a hardcoded password is equivalent to storing keys unencrypted.
const passwordProvider = (callback) => callback(null, 'identity-provider');
const seed = 'embark can decline fence confirm salute fence weird joy camp brown embrace';
const httpProvider = new Web3.providers.HttpProvider('http://localhost:8545');
const providerPromise = identity.keystore.restoreFromSeed(seed, passwordProvider)
  .then((keystore) => {
    return identity.provider.IdentityProvider.initialize({
      state: {
        keystore,
        passwordProvider,
        identities: [],
        web3Provider: httpProvider,
      },
    });
  });

providerPromise.then((provider) => {
  const state = provider.substore.getState();
  const keyIdentity = state.getKeyIdentity();
  identity.actions.fundAddressFromNode(keyIdentity.address, new BigNumber('1e18'), httpProvider)
    .then((txhash) => waitForReceipt(txhash, httpProvider))
    .then(() => {
      provider.start();
      identity.actions.addNewContractIdentity(provider.substore).transact(provider)
        .then((contractIdentity) => {
          console.log(provider.substore.getState().identities);
          // Send funds to the new identity.
          const web3 = new Web3(provider);
          const sendTransaction = Promise.promisify(web3.eth.sendTransaction);
          sendTransaction({
            from: keyIdentity.address,
            to: contractIdentity.address,
            value: new BigNumber('5e17'),
          })
            .then((txhash) => waitForReceipt(txhash, httpProvider))
            .then(() => {
              // Send funds back from the contract to the key.
              return sendTransaction({
                from: contractIdentity.address,
                to: keyIdentity.address,
                value: new BigNumber('4e17'),
              });
            })
            .then((txhash) => waitForReceipt(txhash, httpProvider))
            .then(() => {
              const getBalance = Promise.promisify(web3.eth.getBalance);
              return getBalance(keyIdentity.address)
                .then((balance) => {
                  const meetsExpectations = balance.gt(new BigNumber('8e17'));
                  const summary = meetsExpectations ? 'PASS' : 'FAIL';
                  console.log(`${summary}: key balance > 8e17, actual ${balance}`);
                })
                .then(() => getBalance(contractIdentity.address))
                .then((balance) => {
                  const meetsExpectations = balance.eq(new BigNumber('1e17'));
                  const summary = meetsExpectations ? 'PASS' : 'FAIL';
                  console.log(`${summary}: contract balance == 1e17, actual ${balance}`);
                });
            });
        });
      provider.stop();
    });
});
