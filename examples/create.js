import identity from '../src';
import Promise from 'bluebird';
global.Promise = Promise;  // Use bluebird for better error logging during development.


identity.config.initialize().then((config) => {
  return identity.actions.createSenderIdentity(config)
    .then((id) => {
      console.log(id);
    });
});
