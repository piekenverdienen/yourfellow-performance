'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, ArrowRight, Sparkles, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()
      
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}`,
        },
      })
      
      if (authError) {
        throw authError
      }
      
      setIsSent(true)
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err?.message || 'Er is iets misgegaan. Probeer het opnieuw.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-brand relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <Logo variant="white" size="lg" />
          
          <div className="max-w-lg">
            <h1 className="text-5xl font-bold text-black leading-tight">
              AI-powered marketing voor het hele team
            </h1>
            <p className="mt-6 text-lg text-black/80">
              Genereer advertentieteksten, optimaliseer feeds, creëer content en analyseer landingspagina's met de kracht van AI.
            </p>
            
            <div className="mt-10 space-y-4">
              {[
                'Google Ads teksten & feed optimalisatie',
                'Social media content generator',
                'SEO content & meta tags',
                'CRO analyse met Cialdini principes',
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-black" />
                  </div>
                  <span className="text-black/90">{feature}</span>
                </div>
              ))}
            </div>
          </div>
          
          <p className="text-sm text-black/60">
            © {new Date().getFullYear()} YourFellow. Your partner in online marketing.
          </p>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-32 -bottom-32 w-96 h-96 bg-black/10 rounded-full blur-3xl" />
        <div className="absolute -left-16 top-1/4 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo size="lg" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">
              Welkom terug
            </h2>
            <p className="mt-2 text-surface-400">
              Log in met je e-mailadres om verder te gaan.
            </p>
          </div>

          {isSent ? (
            <Card className="bg-surface-900 border-surface-800">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white">Check je inbox</h3>
                <p className="mt-2 text-surface-400">
                  We hebben een magic link gestuurd naar{' '}
                  <span className="text-white font-medium">{email}</span>
                </p>
                <p className="mt-4 text-sm text-surface-500">
                  Klik op de link in de e-mail om in te loggen.
                </p>
                <Button 
                  variant="ghost" 
                  className="mt-6 text-surface-400"
                  onClick={() => setIsSent(false)}
                >
                  Andere e-mail gebruiken
                </Button>
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-surface-300 mb-2">
                  E-mailadres
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="naam@yourfellow.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  leftIcon={<Mail className="h-4 w-4" />}
                  className="bg-surface-900 border-surface-700 text-white placeholder:text-surface-500"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                isLoading={isLoading}
                rightIcon={!isLoading && <ArrowRight className="h-4 w-4" />}
              >
                {isLoading ? 'Even geduld...' : 'Verstuur magic link'}
              </Button>

              <p className="text-center text-sm text-surface-500">
                Door in te loggen ga je akkoord met onze{' '}
                <Link href="/terms" className="text-primary hover:underline">
                  gebruiksvoorwaarden
                </Link>{' '}
                en{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  privacybeleid
                </Link>
                .
              </p>
            </form>
          )}

          <div className="mt-8 pt-8 border-t border-surface-800">
            <p className="text-center text-sm text-surface-500">
              Nog geen toegang?{' '}
              <Link href="mailto:diederik@yourfellow.nl" className="text-primary hover:underline">
                Vraag een account aan
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="animate-pulse text-white">Laden...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}