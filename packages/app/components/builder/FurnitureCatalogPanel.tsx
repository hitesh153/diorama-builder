"use client";

import { useState } from "react";
import { getCatalogByCategory, type CatalogItem, type FurnitureCategory } from "@diorama/engine";

const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  seating: "Seating",
  surfaces: "Surfaces",
  tech: "Tech",
  decor: "Decor",
};

const _CATEGORY_ICONS: Record<FurnitureCategory, string> = {
  seating: "S",
  surfaces: "T",
  tech: "M",
  decor: "D",
};

interface FurnitureCatalogPanelProps {
  selectedRoomLabel: string;
  placingItemId: string | null;
  onSelectItem: (item: CatalogItem) => void;
  onCancelPlacement: () => void;
  /** Furniture already in the room, for the item list */
  existingFurniture: Array<{ geometry: string; size: [number, number, number]; label?: string }>;
  onRemoveFurniture: (index: number) => void;
}

/**
 * Sidebar panel showing the 20-item furniture catalog grouped by category.
 * Click an item to enter placement mode (click inside room to place).
 */
export function FurnitureCatalogPanel({
  selectedRoomLabel,
  placingItemId,
  onSelectItem,
  onCancelPlacement,
  existingFurniture,
  onRemoveFurniture,
}: FurnitureCatalogPanelProps) {
  const catalog = getCatalogByCategory();
  const [expandedCategories, setExpandedCategories] = useState<Set<FurnitureCategory>>(
    new Set(["seating", "surfaces", "tech", "decor"]),
  );

  const toggleCategory = (cat: FurnitureCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div>
      <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "#999" }}>
        Furniture for {selectedRoomLabel}
      </h4>

      {placingItemId && (
        <div style={{
          padding: "8px 10px",
          marginBottom: 10,
          background: "#1a3520",
          border: "1px solid #2a5535",
          borderRadius: 6,
          fontSize: 12,
          color: "#48bb78",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>Click inside the room to place</span>
          <button
            onClick={onCancelPlacement}
            style={{
              background: "transparent",
              border: "none",
              color: "#ff6b6b",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Existing furniture in the room */}
      {existingFurniture.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h5 style={{ margin: "0 0 6px", fontSize: 11, color: "#666" }}>
            In this room ({existingFurniture.length})
          </h5>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {existingFurniture.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 8px",
                  background: "#111d2e",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "#999",
                }}
              >
                <span>{f.label ?? f.geometry} ({f.size[0].toFixed(1)}x{f.size[2].toFixed(1)})</span>
                <button
                  onClick={() => onRemoveFurniture(i)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ff6b6b",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: "2px 6px",
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog by category */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(Object.keys(catalog) as FurnitureCategory[]).map((cat) => (
          <div key={cat}>
            <button
              onClick={() => toggleCategory(cat)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                background: "#111d2e",
                border: "none",
                borderRadius: 4,
                color: "#8090c0",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 9, color: "#666" }}>
                {expandedCategories.has(cat) ? "▼" : "▶"}
              </span>
              {CATEGORY_LABELS[cat]} ({catalog[cat].length})
            </button>

            {expandedCategories.has(cat) && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 4,
                padding: "4px 0",
              }}>
                {catalog[cat].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 8px",
                      background: placingItemId === item.id ? "#1a3520" : "#1a2535",
                      border: placingItemId === item.id ? "1px solid #48bb78" : "1px solid #2a3545",
                      borderRadius: 6,
                      color: "#e0e0e0",
                      fontSize: 11,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      background: item.defaultMaterial.color,
                      border: "1px solid #333",
                      flexShrink: 0,
                    }} />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
