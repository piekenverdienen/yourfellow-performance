import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ClientWithRole } from '@/types'

interface ClientState {
  // List of accessible clients
  clients: ClientWithRole[]
  // Currently selected client
  selectedClient: ClientWithRole | null
  // Loading state
  isLoading: boolean
  // Error state
  error: string | null
  // Actions
  setClients: (clients: ClientWithRole[]) => void
  selectClient: (client: ClientWithRole | null) => void
  selectClientById: (clientId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  fetchClients: () => Promise<void>
  clearSelectedClient: () => void
  reset: () => void
}

const initialState = {
  clients: [],
  selectedClient: null,
  isLoading: false,
  error: null,
}

export const useClientStore = create<ClientState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setClients: (clients) => set({ clients }),

      selectClient: (client) => set({ selectedClient: client }),

      selectClientById: (clientId) => {
        const { clients } = get()
        const client = clients.find((c) => c.id === clientId) || null
        set({ selectedClient: client })
      },

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      clearSelectedClient: () => set({ selectedClient: null }),

      fetchClients: async () => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch('/api/clients')
          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch clients')
          }

          const clients = data.clients || []
          set({ clients, isLoading: false })

          // If we have a selected client, make sure it's still in the list
          const { selectedClient } = get()
          if (selectedClient) {
            const stillExists = clients.find(
              (c: ClientWithRole) => c.id === selectedClient.id
            )
            if (!stillExists) {
              set({ selectedClient: null })
            } else {
              // Update selected client with fresh data
              set({ selectedClient: stillExists })
            }
          }
        } catch (error) {
          console.error('Error fetching clients:', error)
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch clients',
            isLoading: false,
          })
        }
      },

      reset: () => set(initialState),
    }),
    {
      name: 'yourfellow-client-storage',
      // Only persist selectedClient ID, not the full client list
      partialize: (state) => ({
        selectedClient: state.selectedClient
          ? { id: state.selectedClient.id }
          : null,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydrating, we need to fetch fresh client data
        // and match it with the stored client ID
        if (state?.selectedClient?.id) {
          const storedClientId = state.selectedClient.id
          // Fetch clients and select the stored one
          state.fetchClients().then(() => {
            state.selectClientById(storedClientId)
          })
        }
      },
    }
  )
)

// Hook to get the current client ID for API calls
export function useSelectedClientId(): string | null {
  const selectedClient = useClientStore((state) => state.selectedClient)
  return selectedClient?.id || null
}

// Hook to check if user can edit (has editor, admin, or owner role)
export function useCanEditClient(): boolean {
  const selectedClient = useClientStore((state) => state.selectedClient)
  if (!selectedClient) return false
  return ['editor', 'admin', 'owner'].includes(selectedClient.role)
}

// Hook to check if user is admin or owner
export function useIsClientAdmin(): boolean {
  const selectedClient = useClientStore((state) => state.selectedClient)
  if (!selectedClient) return false
  return ['admin', 'owner'].includes(selectedClient.role)
}
