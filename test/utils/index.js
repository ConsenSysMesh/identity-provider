import { combineReducers, createStore } from 'redux';
import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import Web3Subprovider from 'web3-provider-engine/subproviders/web3';
import identity from '../../src';


/**
 * Creates a redux store with an identity provider and a keystore signing provider.
 *
 * The store's providers are ProviderEngines that have been started. They should
 * be stopped when they're no longer needed.
 *
 * @return {Store}
 */
export async function setupStoreWithKeystore(passwordProvider) {
  const httpProvider = new Web3.providers.HttpProvider('http://localhost:8545');

  let store; // Declare the eventual store so it can be closed over by getState.
  const keystoreSubprovider = new identity.keystore.KeystoreSubprovider({
    getState: () => store.getState().signing,
  });
  const signingProvider = new ProviderEngine();
  signingProvider.addProvider(keystoreSubprovider);
  signingProvider.addProvider(new Web3Subprovider(httpProvider));
  signingProvider.start();

  const identitySubprovider = new identity.IdentitySubprovider({
    getState: () => store.getState().identity,
  });
  const identityProvider = new ProviderEngine();
  identityProvider.addProvider(identitySubprovider);
  identityProvider.addProvider(new Web3Subprovider(httpProvider));
  identityProvider.start();

  const initialIdentityState = {
    identities: [],
    signingProvider,
  };
  const identityReducer = identity.state.reducers.create(initialIdentityState);
  const keystoreState = await identity.keystore.state.dispatchers.initialize(passwordProvider);
  const keystoreReducer = identity.keystore.state.reducers.create(keystoreState);

  store = createStore(
    combineReducers({
      identity: identityReducer,
      signing: keystoreReducer,
      providers: () => ({
        identity: identityProvider,
        signing: signingProvider,
        http: httpProvider,
      }),
    })
  );

  return store;
}
