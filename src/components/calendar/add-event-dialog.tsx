'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Loader2, Globe } from 'lucide-react'
import { format } from 'date-fns'
import type { EventType, ClientWithRole } from '@/types'

interface AddEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEventAdded: () => void
  clients: ClientWithRole[]
  selectedClientId?: string | null
  isAdmin: boolean
}

const eventTypes: { value: EventType; label: string }[] = [
  { value: 'launch', label: '🚀 Lancering' },
  { value: 'sale', label: '🛒 Sale / Actie' },
  { value: 'campaign', label: '📣 Campagne' },
  { value: 'deadline', label: '⏰ Deadline' },
  { value: 'life', label: '💜 Persoonlijk' },
  { value: 'holiday', label: '🎉 Feestdag' },
]

export function AddEventDialog({
  open,
  onOpenChange,
  onEventAdded,
  clients,
  selectedClientId,
  isAdmin,
}: AddEventDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [eventType, setEventType] = useState<EventType>('campaign')
  const [clientId, setClientId] = useState<string>(selectedClientId || '')
  const [isGlobal, setIsGlobal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          event_date: eventDate,
          event_type: eventType,
          client_id: clientId || null,
          is_global: isGlobal,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create event')
      }

      // Reset form
      setTitle('')
      setDescription('')
      setEventDate(format(new Date(), 'yyyy-MM-dd'))
      setEventType('campaign')
      setClientId(selectedClientId || '')
      setIsGlobal(false)

      onEventAdded()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Event toevoegen</DialogTitle>
          <DialogDescription>
            Voeg een belangrijke datum toe aan de kalender
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Titel *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Bijv. Black Friday Start"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Datum *
              </label>
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>

            {/* Event Type */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Type
              </label>
              <Select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
              >
                {eventTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Client (optional) */}
            {clients.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Client (optioneel)
                </label>
                <Select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">Persoonlijk event</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Beschrijving (optioneel)
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Extra details..."
                rows={2}
              />
            </div>

            {/* Global toggle (admin only) */}
            {isAdmin && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.checked)}
                  className="rounded border-surface-300 text-primary focus:ring-primary"
                />
                <Globe className="h-4 w-4 text-surface-500" />
                <span className="text-sm text-surface-700">
                  Globaal event (zichtbaar voor iedereen)
                </span>
              </label>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opslaan...
                </>
              ) : (
                'Toevoegen'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
