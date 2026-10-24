/** Deterministic presentation seed from node id (not engineering data). */
export function nodePresentationSeed(nodeId: string) {
  return [...nodeId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}
