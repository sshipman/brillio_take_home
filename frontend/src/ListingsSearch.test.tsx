import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { ListingCard } from './ListingCard'
import { ListingsPane } from './ListingsPane'
import { routeTree, type PagedResult, type ScoredListing } from './main'

// Stub ListingsMap in search page tests so jsdom doesn't execute Leaflet canvas/tile layout
vi.mock('./ListingsMap', () => ({
  ListingsMap: () => <div data-testid="listings-map-stub" />,
}))

const sampleListingA: ScoredListing = {
  id: 'A1',
  source: 'MLS_A',
  address: '123 Main St, Apt 4B',
  city: 'Springfield',
  state: 'VA',
  zip: '22150',
  price: 450000,
  bedrooms: 2,
  bathrooms: 1.5,
  sqft: 980,
  latitude: 38.7893,
  longitude: -77.1873,
  listedDate: '2026-08-29',
  status: 'active',
  description: 'Bright top-floor condo near shops.',
  relevanceScore: 88.45,
}

const sampleListingB: ScoredListing = {
  ...sampleListingA,
  id: 'B7',
  source: 'MLS_B',
  address: '456 Oak Ave',
  price: 525000,
}

describe('ListingCard & ListingsPane behavior', () => {
  it('applies the active border CSS variable only when isActive is true and invokes onSelect when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    const { container, rerender } = render(
      <ListingCard item={sampleListingA} isActive={false} onSelect={onSelect} />
    )
    const cardEl = container.firstElementChild as HTMLElement
    expect(cardEl.style.border).toBe('var(--border-subtle)')

    rerender(<ListingCard item={sampleListingA} isActive={true} onSelect={onSelect} />)
    expect(cardEl.style.border).toBe('var(--border-card-active)')

    await user.click(cardEl)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('highlights matching activeListingKeys and invokes selection and pagination callbacks in ListingsPane', async () => {
    const user = userEvent.setup()
    const onSelectListing = vi.fn()
    const onGoToPage = vi.fn()
    const registerCardRef = vi.fn()

    const pagedData: PagedResult<ScoredListing> = {
      items: [sampleListingA, sampleListingB],
      page: 2,
      pageSize: 2,
      totalItems: 6,
      totalPages: 3,
    }

    render(
      <ListingsPane
        data={pagedData}
        activeListingKeys={['MLS_B-B7']}
        onSelectListing={onSelectListing}
        onGoToPage={onGoToPage}
        registerCardRef={registerCardRef}
      />
    )

    const cardA = screen.getByText('123 Main St, Apt 4B').closest('[style*="border"]') as HTMLElement
    const cardB = screen.getByText('456 Oak Ave').closest('[style*="border"]') as HTMLElement

    expect(cardA.style.border).toBe('var(--border-subtle)')
    expect(cardB.style.border).toBe('var(--border-card-active)')

    await user.click(cardA)
    expect(onSelectListing).toHaveBeenCalledWith('MLS_A-A1')

    await user.click(screen.getByRole('button', { name: /previous page/i }))
    expect(onGoToPage).toHaveBeenCalledWith(1)

    await user.click(screen.getByRole('button', { name: /next page/i }))
    expect(onGoToPage).toHaveBeenCalledWith(3)
  })

  it('disables Previous Page on page 1 and Next Page on the final page', () => {
    const singlePageData: PagedResult<ScoredListing> = {
      items: [sampleListingA],
      page: 1,
      pageSize: 5,
      totalItems: 1,
      totalPages: 1,
    }

    render(
      <ListingsPane
        data={singlePageData}
        activeListingKeys={[]}
        onSelectListing={vi.fn()}
        onGoToPage={vi.fn()}
        registerCardRef={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled()
  })
})

describe('ListingSearchPage integration states', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function renderWithRouter(initialUrl = '/') {
    const history = createMemoryHistory({ initialEntries: [initialUrl] })
    const testRouter = createRouter({ routeTree, history })
    return render(<RouterProvider router={testRouter} />)
  }

  it('shows loading status while the listings request is in flight', async () => {
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {}))

    renderWithRouter('/')

    expect(await screen.findByRole('status')).toHaveTextContent(/loading listings/i)
  })

  it('renders the empty-results state when the API returns zero matching items', async () => {
    const emptyResponse: PagedResult<ScoredListing> = {
      items: [],
      page: 1,
      pageSize: 5,
      totalItems: 0,
      totalPages: 0,
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => emptyResponse,
    } as Response)

    renderWithRouter('/?city=Atlantis')

    await waitFor(() => {
      expect(screen.getByText(/no listings matched your search criteria/i)).toBeInTheDocument()
    })
  })

  it('displays the error alert, marks returned invalid fields with error border/aria-invalid, and clears field highlight on edit', async () => {
    const user = userEvent.setup()

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'minPrice cannot be greater than maxPrice.',
        fields: ['minPrice', 'maxPrice'],
      }),
    } as Response)

    renderWithRouter('/?minPrice=600000&maxPrice=400000')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('minPrice cannot be greater than maxPrice.')

    const minPriceInput = screen.getByLabelText(/min price/i) as HTMLInputElement
    const maxPriceInput = screen.getByLabelText(/max price/i) as HTMLInputElement
    const minBedroomsInput = screen.getByLabelText(/min bedrooms/i) as HTMLInputElement

    expect(minPriceInput).toHaveAttribute('aria-invalid', 'true')
    expect(minPriceInput.style.border).toBe('var(--border-input-invalid)')
    expect(maxPriceInput).toHaveAttribute('aria-invalid', 'true')
    expect(maxPriceInput.style.border).toBe('var(--border-input-invalid)')
    expect(minBedroomsInput).toHaveAttribute('aria-invalid', 'false')
    expect(minBedroomsInput.style.border).toBe('var(--border-control)')

    // Editing minPrice clears its error highlight while leaving maxPrice highlighted
    await user.type(minPriceInput, '0')
    expect(minPriceInput).toHaveAttribute('aria-invalid', 'false')
    expect(minPriceInput.style.border).toBe('var(--border-control)')
    expect(maxPriceInput).toHaveAttribute('aria-invalid', 'true')
  })
})
