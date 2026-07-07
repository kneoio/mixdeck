import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { appConfig } from '@/config/appConfig'

let stripePromise: Promise<Stripe | null> | null = null

function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(appConfig.stripePublishableKey)
  }
  return stripePromise
}

// Confirms a subscription payment that Stripe flagged as requiring 3-D Secure re-authentication.
export async function confirmSubscriptionPayment(clientSecret: string): Promise<void> {
  const stripe = await getStripe()
  if (!stripe) throw new Error('Stripe.js failed to load')

  const { error } = await stripe.confirmCardPayment(clientSecret)
  if (error) throw new Error(error.message || 'Payment authentication failed')
}
