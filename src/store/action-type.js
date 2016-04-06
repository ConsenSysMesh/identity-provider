import {createUnion} from 'redux-tcomb';
import * as actions from './actions';


// Create a union of action types if there are more than one.
const actionNames = Object.keys(actions);
let Action;
if (actionNames.length === 1) {
  Action = actions[actionNames[0]];
} else {
  Action = createUnion(actions);
}

export default Action;
