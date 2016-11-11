import t from 'tcomb';
import { State } from './state';


export const Dependencies = t.struct({
  signingProvider: t.Any, // Web3 Provider
}, 'Dependencies');

export const Environment = t.struct({
  state: State,
  dependencies: Dependencies,
});
