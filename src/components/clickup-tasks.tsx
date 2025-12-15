'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { ClickUpTask, ClickUpStatus } from '@/types'
import { formatDueDate, isTaskClosed, getPriorityColor } from '@/lib/clickup'

interface ClickUpTasksProps {
  clientId: string
  listId?: string
  canEdit?: boolean
}

export function ClickUpTasks({ clientId, listId, canEdit = false }: ClickUpTasksProps) {
  const [tasks, setTasks] = useState<ClickUpTask[]>([])
  const [statuses, setStatuses] = useState<ClickUpStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingTask, setUpdatingTask] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    if (!listId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/clickup/tasks?clientId=${clientId}&includeClosed=${showClosed}`
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      setTasks(data.tasks || [])

      // Also fetch list statuses
      const listRes = await fetch(`/api/clickup/lists?listId=${listId}`)
      const listData = await listRes.json()

      if (listRes.ok && listData.list?.statuses) {
        setStatuses(listData.list.statuses)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij ophalen van taken')
    } finally {
      setLoading(false)
    }
  }, [clientId, listId, showClosed])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setUpdatingTask(taskId)

    try {
      const res = await fetch(`/api/clickup/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          status: newStatus,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      // Update task in local state
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? data.task : t))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij bijwerken van taak')
    } finally {
      setUpdatingTask(null)
    }
  }

  const toggleTaskComplete = async (task: ClickUpTask) => {
    // Find the "closed" status or the last status in the list
    const closedStatus = statuses.find((s) => s.type === 'closed')
    // Find an "open" status to revert to
    const openStatus = statuses.find((s) => s.type === 'open') || statuses[0]

    if (isTaskClosed(task)) {
      // Re-open the task
      if (openStatus) {
        await updateTaskStatus(task.id, openStatus.status)
      }
    } else {
      // Complete the task
      if (closedStatus) {
        await updateTaskStatus(task.id, closedStatus.status)
      }
    }
  }

  const getDueDateInfo = (task: ClickUpTask) => {
    if (!task.due_date) return null

    const dueDate = new Date(parseInt(task.due_date))
    const now = new Date()
    const isOverdue = dueDate < now && !isTaskClosed(task)

    return {
      text: formatDueDate(task.due_date),
      isOverdue,
    }
  }

  if (!listId) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-surface-500">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-surface-400" />
            <p>ClickUp is nog niet gekoppeld voor deze client.</p>
            <p className="text-sm mt-1">Ga naar Instellingen om een ClickUp list te koppelen.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-surface-600">Taken laden...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p className="text-red-600">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTasks}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Opnieuw proberen
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const openTasks = tasks.filter((t) => !isTaskClosed(t))
  const closedTasks = tasks.filter((t) => isTaskClosed(t))

  return (
    <div className="space-y-4">
      {/* Header with refresh and filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{openTasks.length} open</Badge>
          {closedTasks.length > 0 && (
            <Badge variant="outline">{closedTasks.length} afgerond</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClosed(!showClosed)}
          >
            {showClosed ? 'Verberg afgerond' : 'Toon afgerond'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTasks}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-surface-500">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>Geen taken gevonden</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const isClosed = isTaskClosed(task)
            const dueDateInfo = getDueDateInfo(task)
            const isExpanded = expandedTask === task.id
            const isUpdating = updatingTask === task.id

            return (
              <div
                key={task.id}
                className={`border rounded-xl transition-all ${
                  isClosed
                    ? 'bg-surface-50 border-surface-200'
                    : 'bg-white border-surface-200 hover:border-surface-300'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => canEdit && toggleTaskComplete(task)}
                      disabled={!canEdit || isUpdating}
                      className={`mt-0.5 flex-shrink-0 ${
                        canEdit ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : isClosed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle
                          className={`h-5 w-5 ${
                            canEdit
                              ? 'text-surface-400 hover:text-primary'
                              : 'text-surface-300'
                          }`}
                        />
                      )}
                    </button>

                    {/* Task Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p
                            className={`font-medium ${
                              isClosed
                                ? 'text-surface-500 line-through'
                                : 'text-surface-900'
                            }`}
                          >
                            {task.name}
                          </p>

                          {/* Meta info */}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {/* Status Badge */}
                            <Badge
                              style={{
                                backgroundColor: task.status.color + '20',
                                color: task.status.color,
                                borderColor: task.status.color,
                              }}
                              className="text-xs border"
                            >
                              {task.status.status}
                            </Badge>

                            {/* Priority */}
                            {task.priority && (
                              <div
                                className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}
                                title={task.priority.priority}
                              />
                            )}

                            {/* Due Date */}
                            {dueDateInfo && (
                              <span
                                className={`flex items-center gap-1 text-xs ${
                                  dueDateInfo.isOverdue
                                    ? 'text-red-600'
                                    : 'text-surface-500'
                                }`}
                              >
                                <Calendar className="h-3 w-3" />
                                {dueDateInfo.text}
                              </span>
                            )}

                            {/* Assignees */}
                            {task.assignees.length > 0 && (
                              <div className="flex items-center gap-1">
                                {task.assignees.slice(0, 3).map((assignee) => (
                                  <div
                                    key={assignee.id}
                                    className="w-5 h-5 rounded-full bg-surface-200 flex items-center justify-center text-xs font-medium"
                                    style={{
                                      backgroundColor: assignee.color + '30',
                                      color: assignee.color,
                                    }}
                                    title={assignee.username}
                                  >
                                    {assignee.initials}
                                  </div>
                                ))}
                                {task.assignees.length > 3 && (
                                  <span className="text-xs text-surface-500">
                                    +{task.assignees.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedTask(isExpanded ? null : task.id)
                            }
                            className="h-8 w-8 p-0"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-8 w-8 p-0 inline-flex items-center justify-center text-surface-500 hover:text-primary"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-surface-100">
                          {task.description ? (
                            <p className="text-sm text-surface-600 whitespace-pre-wrap">
                              {task.description}
                            </p>
                          ) : (
                            <p className="text-sm text-surface-400 italic">
                              Geen beschrijving
                            </p>
                          )}

                          {/* Status change dropdown for editors */}
                          {canEdit && statuses.length > 0 && (
                            <div className="mt-4">
                              <label className="block text-xs font-medium text-surface-500 mb-1">
                                Status wijzigen
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {statuses.map((status) => (
                                  <button
                                    key={status.id}
                                    onClick={() =>
                                      updateTaskStatus(task.id, status.status)
                                    }
                                    disabled={
                                      isUpdating ||
                                      task.status.status === status.status
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                      task.status.status === status.status
                                        ? 'ring-2 ring-offset-1'
                                        : 'hover:opacity-80'
                                    }`}
                                    style={{
                                      backgroundColor: status.color + '20',
                                      color: status.color,
                                      borderColor: status.color,
                                      ...(task.status.status === status.status
                                        ? { ringColor: status.color }
                                        : {}),
                                    }}
                                  >
                                    {status.status}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
