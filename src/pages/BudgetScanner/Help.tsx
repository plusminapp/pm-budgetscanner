import { useEffect, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Button } from '@mui/material'
import { ArrowLeft, ArrowUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type TocItem = {
  level: number
  text: string
  id: string
}

function parseHeadingTextAndId(text: string): { text: string; id?: string } {
  const match = text.match(/^(.*?)\s*\{#([A-Za-z0-9_-]+)\}\s*$/)
  if (!match) {
    return { text }
  }
  return {
    text: match[1].trim(),
    id: match[2],
  }
}

function resolveDocAssetPath(src?: string): string | undefined {
  if (!src) return src
  // Keep absolute and data URLs untouched.
  if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:') || src.startsWith('/')) {
    return src
  }
  return `/docs/budgetscanner/${src.replace(/^\.\//, '')}`
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function extractToc(markdown: string): TocItem[] {
  const seenIds = new Map<string, number>()

  return markdown
    .split('\n')
    .map((line) => line.match(/^(#{2,4})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => {
      const level = match[1].length
      const parsed = parseHeadingTextAndId(match[2].trim())
      const text = parsed.text
      const baseId = parsed.id ?? slugifyHeading(text)
      const count = seenIds.get(baseId) ?? 0
      seenIds.set(baseId, count + 1)
      const id = count === 0 ? baseId : `${baseId}-${count}`
      return { level, text, id }
    })
}

function extractNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(extractNodeText).join('')
  }
  if (node && typeof node === 'object' && 'props' in node) {
    const element = node as { props?: { children?: ReactNode } }
    return extractNodeText(element.props?.children ?? '')
  }
  return ''
}

function createHeadingRenderer(tag: 'h1' | 'h2' | 'h3' | 'h4', className: string) {
  return ({ children }: { children?: React.ReactNode }) => {
    const rawText = extractNodeText(children)
    const parsed = parseHeadingTextAndId(rawText)
    const Tag = tag
    return <Tag id={parsed.id ?? slugifyHeading(parsed.text)} className={className}>{parsed.text}</Tag>
  }
}

type BudgetScannerHelpContentProps = {
  containerClassName?: string
}

export function BudgetScannerHelpContent({ containerClassName = 'py-8 px-[10%]' }: BudgetScannerHelpContentProps) {
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTocOpen, setIsTocOpen] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null)
  const tocItems = extractToc(markdown)

  useEffect(() => {
    // Laad het Markdown-bestand van de public folder
    fetch('/docs/budgetscanner/BudgetScanner.md')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Handleiding niet gevonden')
        }
        return response.text()
      })
      .then((text) => {
        setMarkdown(text)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!lightboxImage) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxImage(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [lightboxImage])

  if (loading) {
    return (
      <div className={containerClassName}>
        <p>Handleiding wordt geladen...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={containerClassName}>
        <p className="text-red-600">Fout bij laden handleiding: {error}</p>
      </div>
    )
  }

  return (
    <div className={containerClassName}>
      {tocItems.length > 0 && (
        <nav className="mb-8 rounded-lg border border-gray-200 bg-gray-50" aria-label="Inhoudsopgave">
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-left"
            aria-expanded={isTocOpen}
            aria-controls="budgetscanner-help-toc"
            onClick={() => setIsTocOpen((open) => !open)}
          >
            <h2 className="text-lg font-semibold text-gray-900">Inhoudsopgave</h2>
            <span className="text-sm text-gray-600">{isTocOpen ? 'Verberg' : 'Toon'} inhoudsopgave</span>
          </button>
          {isTocOpen && (
            <div id="budgetscanner-help-toc" className="border-t border-gray-200 px-4 pb-4 pt-3">
              <ul className="space-y-2">
                {tocItems.map((item) => (
                  <li key={item.id} className={item.level === 2 ? '' : item.level === 3 ? 'ml-4' : 'ml-8'}>
                    <a className="text-green-700 hover:text-green-800 hover:underline" href={`#${item.id}`}>
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>
      )}

      <article className="prose prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            h1: createHeadingRenderer('h1', 'text-4xl font-bold mt-8 mb-4 text-gray-900'),
            h2: createHeadingRenderer('h2', 'text-3xl font-bold mt-6 mb-3 text-gray-800 scroll-mt-6'),
            h3: createHeadingRenderer('h3', 'text-2xl font-semibold mt-5 mb-2 text-gray-700 scroll-mt-6'),
            h4: createHeadingRenderer('h4', 'text-xl font-semibold mt-4 mb-2 text-gray-700 scroll-mt-6'),
            p: ({ children, node }) => {
              // A standalone image in markdown becomes <p><img></p>; rendering <figure>
              // inside <p> is invalid HTML. Use a div wrapper in that case.
              const hasImg = node?.children?.some(
                (n) => n.type === 'element' && (n as { tagName?: string }).tagName === 'img'
              )
              if (hasImg) return <div className="mb-4">{children}</div>
              return <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
            },
            ul: ({ children }) => (
              <ul className="!list-disc !list-outside !pl-6 mb-4 text-gray-700">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="!list-decimal !list-outside !pl-6 mb-4 text-gray-700">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="!ml-0 mb-2">{children}</li>
            ),
            img: ({ src, alt }) => {
              const resolvedSrc = resolveDocAssetPath(src)
              if (!resolvedSrc) return null
              return (
                <figure className="my-6">
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in"
                    onClick={() => setLightboxImage({ src: resolvedSrc, alt })}
                    aria-label={alt ? `Vergroot afbeelding: ${alt}` : 'Vergroot afbeelding'}
                  >
                    <img className="max-w-full h-auto rounded" src={resolvedSrc} alt={alt} />
                  </button>
                  {alt && (
                    <figcaption className="mt-2 text-center text-sm italic text-gray-500">
                      {alt}
                    </figcaption>
                  )}
                </figure>
              )
            },
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-success-600 pl-4 italic text-gray-600 my-4">{children}</blockquote>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
          role="button"
          tabIndex={0}
          aria-label="Sluit vergroting"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setLightboxImage(null)
            }
          }}
        >
          <img
            className="max-h-[95vh] max-w-[95vw] rounded shadow-2xl"
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            onClick={() => setLightboxImage(null)}
          />
        </div>
      )}
    </div>
  )
}

export function BudgetScannerHelp() {
  const navigate = useNavigate()

  return (
    <div>
      <div className="sticky -top-4 md:-top-6 z-20 border-b bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-[10%]">
          <Button
            variant="text"
            color="success"
            startIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate('/')}
          >
            Terug naar het budgetscanner
          </Button>
          <Button
            variant="text"
            color="success"
            endIcon={<ArrowUp className="h-4 w-4" />}
            onClick={() => {
              const main = document.querySelector('main')
              if (main) main.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            Naar boven
          </Button>
        </div>
      </div>

      <BudgetScannerHelpContent containerClassName="py-8 px-[10%]" />

      <div className="px-[10%] pb-8">
        <Button
          variant="text"
          color="success"
          startIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/')}
        >
          Terug
        </Button>
      </div>
    </div>
  )
}
