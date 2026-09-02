export interface ValidationError {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  errors: Record<string, string[]>
}

export class ApiNotEnoughSongsError extends Error {
  constructor(
    public readonly current: number,
    public readonly required: number
  ) {
    super('not_enough_songs')
    this.name = 'ApiNotEnoughSongsError'
  }
}

export class ApiPaymentActionRequiredError extends Error {
  constructor(public readonly clientSecret: string) {
    super('payment_action_required')
    this.name = 'ApiPaymentActionRequiredError'
  }
}

const ENTITLEMENT_LIMIT_CODES = ['STATION_LIMIT_REACHED', 'SONG_LIMIT_REACHED'] as const

export class ApiEntitlementLimitError extends Error {
  constructor(
    public readonly title: string,
    public readonly detail: string,
    public readonly upgradeHint?: string,
    public readonly upgradeTo?: string,
    public readonly code?: string,
  ) {
    super(detail || title)
    this.name = 'ApiEntitlementLimitError'
  }
}

export function isEntitlementLimitError(error: any): error is ApiEntitlementLimitError {
  return error instanceof ApiEntitlementLimitError
}

export function isEntitlementLimitCode(code: unknown): boolean {
  return typeof code === 'string' && (ENTITLEMENT_LIMIT_CODES as readonly string[]).includes(code)
}

export class ApiValidationError extends Error {
  constructor(
    public readonly validationError: ValidationError,
    public readonly status: number
  ) {
    super(validationError.detail || validationError.title)
    this.name = 'ApiValidationError'
  }
}

export function isValidationError(error: any): error is ApiValidationError {
  return error instanceof ApiValidationError
}

export function formatValidationErrors(errors: Record<string, string[]>): string {
  const messages: string[] = []
  for (const [field, fieldErrors] of Object.entries(errors)) {
    const formattedField = field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
    fieldErrors.forEach(err => {
      messages.push(`${formattedField}: ${err}`)
    })
  }
  return messages.join('\n')
}

export function getErrorMessage(error: any): string {
  if (isValidationError(error)) {
    return formatValidationErrors(error.validationError.errors)
  }
  return error?.message || 'An unexpected error occurred'
}
