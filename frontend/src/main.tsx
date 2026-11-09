import React, { useEffect, useState } from 'react'
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
    <div style={{ fontFamily: 'var(--font-family-base)', maxWidth: 1024, margin: '0 auto', padding: 24, color: 'var(--color-text-primary)' }}>
      <header style={{ marginBottom: 20, borderBottom: 'var(--border-subtle)', paddingBottom: 12 }}>
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
              placeholder="e.g. metro, fenced"
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
            Target Budget ($ - Ranking)
            <input
              type="number"
              placeholder="e.g. 475000"
              value={targetBudget}
              min={0}
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
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              fontSize: 14,
              color: 'var(--color-text-muted)',
            }}
          >
            <span>
              Showing <strong>{data.items.length}</strong> of <strong>{data.totalItems}</strong> matching listings
              (Page <strong>{data.page}</strong> of <strong>{data.totalPages}</strong>)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.items.map((item) => (
              <div
                key={`${item.source}-${item.id}`}
                style={{
                  border: 'var(--border-subtle)',
                  borderRadius: 'var(--radius-panel)',
                  padding: 14,
                  background: 'var(--color-surface-card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <div>
                    <strong style={{ fontSize: 17 }}>{item.address}</strong>
                    <span style={{ marginLeft: 8, color: 'var(--color-text-muted)', fontSize: 14 }}>
                      {item.city}, {item.state} {item.zip}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-strong)' }}>
                      ${item.price.toLocaleString()}
                    </span>
                    <span
                      style={{
                        background: 'var(--color-badge-bg)',
                        color: 'var(--color-badge-text)',
                        border: 'var(--border-badge)',
                        borderRadius: 'var(--radius-control)',
                        padding: '2px 8px',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Score: {item.relevanceScore.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>
                    <strong>Bedrooms:</strong> {item.bedrooms}
                  </span>
                  <span>
                    <strong>Bathrooms:</strong> {item.bathrooms}
                  </span>
                  <span>
                    <strong>Sqft:</strong> {item.sqft.toLocaleString()}
                  </span>
                  <span>
                    <strong>Listed:</strong> {item.listedDate}
                  </span>
                  <span>
                    <strong>Status:</strong> {item.status}
                  </span>
                  <span>
                    <strong>Source:</strong> {item.source} ({item.id})
                  </span>
                </div>

                <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>{item.description}</p>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              paddingTop: 12,
              borderTop: 'var(--border-subtle)',
            }}
          >
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => goToPage(data.page - 1)}
              style={{
                padding: '6px 14px',
                border: 'var(--border-control)',
                borderRadius: 'var(--radius-control)',
                background: data.page <= 1 ? 'var(--color-surface-disabled)' : 'var(--color-surface-card)',
                color: data.page <= 1 ? 'var(--color-text-disabled)' : 'var(--color-text-strong)',
                cursor: data.page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous Page
            </button>

            <span style={{ fontSize: 14 }}>
              Page <strong>{data.page}</strong> of <strong>{data.totalPages}</strong>
            </span>

            <button
              type="button"
              disabled={data.page >= data.totalPages}
              onClick={() => goToPage(data.page + 1)}
              style={{
                padding: '6px 14px',
                border: 'var(--border-control)',
                borderRadius: 'var(--radius-control)',
                background: data.page >= data.totalPages ? 'var(--color-surface-disabled)' : 'var(--color-surface-card)',
                color: data.page >= data.totalPages ? 'var(--color-text-disabled)' : 'var(--color-text-strong)',
                cursor: data.page >= data.totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next Page
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const routeTree = rootRoute.addChildren([indexRoute])
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
