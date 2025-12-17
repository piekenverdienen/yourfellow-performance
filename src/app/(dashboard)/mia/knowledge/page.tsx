'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Upload,
  FileText,
  File,
  Trash2,
  Loader2,
  Check,
  X,
  Search,
  Filter,
  Plus,
  BookOpen,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AssistantAvatar } from '@/components/assistant-avatars'

interface KnowledgeDocument {
  id: string
  name: string
  description: string | null
  file_name: string
  file_type: string
  file_size: number
  category: string
  tags: string[]
  is_active: boolean
  is_processed: boolean
  processing_error: string | null
  created_at: string
}

const CATEGORIES = [
  { value: 'general', label: 'Algemeen' },
  { value: 'seo', label: 'SEO' },
  { value: 'sea', label: 'SEA / Google Ads' },
  { value: 'social', label: 'Social Media' },
  { value: 'reporting', label: 'Rapportage' },
  { value: 'templates', label: 'Templates' },
]

const FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/plain': 'txt',
  'text/markdown': 'md',
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Upload form state
  const [uploadName, setUploadName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadCategory, setUploadCategory] = useState('general')
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const supabase = createClient()

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setDocuments(data)
    }
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const fileType = FILE_TYPES[file.type]
      if (!fileType) {
        alert('Ongeldig bestandstype. Upload een PDF, Word, Excel of tekst bestand.')
        return
      }
      setUploadFile(file)
      if (!uploadName) {
        setUploadName(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadName) return

    setIsUploading(true)
    setUploadProgress('Bestand uploaden...')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Niet ingelogd')

      const fileType = FILE_TYPES[uploadFile.type] || 'unknown'
      const filePath = `${user.id}/${Date.now()}-${uploadFile.name}`

      // 1. Upload file to storage
      setUploadProgress('Bestand uploaden naar storage...')
      const { error: uploadError } = await supabase.storage
        .from('knowledge-documents')
        .upload(filePath, uploadFile)

      if (uploadError) throw uploadError

      // 2. Create document record
      setUploadProgress('Document registreren...')
      const { data: doc, error: insertError } = await supabase
        .from('knowledge_documents')
        .insert({
          name: uploadName,
          description: uploadDescription || null,
          file_name: uploadFile.name,
          file_type: fileType,
          file_size: uploadFile.size,
          file_path: filePath,
          category: uploadCategory,
          uploaded_by: user.id,
          assistant_slugs: ['mia'],
        })
        .select()
        .single()

      if (insertError) throw insertError

      // 3. Extract text content via API
      setUploadProgress('Tekst extraheren...')
      const extractResponse = await fetch('/api/knowledge/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      })

      if (!extractResponse.ok) {
        console.warn('Text extraction failed, document saved without content')
      }

      // Reset form
      setUploadFile(null)
      setUploadName('')
      setUploadDescription('')
      setUploadCategory('general')
      setShowUploadForm(false)

      // Refresh list
      await fetchDocuments()
      setUploadProgress(null)

    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload mislukt: ' + (error instanceof Error ? error.message : 'Onbekende fout'))
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }

  const handleDelete = async (doc: KnowledgeDocument) => {
    if (!confirm(`Weet je zeker dat je "${doc.name}" wilt verwijderen?`)) return

    setDeletingId(doc.id)
    try {
      // Delete from database (storage file cleanup can be done separately)
      await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', doc.id)

      await fetchDocuments()
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !filterCategory || doc.category === filterCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/mia" className="p-2 hover:bg-surface-100 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-surface-600" />
          </Link>
          <div className="flex items-center gap-3">
            <AssistantAvatar slug="mia" size="md" />
            <div>
              <h1 className="text-2xl font-bold text-surface-900">Kennisbank</h1>
              <p className="text-surface-600">Documenten voor Mia's expertise</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowUploadForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Document toevoegen
        </Button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Nieuw document uploaden
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File input */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Bestand (PDF, Word, Excel of tekst)
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
                  onChange={handleFileSelect}
                  className="flex-1"
                />
                {uploadFile && (
                  <Badge variant="secondary">
                    {uploadFile.name} ({formatFileSize(uploadFile.size)})
                  </Badge>
                )}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Naam *
              </label>
              <Input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="bijv. SEO Content Briefing Template"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Beschrijving
              </label>
              <Textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Waar gaat dit document over?"
                rows={2}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Categorie
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleUpload}
                disabled={!uploadFile || !uploadName || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {uploadProgress || 'Uploaden...'}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Uploaden
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadForm(false)
                  setUploadFile(null)
                  setUploadName('')
                  setUploadDescription('')
                }}
                disabled={isUploading}
              >
                Annuleren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek in documenten..."
            className="pl-9"
          />
        </div>
        <select
          value={filterCategory || ''}
          onChange={(e) => setFilterCategory(e.target.value || null)}
          className="px-3 py-2 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-w-[150px]"
        >
          <option value="">Alle categorieën</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="h-12 w-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              {documents.length === 0 ? 'Nog geen documenten' : 'Geen resultaten'}
            </h3>
            <p className="text-surface-600 mb-4">
              {documents.length === 0
                ? 'Upload je eerste document om Mia\'s kennis uit te breiden.'
                : 'Probeer een andere zoekopdracht of filter.'}
            </p>
            {documents.length === 0 && (
              <Button onClick={() => setShowUploadForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Eerste document toevoegen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map(doc => (
            <Card key={doc.id} className={cn(
              "transition-all hover:shadow-md",
              !doc.is_processed && "border-amber-200 bg-amber-50/50"
            )}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* File icon */}
                  <div className={cn(
                    "p-3 rounded-lg",
                    doc.file_type === 'pdf' ? "bg-red-100 text-red-600" :
                    doc.file_type === 'docx' || doc.file_type === 'doc' ? "bg-blue-100 text-blue-600" :
                    doc.file_type === 'xlsx' || doc.file_type === 'xls' ? "bg-green-100 text-green-600" :
                    "bg-surface-100 text-surface-600"
                  )}>
                    <FileText className="h-6 w-6" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-surface-900 truncate">{doc.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}
                      </Badge>
                      {!doc.is_processed && (
                        <Badge variant="warning" className="text-xs">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Verwerken...
                        </Badge>
                      )}
                      {doc.processing_error && (
                        <Badge variant="error" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Fout
                        </Badge>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-sm text-surface-600 mb-2 line-clamp-1">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-surface-500">
                      <span>{doc.file_name}</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>{new Date(doc.created_at).toLocaleDateString('nl-NL')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      className="text-surface-400 hover:text-red-500"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats */}
      {documents.length > 0 && (
        <div className="mt-6 p-4 bg-surface-50 rounded-lg">
          <div className="flex items-center gap-6 text-sm text-surface-600">
            <span><strong>{documents.length}</strong> documenten</span>
            <span><strong>{documents.filter(d => d.is_processed).length}</strong> verwerkt</span>
            <span><strong>{formatFileSize(documents.reduce((sum, d) => sum + d.file_size, 0))}</strong> totaal</span>
          </div>
        </div>
      )}
    </div>
  )
}
