import React from 'react'
import type { PagedResult, ScoredListing } from './main'
import { ListingCard } from './ListingCard'

interface ListingsPaneProps {
  data: PagedResult<ScoredListing>
  activeListingKeys: string[]
  onSelectListing: (listingKey: string) => void
  onGoToPage: (page: number) => void
  registerCardRef: (listingKey: string, el: HTMLDivElement | null) => void
}

export const ListingsPane: React.FC<ListingsPaneProps> = ({
  data,
  activeListingKeys,
  onSelectListing,
  onGoToPage,
  registerCardRef,
}) => {
  return (
    <div className="listings-pane">
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
        {data.items.map((item) => {
          const listingKey = `${item.source}-${item.id}`
          const isActive = activeListingKeys.includes(listingKey)
          return (
            <ListingCard
              key={listingKey}
              ref={(el) => registerCardRef(listingKey, el)}
              item={item}
              isActive={isActive}
              onSelect={() => onSelectListing(listingKey)}
            />
          )
        })}
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
          onClick={() => onGoToPage(data.page - 1)}
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
          onClick={() => onGoToPage(data.page + 1)}
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
  )
}
