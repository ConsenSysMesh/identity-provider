import { createUnion } from 'redux-tcomb';
import t from 'tcomb';
import * as actions from './actions';


// Create a union of action types if there are more than one.
const actionNames = Object.keys(actions);
let Action;
if (actionNames.length === 1) {
  Action = actions[actionNames[0]];
} else {
  Action = createUnion(actions);
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

const strictDispatch = Action.dispatch;
Action.dispatch = function (action) {
  const isIdentityAction = actions.hasOwnProperty(action.type);
  return isIdentityAction ? strictDispatch(action) : NoOp;
};

export default Action;
