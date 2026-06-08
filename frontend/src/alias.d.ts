// Path alias declarations for TypeScript
declare module '@/core/*' {
  import * as module from '../../src/core/*';
  export = module;
}

declare module '@/modules/*' {
  import * as module from '../../src/modules/*';
  export = module;
}

declare module '@/pages/*' {
  import * as module from '../../src/pages/*';
  export = module;
}

declare module '@/styles/*' {
  import * as module from '../../src/styles/*';
  export = module;
}
