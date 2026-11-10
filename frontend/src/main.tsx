import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import './styles.css'
import { ListingsMap } from './ListingsMap'
import { ListingsPane } from './ListingsPane'

export interface ScoredListing {
  id: string
  source: string
  address: string
  city: string
  state: string
  zip: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  latitude: number
  longitude: number
  listedDate: string
  status: string
  description: string
  relevanceScore: number
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface ListingSearchParams {
  minPrice?: string
  maxPrice?: string
  minBedrooms?: string
  city?: string
  keyword?: string
  targetBudget?: string
  page: number
  pageSize: number
}

const rootRoute = createRootRoute({
  component: () => (
    <div style={{ fontFamily: 'var(--font-family-base)', maxWidth: 1360, margin: '0 auto', padding: 20, color: 'var(--color-text-primary)' }}>
      <header style={{ marginBottom: 16, borderBottom: 'var(--border-subtle)', paddingBottom: 10 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Property Listing Search</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
          Filter listings across MLS feeds and rank by budget and recency
        </p>
      </header>
      <Outlet />
    </div>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): ListingSearchParams => {
    const parsePositiveInt = (val: unknown, fallback: number): number => {
      if (typeof val === 'number' && Number.isInteger(val)) return val
      if (typeof val === 'string' && val.trim() !== '') {
        const parsed = Number.parseInt(val, 10)
        if (!Number.isNaN(parsed)) return parsed
      }
      return fallback
    }
    const cleanString = (val: unknown): string | undefined => {
      if (typeof val === 'string' && val.trim() !== '') return val.trim()
      if (typeof val === 'number') return String(val)
      return undefined
    }

    return {
      minPrice: cleanString(search.minPrice),
      maxPrice: cleanString(search.maxPrice),
      minBedrooms: cleanString(search.minBedrooms),
      city: cleanString(search.city),
      keyword: cleanString(search.keyword),
      targetBudget: cleanString(search.targetBudget),
      page: parsePositiveInt(search.page, 1),
      pageSize: parsePositiveInt(search.pageSize, 5),
    }
  },
  component: ListingSearchPage,
})

function ListingSearchPage() {
  const search = indexRoute.useSearch()
  const navigate = useNavigate({ from: indexRoute.fullPath })

  // Local controlled form state synced with URL search params
  const [minPrice, setMinPrice] = useState(search.minPrice ?? '')
  const [maxPrice, setMaxPrice] = useState(search.maxPrice ?? '')
  const [minBedrooms, setMinBedrooms] = useState(search.minBedrooms ?? '')
  const [city, setCity] = useState(search.city ?? '')
  const [keyword, setKeyword] = useState(search.keyword ?? '')
  const [targetBudget, setTargetBudget] = useState(search.targetBudget ?? '')
  const [pageSize, setPageSize] = useState(String(search.pageSize ?? 5))

  const [data, setData] = useState<PagedResult<ScoredListing> | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [errorFields, setErrorFields] = useState<string[]>([])
  const [activeListingKeys, setActiveListingKeys] = useState<string[]>([])
  const [selectedListingKey, setSelectedListingKey] = useState<string | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const handleSelectFromMap = (keys: string[], source: 'map' | 'card') => {
    setActiveListingKeys(keys)
    if (keys.length === 0) {
      setSelectedListingKey(null)
      return
    }
    // Only auto-scroll the listing card into view when the pin was clicked on the map
    // AND the viewport is wide enough (>= 860px) that the listings pane scrolls independently of the map.
    if (source === 'map' && window.matchMedia('(min-width: 860px)').matches) {
      const firstCard = cardRefs.current.get(keys[0])
      firstCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  const registerCardRef = (listingKey: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(listingKey, el)
    } else {
      cardRefs.current.delete(listingKey)
    }
  }

  const clearFieldError = (fieldName: string) => {
    setErrorFields((prev) => (prev.includes(fieldName) ? prev.filter((f) => f !== fieldName) : prev))
  }

  useEffect(() => {
    setMinPrice(search.minPrice ?? '')
    setMaxPrice(search.maxPrice ?? '')
    setMinBedrooms(search.minBedrooms ?? '')
    setCity(search.city ?? '')
    setKeyword(search.keyword ?? '')
    setTargetBudget(search.targetBudget ?? '')
    setPageSize(String(search.pageSize ?? 5))
  }, [
    search.minPrice,
    search.maxPrice,
    search.minBedrooms,
    search.city,
    search.keyword,
    search.targetBudget,
    search.pageSize,
  ])

  useEffect(() => {
    const controller = new AbortController()
    async function fetchListings() {
      setLoading(true)
      setError(null)
      setErrorFields([])
      setActiveListingKeys([])
      setSelectedListingKey(null)
      try {
        const params = new URLSearchParams()
        if (search.minPrice) params.set('minPrice', search.minPrice)
        if (search.maxPrice) params.set('maxPrice', search.maxPrice)
        if (search.minBedrooms) params.set('minBedrooms', search.minBedrooms)
        if (search.city) params.set('city', search.city)
        if (search.keyword) params.set('keyword', search.keyword)
        if (search.targetBudget) params.set('targetBudget', search.targetBudget)
        params.set('page', String(search.page))
        params.set('pageSize', String(search.pageSize))

        const response = await fetch(`/api/listings?${params.toString()}`, {
          signal: controller.signal,
        })

        const body = await response.json()
        if (!response.ok) {
          setError(body?.error || `Request failed with status ${response.status}`)
          setErrorFields(Array.isArray(body?.fields) ? body.fields : [])
          setData(null)
          return
        }
        setData(body as PagedResult<ScoredListing>)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Unable to connect to backend API.')
        setErrorFields([])
        setData(null)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchListings()
    return () => controller.abort()
  }, [
    search.minPrice,
    search.maxPrice,
    search.minBedrooms,
    search.city,
    search.keyword,
    search.targetBudget,
    search.page,
    search.pageSize,
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedPageSize = Number.parseInt(pageSize, 10)
    navigate({
      search: {
        minPrice: minPrice.trim() || undefined,
        maxPrice: maxPrice.trim() || undefined,
        minBedrooms: minBedrooms.trim() || undefined,
        city: city.trim() || undefined,
        keyword: keyword.trim() || undefined,
        targetBudget: targetBudget.trim() || undefined,
        page: 1,
        pageSize: Number.isNaN(parsedPageSize) ? 0 : parsedPageSize,
      },
    })
  }

  const handleReset = () => {
    navigate({
      search: {
        minPrice: undefined,
        maxPrice: undefined,
        minBedrooms: undefined,
        city: undefined,
        keyword: undefined,
        targetBudget: undefined,
        page: 1,
        pageSize: 5,
      },
    })
  }

  const goToPage = (nextPage: number) => {
    navigate({
      search: (prev) => ({
        ...prev,
        page: nextPage,
      }),
    })
  }

  const getInputStyle = (fieldName: string): React.CSSProperties => {
    const isInvalid = errorFields.includes(fieldName)
    return {
      padding: '6px 8px',
      border: isInvalid ? 'var(--border-input-invalid)' : 'var(--border-control)',
      backgroundColor: isInvalid ? 'var(--color-error-bg)' : 'var(--color-surface-card)',
      borderRadius: 'var(--radius-control)',
      fontSize: 14,
      width: '100%',
      boxSizing: 'border-box',
    }
  }

  const getLabelStyle = (fieldName: string): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 13,
    fontWeight: 600,
    color: errorFields.includes(fieldName) ? 'var(--color-error-label)' : 'var(--color-text-primary)',
  })

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-surface-subtle)',
          border: 'var(--border-subtle)',
          borderRadius: 'var(--radius-panel)',
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <label style={getLabelStyle('minPrice')}>
            Min Price ($)
            <input
              type="number"
              placeholder="e.g. 400000"
              value={minPrice}
              min={0}
              aria-invalid={errorFields.includes('minPrice')}
              onChange={(e) => {
                setMinPrice(e.target.value)
                clearFieldError('minPrice')
              }}
              style={getInputStyle('minPrice')}
            />
          </label>

          <label style={getLabelStyle('maxPrice')}>
            Max Price ($)
            <input
              type="number"
              placeholder="e.g. 550000"
              value={maxPrice}
              min={0}
              aria-invalid={errorFields.includes('maxPrice')}
              onChange={(e) => {
                setMaxPrice(e.target.value)
                clearFieldError('maxPrice')
              }}
              style={getInputStyle('maxPrice')}
            />
          </label>

          <label style={getLabelStyle('minBedrooms')}>
            Min Bedrooms
            <input
              type="number"
              placeholder="e.g. 3"
              value={minBedrooms}
              min={0}
              aria-invalid={errorFields.includes('minBedrooms')}
              onChange={(e) => {
                setMinBedrooms(e.target.value)
                clearFieldError('minBedrooms')
              }}
              style={getInputStyle('minBedrooms')}
            />
          </label>

          <label style={getLabelStyle('city')}>
            City
            <input
              type="text"
              placeholder="e.g. Springfield"
              value={city}
              aria-invalid={errorFields.includes('city')}
              onChange={(e) => {
                setCity(e.target.value)
                clearFieldError('city')
              }}
              style={getInputStyle('city')}
            />
          </label>

          <label style={getLabelStyle('keyword')}>
            Description Keyword
            <input
              type="text"
              placeholder="e.g. school"
              value={keyword}
              aria-invalid={errorFields.includes('keyword')}
              onChange={(e) => {
                setKeyword(e.target.value)
                clearFieldError('keyword')
              }}
              style={getInputStyle('keyword')}
            />
          </label>

          <label style={getLabelStyle('targetBudget')}>
            Target Budget
            <input
              type="number"
              placeholder="e.g. 475000"
              value={targetBudget}
              min={1}
              aria-invalid={errorFields.includes('targetBudget')}
              onChange={(e) => {
                setTargetBudget(e.target.value)
                clearFieldError('targetBudget')
              }}
              style={getInputStyle('targetBudget')}
            />
          </label>

          <label style={getLabelStyle('pageSize')}>
            Page Size
            <input
              type="number"
              value={pageSize}
              min={1}
              aria-invalid={errorFields.includes('pageSize')}
              onChange={(e) => {
                setPageSize(e.target.value)
                clearFieldError('pageSize')
              }}
              style={getInputStyle('pageSize')}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              background: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              border: 'none',
              borderRadius: 'var(--radius-control)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Search Listings
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '8px 16px',
              background: 'var(--color-surface-card)',
              color: 'var(--color-text-secondary)',
              border: 'var(--border-control)',
              borderRadius: 'var(--radius-control)',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {loading && (
        <div role="status" style={{ padding: 16, color: 'var(--color-text-muted)' }}>
          Loading listings...
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          style={{
            padding: 14,
            background: 'var(--color-error-bg)',
            border: 'var(--border-alert-error)',
            color: 'var(--color-error-text)',
            borderRadius: 'var(--radius-panel)',
            marginBottom: 16,
          }}
        >
          <strong>Invalid Search / Error: </strong>
          {error}
        </div>
      )}

      {!loading && !error && data && data.items.length === 0 && (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            background: 'var(--color-surface-subtle)',
            border: 'var(--border-subtle)',
            borderRadius: 'var(--radius-panel)',
            color: 'var(--color-text-muted)',
          }}
        >
          No listings matched your search criteria
          {search.city ? ` in "${search.city}"` : ''}. Try broadening your filters.
        </div>
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <div className="results-split-layout">
          <div className="map-pane" aria-label="Property locations map">
            <ListingsMap
              listings={data.items}
              selectedListingKey={selectedListingKey}
              onSelectListings={handleSelectFromMap}
            />
          </div>

          <ListingsPane
            data={data}
            activeListingKeys={activeListingKeys}
            onSelectListing={setSelectedListingKey}
            onGoToPage={goToPage}
            registerCardRef={registerCardRef}
          />
        </div>
      )}
    </div>
  )
}

export const routeTree = rootRoute.addChildren([indexRoute])
export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  )
}
