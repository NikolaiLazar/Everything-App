import { lazy } from 'react'
import type { AppManifest } from '../../registry/types'

const manifest: AppManifest = {
  id: 'asteroids',
  name: 'Asteroiden Ballern',
  icon: '👾',
  version: '1.0.0',
  order: 55,
  component: lazy(() => import('./App')),
}

export default manifest
