import type { MessageApi } from 'naive-ui'
import { isValidationError } from './errorHandler'

export function handleApiError(error: any, message: MessageApi) {
  if (isValidationError(error)) {
    for (const [field, fieldErrors] of Object.entries(error.validationError.errors)) {
      const formattedField = field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
      fieldErrors.forEach((err: string) => {
        message.error(`${formattedField}: ${err}`, {
          duration: 5000,
          closable: true,
        })
      })
    }
  } else {
    message.error(error?.message || 'An unexpected error occurred', {
      duration: 3000,
      closable: true,
    })
  }
}
