import isNil from 'lodash/isNil';
import merge from 'lodash/merge';
import omitBy from 'lodash/omitBy';
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
    return State(merge({}, stateDefaults, omitBy(this, isNil)));
  },
});
