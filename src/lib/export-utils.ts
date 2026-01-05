import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { MetaPerformanceRow, MetaEntityType } from '@/types/meta-ads'

interface ExportOptions {
  filename?: string
  dateRange?: { from: Date; to: Date }
  entityType?: MetaEntityType
}

// Column definitions for export
const columns = [
  { key: 'entity_name', label: 'Naam' },
  { key: 'status', label: 'Status' },
  { key: 'impressions', label: 'Impressies', format: 'number' },
  { key: 'reach', label: 'Bereik', format: 'number' },
  { key: 'clicks', label: 'Clicks', format: 'number' },
  { key: 'spend', label: 'Spend (€)', format: 'currency' },
  { key: 'ctr', label: 'CTR (%)', format: 'percent' },
  { key: 'cpc', label: 'CPC (€)', format: 'currency' },
  { key: 'cpm', label: 'CPM (€)', format: 'currency' },
  { key: 'frequency', label: 'Frequentie', format: 'decimal' },
  { key: 'conversions', label: 'Conversies', format: 'number' },
  { key: 'conversion_value', label: 'Conv. Waarde (€)', format: 'currency' },
  { key: 'cost_per_conversion', label: 'Kosten/Conv. (€)', format: 'currency' },
  { key: 'roas', label: 'ROAS', format: 'decimal' },
  { key: 'has_fatigue', label: 'Fatigue', format: 'boolean' },
  { key: 'fatigue_severity', label: 'Fatigue Ernst' },
] as const

function formatValue(
  value: unknown,
  format?: string
): string {
  if (value === null || value === undefined) return ''

  switch (format) {
    case 'number':
      return typeof value === 'number'
        ? new Intl.NumberFormat('nl-NL').format(value)
        : String(value)
    case 'currency':
      return typeof value === 'number'
        ? new Intl.NumberFormat('nl-NL', {
            style: 'currency',
            currency: 'EUR',
          }).format(value)
        : String(value)
    case 'percent':
      return typeof value === 'number' ? `${value.toFixed(2)}%` : String(value)
    case 'decimal':
      return typeof value === 'number' ? value.toFixed(2) : String(value)
    case 'boolean':
      return value ? 'Ja' : 'Nee'
    default:
      return String(value)
  }
}

function escapeCSV(value: string): string {
  // Escape double quotes and wrap in quotes if contains comma, newline, or quote
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportToCSV(
  data: MetaPerformanceRow[],
  options: ExportOptions = {}
): void {
  const {
    filename = 'meta-ads-export',
    dateRange,
    entityType,
  } = options

  // Build CSV content
  const headers = columns.map((col) => col.label)
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key as keyof MetaPerformanceRow]
      return escapeCSV(formatValue(value, col.format))
    })
  )

  // Create CSV string with BOM for Excel compatibility
  const BOM = '\uFEFF'
  const csvContent = BOM + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')

  // Create filename with date range
  let finalFilename = filename
  if (dateRange) {
    const fromStr = format(dateRange.from, 'dd-MM-yyyy', { locale: nl })
    const toStr = format(dateRange.to, 'dd-MM-yyyy', { locale: nl })
    finalFilename += `_${fromStr}_${toStr}`
  }
  if (entityType) {
    finalFilename += `_${entityType}s`
  }
  finalFilename += '.csv'

  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, finalFilename)
}

export function exportToExcel(
  data: MetaPerformanceRow[],
  options: ExportOptions = {}
): void {
  const {
    filename = 'meta-ads-export',
    dateRange,
    entityType,
  } = options

  // Build table HTML for Excel
  const headers = columns.map((col) => `<th>${col.label}</th>`).join('')
  const rows = data
    .map((row) => {
      const cells = columns
        .map((col) => {
          const value = row[col.key as keyof MetaPerformanceRow]
          const formattedValue = formatValue(value, col.format)
          // Use different style based on fatigue
          const style =
            col.key === 'has_fatigue' && value
              ? 'background-color: #FEF3C7;'
              : ''
          return `<td style="${style}">${formattedValue}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  // Create Excel-compatible HTML
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Meta Ads Data</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; }
        th { background-color: #1877F2; color: white; font-weight: bold; padding: 8px; text-align: left; }
        td { border: 1px solid #ddd; padding: 6px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `

  // Create filename with date range
  let finalFilename = filename
  if (dateRange) {
    const fromStr = format(dateRange.from, 'dd-MM-yyyy', { locale: nl })
    const toStr = format(dateRange.to, 'dd-MM-yyyy', { locale: nl })
    finalFilename += `_${fromStr}_${toStr}`
  }
  if (entityType) {
    finalFilename += `_${entityType}s`
  }
  finalFilename += '.xls'

  // Download file
  const blob = new Blob([html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  })
  downloadBlob(blob, finalFilename)
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Generate summary report
export function generateSummaryReport(
  data: MetaPerformanceRow[],
  dateRange: { from: Date; to: Date }
): string {
  const totals = data.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      spend: acc.spend + row.spend,
      conversions: acc.conversions + row.conversions,
      revenue: acc.revenue + row.conversion_value,
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 }
  )

  const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const avgCPC = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0

  const fromStr = format(dateRange.from, 'd MMMM yyyy', { locale: nl })
  const toStr = format(dateRange.to, 'd MMMM yyyy', { locale: nl })

  return `
META ADS PERFORMANCE RAPPORT
============================
Periode: ${fromStr} - ${toStr}
Aantal entities: ${data.length}

TOTALEN
-------
Impressies:   ${new Intl.NumberFormat('nl-NL').format(totals.impressions)}
Clicks:       ${new Intl.NumberFormat('nl-NL').format(totals.clicks)}
Spend:        ${new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(totals.spend)}
Conversies:   ${new Intl.NumberFormat('nl-NL').format(totals.conversions)}
Omzet:        ${new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(totals.revenue)}

GEMIDDELDES
-----------
CTR:          ${avgCTR.toFixed(2)}%
CPC:          ${new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(avgCPC)}
ROAS:         ${roas.toFixed(2)}x

TOP 5 PERFORMERS (op ROAS)
--------------------------
${data
  .sort((a, b) => b.roas - a.roas)
  .slice(0, 5)
  .map((row, i) => `${i + 1}. ${row.entity_name} - ROAS: ${row.roas.toFixed(2)}x`)
  .join('\n')}

AANDACHTSPUNTEN (Fatigue)
-------------------------
${data
  .filter((row) => row.has_fatigue)
  .map((row) => `- ${row.entity_name} (${row.fatigue_severity})`)
  .join('\n') || 'Geen ads met fatigue gedetecteerd'}
`.trim()
}
