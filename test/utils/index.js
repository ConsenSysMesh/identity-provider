import TestRPC from 'ethereumjs-testrpc';
import parseArgs from 'minimist';
import { combineReducers, createStore } from 'redux';
import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import Web3Subprovider from 'web3-provider-engine/subproviders/web3';
import identity from '../../src';

// Using a hardcoded password is equivalent to storing keys unencrypted.
const passwordProvider = (callback) => callback(null, 'identity-provider');

/**
 * Get a Web3 Provider for an Ethereum daemon. Returns TestRPC's provider by
 * default, but any HTTP URL can be provided to the test suite with --live-daemon.
 */
export function getDaemonProvider() {
  const argv = parseArgs(process.argv.slice(2));
  if (argv['live-daemon']) {
    return new Web3.providers.HttpProvider(argv['live-daemon']);
  }
  return TestRPC.provider();
}

/**
 * Creates a redux store with an identity provider and a keystore signing provider.
 *
 * The store's providers are ProviderEngines that have been started. They should
 * be stopped when they're no longer needed.
 *
 * @return {Store}
 */
export async function setupStore() {
  const initialIdentityState = { identities: [] };
  const identityReducer = identity.state.reducers.create(initialIdentityState);
  const keystoreState = await identity.keystore.state.dispatchers.initialize(passwordProvider);
  const keystoreReducer = identity.keystore.state.reducers.create(keystoreState);

  return createStore(
    combineReducers({
      identity: identityReducer,
      lightwallet: keystoreReducer,
    })
  );
}

export function getProviders(store) {
  const daemonProvider = getDaemonProvider();

  const keystoreSubprovider = new identity.keystore.KeystoreSubprovider({
    getState: () => store.getState().lightwallet,
  });
  const signingProvider = new ProviderEngine();
  signingProvider.addProvider(keystoreSubprovider);
  signingProvider.addProvider(new Web3Subprovider(daemonProvider));
  signingProvider.start();

  const identitySubprovider = new identity.IdentitySubprovider({
    getEnvironment: () => ({
      state: store.getState().identity,
      dependencies: { signingProvider },
    }),
  });
  const identityProvider = new ProviderEngine();
  identityProvider.addProvider(identitySubprovider);
  identityProvider.addProvider(new Web3Subprovider(daemonProvider));
  identityProvider.start();

  return {
    identity: identityProvider,
    signing: signingProvider,
    daemon: daemonProvider,
  };
}
