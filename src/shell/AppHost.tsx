import { Suspense, useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { findApp } from '../registry'
import { ErrorBoundary } from './ErrorBoundary'

const DEFAULT_TITLE = 'Everything App'
const DEFAULT_ICON = '/favicon.svg'

/** Emoji als SVG-Data-URL, damit jede App ohne eigene Bilddatei ein Favicon bekommt. */
function emojiFavicon(emoji: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/svg+xml'
  link.href = href
}

export function AppHost() {
  const { appId } = useParams()
  const app = findApp(appId)

  // Tab-Icon und -Titel folgen der aktiven App; beim Verlassen zurück auf die Shell-Werte
  useEffect(() => {
    if (!app) return
    setFavicon(emojiFavicon(app.icon))
    document.title = `${app.name} · ${DEFAULT_TITLE}`
    return () => {
      setFavicon(DEFAULT_ICON)
      document.title = DEFAULT_TITLE
    }
  }, [app])

  if (!app) return <Navigate to="/" replace />
  const Component = app.component
  return (
    <ErrorBoundary resetKey={app.id}>
      <Suspense fallback={<p style={{ padding: 24 }}>Lade {app.name}…</p>}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )
}
