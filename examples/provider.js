import BigNumber from 'bignumber.js';
import lightwallet from 'eth-lightwallet';
import _ from 'lodash';
import Web3 from 'web3';
import identity from '../src';
import {waitForReceipt} from '../src/lib/transactions';
import Promise from 'bluebird';
global.Promise = Promise;  // Use bluebird for better error logging during development.

/**
 * 1. Create or load a keystore and identity definitions.
 * 2. Create a provider from a keystore, identity definitions, and an RPC URL.
 * 3. Find the first contract identity. Create one if none exist.
 * 4. Set that identity as active in the provider.
 */


const deriveStoreKey = Promise.promisify(lightwallet.keystore.deriveKeyFromPassword);

function deriveInsecureStoreKey() {
  // Using a hardcoded password is equivalent to storing keys unencrypted.
  const insecurePassword = 'identity-provider';
  return deriveStoreKey(insecurePassword);
}

const seed = 'embark can decline fence confirm salute fence weird joy camp brown embrace';
const providerPromise = deriveInsecureStoreKey()
  .then((storeKey) => {
    const keystore = new lightwallet.keystore(seed, storeKey);
    return identity.provider.IdentityProvider.initialize({
      keystore,
      identities: [],
      passwordProvider: (callback) => callback(null, 'identity-provider'),
    });
  });

providerPromise.then((provider) => {
  const keyIdentity = _.find(provider.config.identities,
    (id) => !identity.types.ContractIdentity.is(id));
  identity.actions.fundAddressFromNode(keyIdentity.address, new BigNumber('1e18'))
    .then((txhash) => {
      // Using an IdentityProvider for this web3 object fails, probably because
      // provider-engine does something different with the filters used in
      // waitForReceipt.
      const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
      return waitForReceipt(txhash, {
        web3: web3,
        receiptPromises: {},
        batcher: {
          add(request) {
            const batch = web3.createBatch();
            batch.add(request);
            batch.execute();
          },
        },
      });
    })
    .then(() => {
      provider.start();
      provider.createContractIdentity()
        .then(() => {
          console.log(provider.config.identities);
        });
      provider.stop();
    });
});
