import _ from 'lodash';
import t from 'tcomb';
import * as keystoreLib from '../keystore';
import {KeystoreIdentity} from '../types/identity';


export const State = t.struct({
  web3Provider: t.Any,
  passwordProvider: t.Function,
  identities: t.list(t.Object),
  keystore: t.maybe(t.Object),
  defaultHdPath: t.String,
  transactionDefaults: t.struct({
    gas: t.Any,
    gasPrice: t.maybe(t.Any),
  }),
}, 'State');

Object.assign(State.prototype, {
  identityForAddress(address) {
    const identity = _.find(this.identities, (id) => id.address === address);
    if (identity == null) {
      // Assume the address is for an identity in the keystore.
      return KeystoreIdentity({address});
    }
    return identity;
  },

  getKeyIdentity() {
    const keyring = keystoreLib.bestKeyring(this.keystore, this.defaultHdPath);
    const address = keyring.addresses[0];
    return KeystoreIdentity({address});
  },
});

export const stateDefaults = {
  defaultHdPath: "m/0'/0'/0'",
  transactionDefaults: {
    gas: 3000000,
  },
};

export const PartialState = t.struct({
  web3Provider: t.Any,
  passwordProvider: t.Function,
  identities: t.list(t.Object),
  keystore: t.maybe(t.Object),
  defaultHdPath: t.maybe(t.String),
  defaults: t.maybe(t.Any),
}, 'PartialState');

Object.assign(PartialState.prototype, {
  toState() {
    return State(_.merge({}, stateDefaults, _.omitBy(this, _.isNil)));
  },
});
