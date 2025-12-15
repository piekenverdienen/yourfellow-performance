import type { ClickUpTask, ClickUpList, ClickUpStatus } from '@/types'

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2'

interface ClickUpClientConfig {
  apiKey: string
}

export class ClickUpClient {
  private apiKey: string

  constructor(config: ClickUpClientConfig) {
    this.apiKey = config.apiKey
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${CLICKUP_API_BASE}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        error.err || error.error || `ClickUp API error: ${response.status}`
      )
    }

    return response.json()
  }

  /**
   * Get all tasks from a list
   */
  async getTasks(
    listId: string,
    options: {
      archived?: boolean
      page?: number
      subtasks?: boolean
      statuses?: string[]
      include_closed?: boolean
      assignees?: string[]
      due_date_gt?: number
      due_date_lt?: number
    } = {}
  ): Promise<{ tasks: ClickUpTask[] }> {
    const params = new URLSearchParams()

    if (options.archived !== undefined) {
      params.append('archived', String(options.archived))
    }
    if (options.page !== undefined) {
      params.append('page', String(options.page))
    }
    if (options.subtasks !== undefined) {
      params.append('subtasks', String(options.subtasks))
    }
    if (options.include_closed !== undefined) {
      params.append('include_closed', String(options.include_closed))
    }
    if (options.statuses?.length) {
      options.statuses.forEach(status => params.append('statuses[]', status))
    }
    if (options.assignees?.length) {
      options.assignees.forEach(assignee => params.append('assignees[]', assignee))
    }
    if (options.due_date_gt !== undefined) {
      params.append('due_date_gt', String(options.due_date_gt))
    }
    if (options.due_date_lt !== undefined) {
      params.append('due_date_lt', String(options.due_date_lt))
    }

    const queryString = params.toString()
    const endpoint = `/list/${listId}/task${queryString ? `?${queryString}` : ''}`

    return this.request<{ tasks: ClickUpTask[] }>(endpoint)
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId: string): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`)
  }

  /**
   * Update a task (including status)
   */
  async updateTask(
    taskId: string,
    updates: {
      name?: string
      description?: string
      status?: string
      priority?: number | null
      due_date?: number | null
      due_date_time?: boolean
      start_date?: number | null
      start_date_time?: boolean
      assignees?: {
        add?: number[]
        rem?: number[]
      }
    }
  ): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  /**
   * Get list details including available statuses
   */
  async getList(listId: string): Promise<ClickUpList> {
    return this.request<ClickUpList>(`/list/${listId}`)
  }

  /**
   * Get all lists in a folder
   */
  async getListsInFolder(folderId: string): Promise<{ lists: ClickUpList[] }> {
    return this.request<{ lists: ClickUpList[] }>(`/folder/${folderId}/list`)
  }

  /**
   * Get all lists in a space (folderless lists)
   */
  async getListsInSpace(spaceId: string): Promise<{ lists: ClickUpList[] }> {
    return this.request<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`)
  }

  /**
   * Get all folders in a space
   */
  async getFolders(spaceId: string): Promise<{ folders: Array<{ id: string; name: string; lists: ClickUpList[] }> }> {
    return this.request(`/space/${spaceId}/folder`)
  }

  /**
   * Get all spaces in a team/workspace
   */
  async getSpaces(teamId: string): Promise<{ spaces: Array<{ id: string; name: string }> }> {
    return this.request(`/team/${teamId}/space`)
  }

  /**
   * Get authorized teams/workspaces
   */
  async getTeams(): Promise<{ teams: Array<{ id: string; name: string }> }> {
    return this.request('/team')
  }
}

/**
 * Create a ClickUp client instance
 */
export function createClickUpClient(apiKey: string): ClickUpClient {
  return new ClickUpClient({ apiKey })
}

/**
 * Helper to determine if a task is "done" based on status type
 */
export function isTaskClosed(task: ClickUpTask): boolean {
  return task.status.type === 'closed' || task.date_closed !== null
}

/**
 * Helper to format due date for display
 */
export function formatDueDate(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null

  const date = new Date(parseInt(dueDate))
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} dagen te laat`
  } else if (diffDays === 0) {
    return 'Vandaag'
  } else if (diffDays === 1) {
    return 'Morgen'
  } else if (diffDays <= 7) {
    return `Over ${diffDays} dagen`
  } else {
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
    })
  }
}

/**
 * Get priority color based on ClickUp priority
 */
export function getPriorityColor(priority: ClickUpTask['priority']): string {
  if (!priority) return 'bg-surface-200'

  switch (priority.priority.toLowerCase()) {
    case 'urgent':
      return 'bg-red-500'
    case 'high':
      return 'bg-orange-500'
    case 'normal':
      return 'bg-blue-500'
    case 'low':
      return 'bg-surface-400'
    default:
      return 'bg-surface-200'
  }
}
