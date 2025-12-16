'use client'

import { useEffect, useState } from 'react'
import { useClientStore } from '@/stores/client-store'
import { Building2, ChevronDown, Check, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClientSelectorProps {
  showCreateButton?: boolean
  onCreateClick?: () => void
  className?: string
}

export function ClientSelector({
  showCreateButton = false,
  onCreateClick,
  className,
}: ClientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const {
    clients,
    selectedClient,
    isLoading,
    fetchClients,
    selectClient,
    clearSelectedClient,
  } = useClientStore()

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleSelect = (client: typeof selectedClient) => {
    selectClient(client)
    setIsOpen(false)
  }

  const handleClearSelection = () => {
    clearSelectedClient()
    setIsOpen(false)
  }

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
          'hover:border-primary/50 hover:bg-surface-50',
          isOpen
            ? 'border-primary bg-primary/5'
            : 'border-surface-200 bg-white',
          selectedClient ? 'min-w-[180px]' : 'min-w-[140px]'
        )}
      >
        <Building2 className="h-4 w-4 text-surface-500" />
        <span className="text-sm font-medium text-surface-700 truncate max-w-[120px]">
          {isLoading
            ? 'Laden...'
            : selectedClient
            ? selectedClient.name
            : 'Alle klanten'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-surface-400 transition-transform ml-auto',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-surface-200 z-20 overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 border-b border-surface-100 bg-surface-50">
              <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">
                Selecteer klant
              </p>
            </div>

            {/* Options */}
            <div className="max-h-64 overflow-y-auto py-1">
              {/* All clients option */}
              <button
                onClick={handleClearSelection}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-surface-50 transition-colors',
                  !selectedClient && 'bg-primary/5 text-primary'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-surface-400" />
                </div>
                <span className="flex-1 font-medium">Alle klanten</span>
                {!selectedClient && <Check className="h-4 w-4" />}
              </button>

              {/* Divider */}
              {clients.length > 0 && (
                <div className="my-1 border-t border-surface-100" />
              )}

              {/* Client list */}
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleSelect(client)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-surface-50 transition-colors',
                    selectedClient?.id === client.id && 'bg-primary/5 text-primary'
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {client.logo_url ? (
                      <img
                        src={client.logo_url}
                        alt={client.name}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{client.name}</p>
                    <p className="text-xs text-surface-500 capitalize">
                      {client.role === 'admin' ? 'Beheerder' : client.role}
                    </p>
                  </div>
                  {selectedClient?.id === client.id && (
                    <Check className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>
              ))}

              {/* Empty state */}
              {clients.length === 0 && !isLoading && (
                <div className="px-3 py-4 text-center text-sm text-surface-500">
                  Geen klanten beschikbaar
                </div>
              )}
            </div>

            {/* Create button */}
            {showCreateButton && onCreateClick && (
              <>
                <div className="border-t border-surface-100" />
                <button
                  onClick={() => {
                    setIsOpen(false)
                    onCreateClick()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span className="font-medium">Nieuwe klant</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
