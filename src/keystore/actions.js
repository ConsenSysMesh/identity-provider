import t from 'tcomb';
import { ActionStruct } from '../lib/redux-tcomb-extras';


export const UPDATE_KEYSTORE = ActionStruct({
  keystore: t.Object,
}, 'UPDATE_KEYSTORE');

UPDATE_KEYSTORE.prototype.patch = function (state) {
  return t.update(state, { keystore: { $set: this.keystore }});
};
