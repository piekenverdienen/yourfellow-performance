'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  User,
  Bell,
  Shield,
  Palette,
  ChevronRight,
  Building2,
} from 'lucide-react'

const settingsItems = [
  {
    title: 'Mijn Profiel',
    description: 'Beheer je persoonlijke gegevens en voorkeuren',
    href: '/settings/profile',
    icon: User,
  },
  {
    title: 'Bedrijfsgegevens',
    description: 'Branche, doelgroep en merkstem instellingen',
    href: '/settings/profile',
    icon: Building2,
  },
  {
    title: 'Notificaties',
    description: 'Beheer je e-mail en push notificaties',
    href: '/settings/notifications',
    icon: Bell,
    comingSoon: true,
  },
  {
    title: 'Beveiliging',
    description: 'Wachtwoord en tweestapsverificatie',
    href: '/settings/security',
    icon: Shield,
    comingSoon: true,
  },
  {
    title: 'Uiterlijk',
    description: 'Thema en weergave voorkeuren',
    href: '/settings/appearance',
    icon: Palette,
    comingSoon: true,
  },
]

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Instellingen</h1>
        <p className="text-surface-600 mt-1">Beheer je account en voorkeuren</p>
      </div>

      <div className="grid gap-4">
        {settingsItems.map((item) => {
          const Icon = item.icon
          const content = (
            <Card className={item.comingSoon ? 'opacity-60' : 'hover:bg-surface-50 transition-colors cursor-pointer'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-surface-100">
                    <Icon className="h-5 w-5 text-surface-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-surface-900">{item.title}</h3>
                      {item.comingSoon && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 text-surface-500">
                          Binnenkort
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-surface-500">{item.description}</p>
                  </div>
                  {!item.comingSoon && (
                    <ChevronRight className="h-5 w-5 text-surface-400" />
                  )}
                </div>
              </CardContent>
            </Card>
          )

          if (item.comingSoon) {
            return <div key={item.title}>{content}</div>
          }

          return (
            <Link key={item.title} href={item.href}>
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
