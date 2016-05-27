import { createStore } from 'redux';
import * as reducers from './reducers';
import { PartialState } from './state';
import * as utils from './utils';


export function ensureExists(state, { dispatch }) {
  if (state.keystore !== null) {
    return Promise.resolve();
  }

  return utils.create(state.passwordProvider)
    .then((keystore) => {
      dispatch({
        type: 'UPDATE_KEYSTORE',
        keystore: keystore,
      });
    });
}

export function ensureHasAddress(state, { dispatch }) {
  return utils.deriveStoreKey(state.passwordProvider)
    .then((storeKey) => {
      dispatch({
        type: 'UPDATE_KEYSTORE',
        keystore: utils.ensureHasAddress(state, storeKey),
      });
    });
}

export function initialize(passwordProvider) {
  const initialKeystoreState = PartialState({
    passwordProvider,
  }).toState();
  const initReducer = reducers.create(initialKeystoreState);
  const store = createStore(initReducer);

  return ensureExists(store.getState(), store)
    .then(() => ensureHasAddress(store.getState(), store))
    .then(() => store.getState());
}
