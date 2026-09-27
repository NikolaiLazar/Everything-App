import { lazy } from 'react'
import type { AppManifest } from '../../registry/types'

const manifest: AppManifest = {
  id: 'todo',
  name: 'Quests',
  icon: '🏆',
  version: '1.1.0',
  order: 30,
  component: lazy(() => import('./App')),
}

export default manifest
