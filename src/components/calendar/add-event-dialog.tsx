'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Loader2, Calendar, Globe } from 'lucide-react'
import { format } from 'date-fns'
import type { EventType, ClientWithRole } from '@/types'

interface AddEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEventAdded: () => void
  clients: ClientWithRole[]
  selectedClientId?: string | null
  isAdmin?: boolean
  defaultDate?: Date
}

const eventTypeOptions: { value: EventType; label: string; color: string }[] = [
  { value: 'launch', label: 'Launch', color: '#00FFCC' },
  { value: 'deadline', label: 'Deadline', color: '#F97316' },
  { value: 'campaign', label: 'Campagne', color: '#3B82F6' },
  { value: 'sale', label: 'Sale', color: '#EF4444' },
  { value: 'life', label: 'Life Event', color: '#8B5CF6' },
  { value: 'holiday', label: 'Feestdag', color: '#22C55E' },
]

export function AddEventDialog({
  open,
  onOpenChange,
  onEventAdded,
  clients,
  selectedClientId,
  isAdmin = false,
  defaultDate,
}: AddEventDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState(
    defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  )
  const [eventType, setEventType] = useState<EventType>('launch')
  const [clientId, setClientId] = useState<string>(selectedClientId || '')
  const [isGlobal, setIsGlobal] = useState(false)

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTitle('')
      setDescription('')
      setEventDate(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
      setEventType('launch')
      setClientId(selectedClientId || '')
      setIsGlobal(false)
      setError(null)
    }
    onOpenChange(newOpen)
  }

  // Filter clients where user can edit (owner, admin, editor)
  const editableClients = clients.filter(c =>
    ['owner', 'admin', 'editor'].includes(c.role)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          event_date: eventDate,
          event_type: eventType,
          client_id: clientId || null,
          is_global: isGlobal,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event')
      }

      onEventAdded()
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setLoading(false)
    }
  }

  const selectedTypeColor = eventTypeOptions.find(t => t.value === eventType)?.color || '#00FFCC'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogClose onClose={() => handleOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Nieuw Event</DialogTitle>
          <DialogDescription>
            Voeg een belangrijk moment toe aan je kalender
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Titel *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Bijv. Website lancering Aurelien"
                required
              />
            </div>

            {/* Date & Type row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Datum *
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                    className="pl-10"
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Type *
                </label>
                <div className="relative">
                  <Select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as EventType)}
                    options={eventTypeOptions.map(t => ({ value: t.value, label: t.label }))}
                    className="pl-10"
                  />
                  <div
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedTypeColor }}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Beschrijving
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionele details over dit event..."
                rows={2}
              />
            </div>

            {/* Client selection */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Client (optioneel)
              </label>
              <Select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                options={[
                  { value: '', label: 'Persoonlijk event (geen client)' },
                  ...editableClients.map(c => ({ value: c.id, label: c.name })),
                ]}
              />
              <p className="text-xs text-surface-500 mt-1">
                Laat leeg voor persoonlijke events zoals verjaardagen
              </p>
            </div>

            {/* Global toggle (admin only) */}
            {isAdmin && (
              <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
                <input
                  type="checkbox"
                  id="is_global"
                  checked={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.checked)}
                  className="w-4 h-4 rounded border-surface-300 text-primary focus:ring-primary"
                />
                <label htmlFor="is_global" className="flex items-center gap-2 text-sm cursor-pointer">
                  <Globe className="h-4 w-4 text-surface-500" />
                  <span>
                    <strong>Globaal event</strong>
                    <span className="text-surface-500 ml-1">- zichtbaar voor alle gebruikers</span>
                  </span>
                </label>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={loading || !title}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Event toevoegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
