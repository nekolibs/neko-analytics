import React from 'react'

import { reportError } from '../core/errors'

export class NekoAnalyticsBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    try {
      reportError(error, {
        type: 'react',
        handled: true,
        data: { componentStack: info?.componentStack || null },
      })
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      const fallback = this.props.fallback
      if (typeof fallback === 'function') return fallback()
      if (fallback !== undefined) return fallback
      return null
    }
    return this.props.children
  }
}
