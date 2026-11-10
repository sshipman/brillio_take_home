import { forwardRef } from 'react'
import type { ScoredListing } from './main'

interface ListingCardProps {
  item: ScoredListing
  isActive: boolean
  onSelect: () => void
}

export const ListingCard = forwardRef<HTMLDivElement, ListingCardProps>(
  ({ item, isActive, onSelect }, ref) => {
    return (
      <div
        ref={ref}
        onClick={onSelect}
        style={{
          border: isActive ? 'var(--border-card-active)' : 'var(--border-subtle)',
          borderRadius: 'var(--radius-panel)',
          padding: 14,
          background: 'var(--color-surface-card)',
          cursor: 'pointer',
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

        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
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
            <strong>Source:</strong> {item.source}
          </span>
        </div>

        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
          {item.description}
        </p>
      </div>
    )
  }
)

ListingCard.displayName = 'ListingCard'
