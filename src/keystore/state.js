import _ from 'lodash';
import t from 'tcomb';


export const State = t.struct({
  passwordProvider: t.Function,
  keystore: t.maybe(t.Object),
  defaultHdPath: t.String,
}, 'State');


export const stateDefaults = {
  defaultHdPath: "m/0'/0'/0'",
};

export const PartialState = t.struct({
  passwordProvider: t.Function,
  keystore: t.maybe(t.Object),
  defaultHdPath: t.maybe(t.String),
}, 'PartialState');

Object.assign(PartialState.prototype, {
  toState() {
    return State(_.merge({}, stateDefaults, _.omitBy(this, _.isNil)));
  },
});
