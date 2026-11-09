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
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 1024, margin: '0 auto', padding: 24, color: '#1f2937' }}>
      <header style={{ marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Property Listing Search</h1>
        <p style={{ margin: '4px 0 0', color: '#4b5563', fontSize: 14 }}>
          Filter listings across MLS feeds and rank by budget proximity and recency
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
          setData(null)
          return
        }
        setData(body as PagedResult<ScoredListing>)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Unable to connect to backend API.')
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

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 13,
    fontWeight: 600,
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
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
          <label style={labelStyle}>
            Min Price ($)
            <input
              type="number"
              placeholder="e.g. 400000"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Max Price ($)
            <input
              type="number"
              placeholder="e.g. 550000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Min Bedrooms
            <input
              type="number"
              placeholder="e.g. 3"
              value={minBedrooms}
              onChange={(e) => setMinBedrooms(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            City
            <input
              type="text"
              placeholder="e.g. Springfield"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Description Keyword
            <input
              type="text"
              placeholder="e.g. metro, fenced"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Target Budget ($ - Ranking)
            <input
              type="number"
              placeholder="e.g. 475000"
              value={targetBudget}
              onChange={(e) => setTargetBudget(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Page Size
            <input
              type="number"
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
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
              background: '#ffffff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {loading && (
        <div role="status" style={{ padding: 16, color: '#4b5563' }}>
          Loading listings...
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          style={{
            padding: 14,
            background: '#fef2f2',
            border: '1px solid #f87171',
            color: '#991b1b',
            borderRadius: 6,
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
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            color: '#4b5563',
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
              color: '#4b5563',
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
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: 14,
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <div>
                    <strong style={{ fontSize: 17 }}>{item.address}</strong>
                    <span style={{ marginLeft: 8, color: '#4b5563', fontSize: 14 }}>
                      {item.city}, {item.state} {item.zip}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
                      ${item.price.toLocaleString()}
                    </span>
                    <span
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Score: {item.relevanceScore.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 8, fontSize: 13, color: '#374151', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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

                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#4b5563' }}>{item.description}</p>
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
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => goToPage(data.page - 1)}
              style={{
                padding: '6px 14px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: data.page <= 1 ? '#f3f4f6' : '#ffffff',
                color: data.page <= 1 ? '#9ca3af' : '#111827',
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
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: data.page >= data.totalPages ? '#f3f4f6' : '#ffffff',
                color: data.page >= data.totalPages ? '#9ca3af' : '#111827',
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
