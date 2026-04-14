// ambient declaration for uuid library when no typings are installed
// this ensures TypeScript knows the module exists and provides the v4 function

declare module 'uuid' {
  /**
   * Generate a random UUID (version 4).
   */
  export function v4(): string;
}
