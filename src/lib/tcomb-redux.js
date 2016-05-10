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
