import { lazy } from 'react'
import type { AppManifest } from '../../registry/types'

const manifest: AppManifest = {
  id: 'clock',
  name: 'Uhr',
  icon: '⏰',
  version: '1.0.0',
  order: 22,
  component: lazy(() => import('./App')),
}

export default manifest
