/** Mixdeck list `payload.actions` is a string array of ActionType aliases (e.g. "create", "delete"). */
export function parseActions(source: any): string[] {
  const actions = source?.payload?.actions ?? source?.actions ?? []
  return Array.isArray(actions) ? actions : []
}

export function hasAction(actions: string[] | undefined | null, action: string): boolean {
  return Array.isArray(actions) && actions.includes(action)
}
