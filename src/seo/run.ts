#!/usr/bin/env tsx
/**
 * SEO Content Advisory CLI
 *
 * Usage:
 *   pnpm seo:run --url=https://example.com/page --site-url=https://example.com
 *
 * Options:
 *   --url              Page URL to analyze (required)
 *   --site-url         Search Console property URL (required)
 *   --impressions-min  Minimum impressions filter (default: 50)
 *   --position-min     Minimum position filter (default: 4)
 *   --position-max     Maximum position filter (default: 50)
 *   --output           Output format: json or markdown (default: json)
 *   --output-file      Write output to file instead of stdout
 *   --dry-run          Skip LLM call, only show keyword analysis
 *   --verbose          Show detailed progress logging
 *   --help             Show this help message
 *
 * Environment variables:
 *   SEARCH_CONSOLE_CREDENTIALS  Google service account JSON (or use GA4_CREDENTIALS)
 *   ANTHROPIC_API_KEY          Claude API key for recommendations
 */

import * as fs from 'fs'
import { SEOContentAdvisor, formatReportAsMarkdown } from './index'
import type { CLIOptions } from './types'

// Parse command line arguments
function parseArgs(): CLIOptions & { help?: boolean } {
  const args = process.argv.slice(2)
  const options: Record<string, string | boolean> = {}

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      const normalizedKey = key.replace(/-/g, '_')

      if (value === undefined) {
        // Boolean flag
        options[normalizedKey] = true
      } else {
        options[normalizedKey] = value
      }
    }
  }

  return {
    url: options.url as string,
    siteUrl: options.site_url as string | undefined,
    impressionsMin: options.impressions_min ? parseInt(options.impressions_min as string, 10) : undefined,
    positionMin: options.position_min ? parseInt(options.position_min as string, 10) : undefined,
    positionMax: options.position_max ? parseInt(options.position_max as string, 10) : undefined,
    outputFormat: (options.output as 'json' | 'markdown') || 'json',
    outputFile: options.output_file as string | undefined,
    dryRun: options.dry_run === true,
    verbose: options.verbose === true,
    help: options.help === true,
  }
}

function printHelp() {
  console.log(`
📊 SEO Content Advisory CLI

Analyzes a page's content and Search Console data to generate
actionable SEO recommendations.

USAGE:
  pnpm seo:run --url=<page-url> --site-url=<search-console-property>

REQUIRED OPTIONS:
  --url              Page URL to analyze
  --site-url         Search Console property URL
                     Format: https://example.com/ or sc-domain:example.com

FILTER OPTIONS:
  --impressions-min  Minimum impressions to consider (default: 50)
  --position-min     Minimum position for opportunities (default: 4)
  --position-max     Maximum position to consider (default: 50)

OUTPUT OPTIONS:
  --output           Output format: json or markdown (default: json)
  --output-file      Write output to file instead of stdout

OTHER OPTIONS:
  --dry-run          Skip LLM call, only show keyword analysis
  --verbose          Show detailed progress logging
  --help             Show this help message

ENVIRONMENT VARIABLES:
  SEARCH_CONSOLE_CREDENTIALS  Google service account JSON key
                              (falls back to GA4_CREDENTIALS)
  ANTHROPIC_API_KEY          Claude API key for AI recommendations

EXAMPLES:
  # Basic analysis
  pnpm seo:run --url=https://example.com/diensten --site-url=https://example.com

  # Filter high-opportunity keywords
  pnpm seo:run --url=https://example.com/page \\
    --site-url=https://example.com \\
    --impressions-min=100 \\
    --position-min=8

  # Generate markdown report
  pnpm seo:run --url=https://example.com/page \\
    --site-url=https://example.com \\
    --output=markdown \\
    --output-file=report.md

  # Dry run (no LLM cost)
  pnpm seo:run --url=https://example.com/page \\
    --site-url=https://example.com \\
    --dry-run
`)
}

async function main() {
  const options = parseArgs()

  // Show help
  if (options.help) {
    printHelp()
    process.exit(0)
  }

  // Validate required options
  if (!options.url) {
    console.error('❌ Error: --url is required')
    console.error('   Run with --help for usage information')
    process.exit(1)
  }

  if (!options.siteUrl) {
    console.error('❌ Error: --site-url is required')
    console.error('   This should be your Search Console property URL')
    console.error('   Format: https://example.com/ or sc-domain:example.com')
    process.exit(1)
  }

  // Validate URL format
  try {
    new URL(options.url)
  } catch {
    console.error(`❌ Error: Invalid URL: ${options.url}`)
    process.exit(1)
  }

  // Check environment variables
  const hasCredentials =
    process.env.SEARCH_CONSOLE_CREDENTIALS || process.env.GA4_CREDENTIALS
  if (!hasCredentials) {
    console.error('❌ Error: Missing Search Console credentials')
    console.error('   Set SEARCH_CONSOLE_CREDENTIALS or GA4_CREDENTIALS environment variable')
    console.error('   This should contain the full JSON service account key')
    process.exit(1)
  }

  if (!options.dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: Missing ANTHROPIC_API_KEY environment variable')
    console.error('   This is required for AI-powered recommendations')
    console.error('   Use --dry-run to skip the AI analysis')
    process.exit(1)
  }

  // Run analysis
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                 SEO Content Advisory                        ║
║                    YourFellow                               ║
╚══════════════════════════════════════════════════════════════╝
`)

  const advisor = new SEOContentAdvisor()
  const result = await advisor.analyze(options.url, options)

  if (!result.success) {
    console.error(`\n❌ Analysis failed: ${result.error}`)
    process.exit(1)
  }

  // Format output
  let output: string
  if (options.outputFormat === 'markdown') {
    output = formatReportAsMarkdown(result.data!)
  } else {
    output = JSON.stringify(result.data, null, 2)
  }

  // Write output
  if (options.outputFile) {
    fs.writeFileSync(options.outputFile, output, 'utf-8')
    console.log(`\n✅ Report written to: ${options.outputFile}`)
  } else {
    console.log('\n' + '='.repeat(60))
    console.log('REPORT OUTPUT')
    console.log('='.repeat(60) + '\n')
    console.log(output)
  }

  // Print timing summary
  if (result.timing) {
    console.log('\n' + '-'.repeat(40))
    console.log('Timing:')
    console.log(`  Page fetch:      ${result.timing.pageFetch}ms`)
    console.log(`  Search Console:  ${result.timing.searchConsole}ms`)
    console.log(`  Analysis:        ${result.timing.analysis}ms`)
    console.log(`  LLM:             ${result.timing.llm}ms`)
    console.log(`  Total:           ${result.timing.total}ms`)
  }

  console.log('\n✅ Analysis complete!')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
