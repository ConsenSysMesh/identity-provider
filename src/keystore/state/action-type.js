import { createLooseUnion } from '../../lib/redux-tcomb-extras';
import * as actions from './actions';


export default createLooseUnion(actions);
