'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { AvatarUpload } from '@/components/avatar-upload'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useUser } from '@/hooks/use-user'
import { calculateLevel, industryOptions, toneOptions, getLevelRange } from '@/lib/utils'
import {
  User,
  Building2,
  Briefcase,
  MessageSquare,
  Target,
  Star,
  Zap,
  Trophy,
  Loader2,
  Check,
  ArrowRight,
} from 'lucide-react'

export default function ProfilePage() {
  const { user, stats, loading, updateProfile } = useUser()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formData, setFormData] = useState<{
    full_name: string
    company_name: string
    industry: string
    preferred_tone: 'professional' | 'casual' | 'friendly' | 'formal' | 'creative'
    target_audience: string
    brand_voice: string
  }>({
    full_name: '',
    company_name: '',
    industry: '',
    preferred_tone: 'professional',
    target_audience: '',
    brand_voice: '',
  })
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load user data into form when available
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        company_name: user.company_name || '',
        industry: user.industry || '',
        preferred_tone: user.preferred_tone || 'professional',
        target_audience: user.target_audience || '',
        brand_voice: user.brand_voice || '',
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setSaveError(null)

    console.log('Saving profile:', formData)
    const { error } = await updateProfile(formData)
    console.log('Save result:', error)

    setSaving(false)
    if (error) {
      setSaveError(error.message)
      console.error('Profile save error:', error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAvatarChange = async (url: string | null) => {
    const { error } = await updateProfile({ avatar_url: url })
    if (error) {
      console.error('Failed to update avatar:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const levelInfo = calculateLevel(user?.xp || 0)
  const levelRange = getLevelRange(levelInfo.level)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Mijn Profiel</h1>
        <p className="text-surface-600 mt-1">Beheer je accountgegevens en voorkeuren</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Level & Stats */}
        <div className="space-y-6">
          {/* Level Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <AvatarUpload
                    userId={user?.id || ''}
                    userName={user?.full_name || 'User'}
                    currentAvatarUrl={user?.avatar_url}
                    onAvatarChange={handleAvatarChange}
                    size="xl"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-primary text-black text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center">
                    {levelInfo.level}
                  </div>
                </div>

                <h2 className="mt-4 text-xl font-bold text-surface-900">
                  {user?.full_name || 'Gebruiker'}
                </h2>
                <p className="text-surface-500 text-sm">{user?.email}</p>

                <div className="mt-4 w-full">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      {levelInfo.title}
                    </Badge>
                    <span className="text-xs text-surface-500">
                      Level {levelInfo.level}
                    </span>
                  </div>
                  <Progress value={levelInfo.progress} className="h-2" />
                  <div className="flex justify-between mt-1 text-xs text-surface-500">
                    <span>{user?.xp || 0} XP</span>
                    <span>{levelRange.max} XP</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statistieken</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-surface-600">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm">Totaal XP</span>
                </div>
                <span className="font-semibold text-surface-900">{user?.xp || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-surface-600">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Level</span>
                </div>
                <span className="font-semibold text-surface-900">{levelInfo.level}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-surface-600">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Generaties totaal</span>
                </div>
                <span className="font-semibold text-surface-900">{stats?.total_generations || user?.total_generations || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-surface-600">
                  <Star className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Vandaag</span>
                </div>
                <span className="font-semibold text-surface-900">{stats?.generations_today || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Next Level Card */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-white/80">
                  <ArrowRight className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-900">Volgend level</p>
                  <p className="text-xs text-surface-600">
                    Nog {levelInfo.xpForNext} XP nodig
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Profile Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profiel & Voorkeuren</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-surface-700 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Persoonlijke gegevens
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1.5">
                        Volledige naam
                      </label>
                      <Input
                        value={formData.full_name}
                        onChange={(e) => handleChange('full_name', e.target.value)}
                        placeholder="Je naam"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1.5">
                        E-mailadres
                      </label>
                      <Input
                        value={user?.email || ''}
                        disabled
                        className="bg-surface-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Company info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-surface-700 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Bedrijfsgegevens
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1.5">
                        Bedrijfsnaam
                      </label>
                      <Input
                        value={formData.company_name}
                        onChange={(e) => handleChange('company_name', e.target.value)}
                        placeholder="Je bedrijfsnaam"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1.5">
                        Branche
                      </label>
                      <Select
                        value={formData.industry}
                        onChange={(e) => handleChange('industry', e.target.value)}
                        options={industryOptions}
                        placeholder="Selecteer branche"
                      />
                    </div>
                  </div>
                </div>

                {/* Content preferences */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-surface-700 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Content voorkeuren
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1.5">
                        Voorkeurstoon
                      </label>
                      <Select
                        value={formData.preferred_tone}
                        onChange={(e) => handleChange('preferred_tone', e.target.value)}
                        options={toneOptions}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1.5">
                        Doelgroep
                      </label>
                      <Input
                        value={formData.target_audience}
                        onChange={(e) => handleChange('target_audience', e.target.value)}
                        placeholder="bijv. MKB-ondernemers, 25-45 jaar"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1.5">
                      Brand voice / Merkstem
                    </label>
                    <Textarea
                      value={formData.brand_voice}
                      onChange={(e) => handleChange('brand_voice', e.target.value)}
                      placeholder="Beschrijf de tone of voice van je merk. Bijv. 'Informeel maar professioneel, gebruiken humor maar blijven betrouwbaar'"
                      rows={3}
                    />
                    <p className="text-xs text-surface-500 mt-1">
                      Deze informatie wordt gebruikt om AI-gegenereerde content beter af te stemmen op je merk.
                    </p>
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
                  {saved && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="h-4 w-4" />
                      Opgeslagen
                    </span>
                  )}
                  {saveError && (
                    <span className="text-sm text-red-600">
                      Fout: {saveError}
                    </span>
                  )}
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Opslaan...
                      </>
                    ) : (
                      'Wijzigingen opslaan'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
