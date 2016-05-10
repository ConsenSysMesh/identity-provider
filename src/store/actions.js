import t from 'tcomb';
import { ActionStruct } from '../lib/tcomb-redux';

// NOTE: Since the Identity type has subclasses with more data, we can't
// type-check the actions as Identities without discarding that data.


export const UPDATE_IDENTITIES = ActionStruct({
  identities: t.list(t.Any),
}, 'UPDATE_IDENTITIES');

UPDATE_IDENTITIES.prototype.patch = function (state) {
  return t.update(state, {identities: {$set: this.identities}});
};

export const ADD_IDENTITY = ActionStruct({
  identity: t.Any,
}, 'ADD_IDENTITY');

ADD_IDENTITY.prototype.patch = function (state) {
  return t.update(state, {identities: {$unshift: [this.identity]}});
};

export const UPDATE_KEYSTORE = ActionStruct({
  keystore: t.Any,
}, 'UPDATE_KEYSTORE');

UPDATE_KEYSTORE.prototype.patch = function (state) {
  return t.update(state, {keystore: {$set: this.keystore}});
};
