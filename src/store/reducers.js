import {createReducer} from 'redux-tcomb';
import Action from './action-type';
import {State} from './state';


export function create(initialState) {
  return createReducer(initialState, Action, State);
}
