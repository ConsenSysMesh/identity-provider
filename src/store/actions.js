import t from 'tcomb';


export const UPDATE_IDENTITIES = t.struct({
  identities: t.list(t.Any),
}, 'UPDATE_IDENTITIES');

UPDATE_IDENTITIES.prototype.patch = function (state) {
  return t.update(state, {identities: {$set: this.identities}});
};

export const UPDATE_KEYSTORE = t.struct({
  keystore: t.Any,
}, 'UPDATE_KEYSTORE');

UPDATE_KEYSTORE.prototype.patch = function (state) {
  return t.update(state, {keystore: {$set: this.keystore}});
};
