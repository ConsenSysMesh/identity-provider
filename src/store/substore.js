import _ from 'lodash';
import {createStore} from 'redux';
import t from 'tcomb';
import * as reducers from './reducers';
import {PartialState, State} from './state';

/**
 * An application store from which the library state can be derived using
 * the provided selector.
 */
export const Substore = t.struct({
  store: t.Any,
  selector: t.Func,
}, 'Substore');

Substore.prototype.getSubstore = function () {
  return this;
};

Substore.prototype.getState = function () {
  return State(this.selector(this.store.getState()));
};

/**
 * An application state from which the library state can be derived using
 * the provided selector. The state is intended to be used to initialize
 * a store for use within the library for applications that don't use Redux.
 */
export const Substate = t.struct({
  state: PartialState,
}, 'Substate');

Substate.prototype.getSubstore = function () {
  const initialState = PartialState(this.state).toState();
  const reducer = reducers.create(initialState);
  const store = createStore(reducer, initialState);
  return Substore({store, selector: _.identity});
};

/**
 * Types that can create a substore. A library can call getSubstore without
 * caring whether an initial state or a full fledged store and selector
 * were provided.
 */
export const SubstoreCreator = t.union([Substore, Substate], 'SubstoreCreator');

SubstoreCreator.dispatch = (data) => {
  if (data.store == null) {
    return Substate;
  }

  return Substore;
};
