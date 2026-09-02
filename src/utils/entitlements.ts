export interface EntitlementAction {
  id: string
  enabled: boolean
  code?: string
  reason?: string
  upgradeTo?: string
  upgradeHint?: string
}

export function parseActions(source: any): EntitlementAction[] {
  const raw = source?.payload?.actions ?? source?.actions ?? []
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a: any) => a && typeof a === 'object' && typeof a.id === 'string')
    .map((a: any) => ({
      id: a.id,
      enabled: a.enabled === true,
      code: typeof a.code === 'string' ? a.code : undefined,
      reason: typeof a.reason === 'string' ? a.reason : undefined,
      upgradeTo: typeof a.upgradeTo === 'string' ? a.upgradeTo : undefined,
      upgradeHint: typeof a.upgradeHint === 'string' ? a.upgradeHint : undefined,
    }))
}

export function getAction(actions: EntitlementAction[] | undefined | null, id: string): EntitlementAction | undefined {
  return actions?.find(a => a.id === id)
}

export function isActionEnabled(actions: EntitlementAction[] | undefined | null, id: string): boolean {
  return getAction(actions, id)?.enabled === true
}

export function entitlementNotice(actions: EntitlementAction[] | undefined | null, id = 'create'): string {
  const action = getAction(actions, id)
  if (!action || action.enabled) return ''
  return action.reason || ''
}
