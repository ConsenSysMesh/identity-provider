import { createUnion } from 'redux-tcomb';
import t from 'tcomb';

/**
 * Add a create() method to a Struct that prepares a raw object for dispatching.
 *
 * Type check the action, then add the type of the action for the dispatcher to
 * find so clients don't have to repeat themselves in the object itself.
 */
function addActionCreator(Struct) {
  Struct.create = function create(obj) {
    Struct(obj); // Throw if type-checking fails during development.
    return Object.assign({}, obj, { type: Struct.meta.name });
  };
}

export function ActionStruct(props, name) {
  const Struct = t.struct(props, name);
  addActionCreator(Struct);
  return Struct;
}

/**
 * The NoOp action allows the reducer to ignore actions intended for a
 * different portion of the state.
 *
 * https://github.com/gcanti/redux-tcomb/issues/7
 */
const NoOp = t.struct({});
Object.assign(NoOp.prototype, {
  patch(state) {
    return state;
  },
});

/**
 * Create an Action union intended for use as a reducer for a portion of an
 * application's state, not the whole thing.
 */
export function createLooseUnion(actions) {
  const actionNames = Object.keys(actions);
  if (actionNames.length === 1) {
    // Unions can't be created with a single type.
    return actions[actionNames[0]];
  }
  
  const Action = createUnion(actions);
  const strictDispatch = Action.dispatch;

  Action.dispatch = function (action) {
    const isIdentityAction = actions.hasOwnProperty(action.type);
    return isIdentityAction ? strictDispatch(action) : NoOp;
  };

  return Action;
}
