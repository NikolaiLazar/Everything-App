import { lazy } from 'react'
import type { AppManifest } from '../../registry/types'

const manifest: AppManifest = {
  id: 'receipts',
  name: 'Kassenzettel',
  icon: '🧾',
  version: '1.0.0',
  order: 50,
  component: lazy(() => import('./App')),
}

export default manifest
