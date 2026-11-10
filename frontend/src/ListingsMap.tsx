import React, { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ScoredListing } from './main'

interface CoordinateGroup {
  key: string
  latitude: number
  longitude: number
  listings: ScoredListing[]
}

interface ListingsMapProps {
  listings: ScoredListing[]
  selectedListingKey?: string | null
  onSelectListings?: (keys: string[], source: 'map' | 'card') => void
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatCompactPrice(price: number): string {
  if (price >= 1_000_000) {
    return `$${(price / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  }
  return `$${Math.round(price / 1000)}k`
}

export const ListingsMap: React.FC<ListingsMapProps> = ({
  listings,
  selectedListingKey,
  onSelectListings,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const markerByListingKeyRef = useRef<Map<string, L.Marker>>(new Map())
  const openedFromCardRef = useRef<boolean>(false)
  const onSelectRef = useRef(onSelectListings)
  onSelectRef.current = onSelectListings

  // Group listings sharing the same coordinates into a single pin
  const groups = useMemo<CoordinateGroup[]>(() => {
    const byCoord = new Map<string, CoordinateGroup>()
    for (const item of listings) {
      const key = `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`
      const existing = byCoord.get(key)
      if (existing) {
        existing.listings.push(item)
      } else {
        byCoord.set(key, {
          key,
          latitude: item.latitude,
          longitude: item.longitude,
          listings: [item],
        })
      }
    }
    return Array.from(byCoord.values())
  }, [listings])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [38.85, -77.3],
      zoom: 10,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    const markersLayer = L.layerGroup().addTo(map)
    mapRef.current = map
    markersLayerRef.current = markersLayer

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
      markersLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const markersLayer = markersLayerRef.current
    if (!map || !markersLayer) return

    markersLayer.clearLayers()
    markerByListingKeyRef.current.clear()

    if (groups.length === 0) return

    const bounds = L.latLngBounds([])

    for (const group of groups) {
      const { latitude, longitude, listings: groupItems } = group
      bounds.extend([latitude, longitude])

      const isMulti = groupItems.length > 1
      const prices = groupItems.map((i) => i.price)
      const minPrice = Math.min(...prices)
      const label = isMulti
        ? `${formatCompactPrice(minPrice)} (${groupItems.length} sources)`
        : formatCompactPrice(minPrice)

      const icon = L.divIcon({
        className: '',
        html: `<div class="listing-map-pin ${isMulti ? 'listing-map-pin--multi' : ''}">${escapeHtml(label)}</div>`,
      })

      const popupRows = groupItems
        .map(
          (item) => `
          <div style="padding: 6px 0; border-top: 1px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; gap: 10px; font-weight: 600;">
              ${escapeHtml(item.address)}
              <span>$${item.price.toLocaleString()}</span>
            </div>
            <div style="font-size: 12px; color: #374151; margin-top: 2px;">
              ${item.bedrooms} bd · ${item.bathrooms} ba · ${item.sqft.toLocaleString()} sqft · Listed ${escapeHtml(item.listedDate)}
            </div>
            <div style="font-size: 12px; color: #1d4ed8; font-weight: 600; margin-top: 2px;">
              Score: ${item.relevanceScore.toFixed(2)} (${escapeHtml(item.status)})
            </div>
            <div style="font-size: 12px; color: #4b5563; margin-top: 2px;">
              <span>${escapeHtml(item.source)}</span>
            </div>
          </div>
        `
        )
        .join('')

      const primary = groupItems[0]
      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 220px;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">
            ${escapeHtml(primary.city)}, ${escapeHtml(primary.state)} ${escapeHtml(primary.zip)}
            ${isMulti ? `<span style="font-size: 11px; font-weight: 600; color: #4b5563;">(${groupItems.length} MLS feeds)</span>` : ''}
          </div>
          ${popupRows}
        </div>
      `

      const groupKeys = groupItems.map((item) => `${item.source}-${item.id}`)
      const marker = L.marker([latitude, longitude], { icon }).bindPopup(popupHtml)

      marker.on('popupopen', () => {
        const source = openedFromCardRef.current ? 'card' : 'map'
        openedFromCardRef.current = false
        onSelectRef.current?.(groupKeys, source)
      })
      marker.on('popupclose', () => {
        onSelectRef.current?.([], 'map')
      })

      marker.addTo(markersLayer)
      for (const listingKey of groupKeys) {
        markerByListingKeyRef.current.set(listingKey, marker)
      }
    }

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }, [groups])

  useEffect(() => {
    if (!selectedListingKey) return
    const marker = markerByListingKeyRef.current.get(selectedListingKey)
    if (marker && !marker.isPopupOpen()) {
      openedFromCardRef.current = true
      marker.openPopup()
    }
  }, [selectedListingKey])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
