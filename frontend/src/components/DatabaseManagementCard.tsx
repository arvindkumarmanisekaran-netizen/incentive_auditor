import { Fragment, useEffect, useMemo, useState, useRef } from "react";
import { motion } from "motion/react";

import { API_BASE_URL } from "../config";
import AppIcon from "./AppIcon";

import {
  getAssignments,
  getDatabaseRepresentatives,
  getDoctors,
  getPayouts,
  getPrescriptions,
  getProducts,
  getSales,
  getTerritories,
  type AssignmentRow,
  type DoctorRow,
  type IncentivePayoutRow,
  type PrescriptionRow,
  type ProductRow,
  type RepresentativeRow,
  type SaleRow,
  type TerritoryRow,
} from "../api/databaseManagement";

type Section =
  | "territories"
  | "representatives"
  | "products"
  | "doctors"
  | "assignments"
  | "prescriptions"
  | "sales"
  | "payouts";

type RowData =
  | TerritoryRow
  | RepresentativeRow
  | ProductRow
  | DoctorRow
  | AssignmentRow
  | PrescriptionRow
  | SaleRow
  | IncentivePayoutRow;

interface SectionConfig {
  id: Section;
  title: string;
  primaryKey: string;
  apiPath: string;
}

const PAGE_SIZE = 50;

const SECTIONS: SectionConfig[] = [
  {
    id: "representatives",
    title: "Representatives",
    primaryKey: "representative_id",
    apiPath: "/api/representatives",
  },
  {
    id: "doctors",
    title: "Doctors",
    primaryKey: "doctor_id",
    apiPath: "/api/doctors",
  },
  {
    id: "assignments",
    title: "Assignments",
    primaryKey: "assignment_id",
    apiPath: "/api/assignments",
  },
  {
    id: "territories",
    title: "Territories",
    primaryKey: "territory_id",
    apiPath: "/api/territories",
  },
  {
    id: "products",
    title: "Products",
    primaryKey: "product_id",
    apiPath: "/api/products",
  },
  {
    id: "prescriptions",
    title: "Prescriptions",
    primaryKey: "prescription_id",
    apiPath: "/api/prescriptions",
  },
  {
    id: "sales",
    title: "Sales",
    primaryKey: "sale_id",
    apiPath: "/api/sales",
  },
  {
    id: "payouts",
    title: "Incentive Payouts",
    primaryKey: "payout_id",
    apiPath: "/api/incentive-payouts",
  },
];

const STATUS_OPTIONS: Partial<Record<Section, string[]>> = {
  territories: ["Active", "Inactive"],
  representatives: ["Active", "Inactive"],
  products: ["Active", "Inactive"],
  doctors: ["Active", "Inactive"],
  assignments: ["Active", "Inactive", "Cancelled"],
  prescriptions: ["Valid", "Cancelled", "Reversed"],
  sales: ["Valid", "Cancelled", "Returned", "Adjusted"],
  payouts: ["Pending", "Paid", "Adjusted"],
};
function getCellValue(row: RowData, column: string): unknown {
  return (row as unknown as Record<string, unknown>)[column];
}

interface DatabaseManagementCardProps {
  refreshKey?: number;
}

export default function DatabaseManagementCard({ refreshKey = 0 }: DatabaseManagementCardProps) {
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  function handleTablePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    /*
     * Don't start dragging when clicking controls.
     */
    if (target.closest("button, input, select, textarea, a")) {
      return;
    }

    const container = tableScrollRef.current;

    if (!container) {
      return;
    }

    dragStateRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };

    container.setPointerCapture(event.pointerId);
  }

  function handleTablePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const container = tableScrollRef.current;
    const state = dragStateRef.current;

    if (!container || !state.dragging) {
      return;
    }

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    container.scrollLeft = state.scrollLeft - deltaX;

    container.scrollTop = state.scrollTop - deltaY;
  }

  function handleTablePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const container = tableScrollRef.current;

    dragStateRef.current.dragging = false;

    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
  }
  const [activeSection, setActiveSection] = useState<Section>("representatives");

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [editingRow, setEditingRow] = useState<RowData | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});

  const [offset, setOffset] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);

  const activeConfig = useMemo(
    () => SECTIONS.find((section) => section.id === activeSection)!,
    [activeSection],
  );

  // --------------------------------------------------
  // Load page whenever section / offset changes.
  // --------------------------------------------------

  useEffect(() => {
    void loadTable(activeSection, offset);
  }, [activeSection, offset, refreshKey]);

  // --------------------------------------------------
  // Safely switch table.
  //
  // Important:
  // Clear the old table rows BEFORE changing the
  // active section so React never tries to resolve
  // doctor_id on representative rows, etc.
  // --------------------------------------------------

  function changeSection(section: Section) {
    if (section === activeSection) {
      return;
    }

    setSelectedIds([]);

    setEditingRow(null);
    setEditValues({});
    setEditError(null);

    setError(null);

    setOffset(0);
    setActiveSection(section);
  }

  // --------------------------------------------------
  // Load table.
  // --------------------------------------------------

  async function loadTable(section: Section, currentOffset: number) {
    setLoading(true);
    setError(null);

    setSelectedIds([]);

    setEditingRow(null);
    setEditValues({});
    setEditError(null);

    try {
      let records: RowData[] = [];
      let total = 0;

      switch (section) {
        case "territories": {
          const response = await getTerritories(PAGE_SIZE, currentOffset);

          records = response.records;
          total = response.total;

          break;
        }

        case "representatives": {
          const response = await getDatabaseRepresentatives(PAGE_SIZE, currentOffset);

          records = response.records;
          total = response.total;

          break;
        }

        case "products": {
          const response = await getProducts(PAGE_SIZE, currentOffset);

          records = response.records;
          total = response.total;

          break;
        }

        case "doctors": {
          const response = await getDoctors(PAGE_SIZE, currentOffset);

          records = response.records;
          total = response.total;

          break;
        }

        case "assignments": {
          const response = await getAssignments(PAGE_SIZE, currentOffset);

          records = response.records;
          total = response.total;

          break;
        }

        case "prescriptions": {
          const response = await getPrescriptions(PAGE_SIZE, currentOffset);

          records = response.records;
          total = response.total;

          break;
        }

        case "sales": {
          const response = await getSales(PAGE_SIZE, currentOffset);

          records = response.records;
          total = response.total;

          break;
        }

        case "payouts": {
          const response = await getPayouts(PAGE_SIZE, currentOffset);

          records = response.records;
          total = response.total;

          break;
        }
      }

      setRows(records);
      setTotalRecords(total);
    } catch (err) {
      console.error("Load table failed:", err);

      setRows([]);
      setTotalRecords(0);

      setError(err instanceof Error ? err.message : "Unable to load database records");
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // Columns.
  //
  // Also remove accidental blank field names.
  // --------------------------------------------------

  const columns = useMemo(() => {
    if (rows.length === 0) {
      return [];
    }

    return Object.keys(rows[0]).filter(
      (column) => column.trim() !== "" && column !== "created_at" && column !== "updated_at",
    );
  }, [rows]);

  // --------------------------------------------------
  // Primary key.
  // --------------------------------------------------

  function getRowId(row: RowData): string | null {
    const value = getCellValue(row, activeConfig.primaryKey);

    if (value === null || value === undefined || value === "") {
      return null;
    }

    return String(value);
  }

  // --------------------------------------------------
  // Selection.
  // --------------------------------------------------

  function toggleRow(row: RowData) {
    const id = getRowId(row);

    if (!id) {
      console.warn("Database row missing primary key:", {
        section: activeSection,
        primaryKey: activeConfig.primaryKey,
        row,
      });

      return;
    }

    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleSelectAll() {
    const selectableIds = rows
      .map((row) => getRowId(row))
      .filter((id): id is string => id !== null);

    const allSelected =
      selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds([]);

      return;
    }

    setSelectedIds(selectableIds);
  }

  // --------------------------------------------------
  // Delete one.
  // --------------------------------------------------

  async function deleteSingle(row: RowData) {
    const id = getRowId(row);

    if (!id) {
      console.warn("Unable to delete row without primary key:", {
        section: activeSection,
        primaryKey: activeConfig.primaryKey,
        row,
      });

      return;
    }

    const confirmed = window.confirm(`Delete record ${id}?`);

    if (!confirmed) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}${activeConfig.apiPath}/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        throw new Error(getErrorMessage(errorData, "Failed to delete record"));
      }

      if (editingRow && getRowId(editingRow) === id) {
        cancelEdit();
      }

      if (rows.length === 1 && offset > 0) {
        setOffset((current) => Math.max(0, current - PAGE_SIZE));
      } else {
        await loadTable(activeSection, offset);
      }
    } catch (err) {
      console.error("Delete failed:", err);

      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // --------------------------------------------------
  // Delete selected.
  // --------------------------------------------------

  async function deleteSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedIds.length} selected record(s)?`);

    if (!confirmed) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`${API_BASE_URL}${activeConfig.apiPath}/bulk-delete`, {
        method: "DELETE",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          ids: selectedIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        throw new Error(getErrorMessage(errorData, "Failed to delete selected records"));
      }

      const deletedCount = selectedIds.length;

      setSelectedIds([]);

      if (deletedCount >= rows.length && offset > 0) {
        setOffset((current) => Math.max(0, current - PAGE_SIZE));
      } else {
        await loadTable(activeSection, offset);
      }
    } catch (err) {
      console.error("Bulk delete failed:", err);

      setError(err instanceof Error ? err.message : "Bulk delete failed");
    }
  }

  // --------------------------------------------------
  // Edit.
  // --------------------------------------------------

  function startEdit(row: RowData) {
    const id = getRowId(row);

    if (!id) {
      console.warn("Unable to edit row without primary key:", {
        section: activeSection,
        primaryKey: activeConfig.primaryKey,
        row,
      });

      return;
    }

    setEditingRow(row);
    setEditError(null);

    const copy: Record<string, unknown> = {};

    Object.entries(row as unknown as Record<string, unknown>).forEach(([key, value]) => {
      if (key !== "created_at" && key !== "updated_at" && key.trim() !== "") {
        copy[key] = value;
      }
    });

    setEditValues(copy);
  }

  function cancelEdit() {
    setEditingRow(null);
    setEditValues({});
    setEditError(null);
  }

  // --------------------------------------------------
  // Save edit.
  // --------------------------------------------------

  async function saveEdit() {
    if (!editingRow) {
      return;
    }

    const id = getRowId(editingRow);

    if (!id) {
      setEditError("Unable to determine record ID.");

      return;
    }

    try {
      setEditError(null);

      const payload: Record<string, unknown> = {
        ...editValues,
      };

      delete payload[activeConfig.primaryKey];

      const response = await fetch(
        `${API_BASE_URL}${activeConfig.apiPath}/${encodeURIComponent(id)}`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        throw new Error(getErrorMessage(errorData, "Failed to update record"));
      }

      cancelEdit();

      await loadTable(activeSection, offset);
    } catch (err) {
      console.error("Update failed:", err);

      setEditError(err instanceof Error ? err.message : "Update failed");
    }
  }

  // --------------------------------------------------
  // Pagination.
  // --------------------------------------------------

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const firstRecord = totalRecords === 0 ? 0 : offset + 1;

  const lastRecord = totalRecords === 0 ? 0 : Math.min(offset + rows.length, totalRecords);

  const selectableRowIds = rows
    .map((row) => getRowId(row))
    .filter((id): id is string => id !== null);

  const allVisibleRowsSelected =
    selectableRowIds.length > 0 && selectableRowIds.every((id) => selectedIds.includes(id));

  return (
    <article className="admin-card database-card">
      <div className="admin-card-icon"><AppIcon name="database" size={23} /></div>

      <div className="admin-card-content">
        <h3>Database Management</h3>

        <p className="database-management-subtitle">
          Review, edit and maintain the operational records used by investigations.
        </p>

        {/* -----------------------------------------
            TABLE SELECTOR
        ----------------------------------------- */}

        <div className="database-sections">
          {SECTIONS.map((section) => (
            <motion.button
              key={section.id}
              type="button"
              className={
                activeSection === section.id ? "database-section active" : "database-section"
              }
              onClick={() => changeSection(section.id)}
              whileTap={{ scale: 0.96 }}
            >
              {section.title}
            </motion.button>
          ))}
        </div>

        <div className="database-table-container">
          {/* ---------------------------------------
              TABLE HEADER
          --------------------------------------- */}

          <div className="database-table-header">
            <div>
              <h4>{activeConfig.title}</h4>

              <span>
                {loading ? "Loading..." : `${firstRecord}-${lastRecord} of ${totalRecords} records`}
              </span>
            </div>

            {selectedIds.length > 0 && (
              <button type="button" className="database-row-delete-button database-delete-selected" onClick={deleteSelected}>
                <AppIcon name="trash" size={14} />
                <span>Delete Selected ({selectedIds.length})</span>
              </button>
            )}
          </div>

          {/* ---------------------------------------
              ERROR
          --------------------------------------- */}

          {error && <div className="error-message">{error}</div>}

          {/* ---------------------------------------
              EMPTY
          --------------------------------------- */}

          {!loading && !error && rows.length === 0 && (
            <div className="database-empty">No records found.</div>
          )}

          {/* ---------------------------------------
              TABLE
          --------------------------------------- */}

          {!error && rows.length > 0 && (
            <div
              ref={tableScrollRef}
              className="database-table-scroll"
              onPointerDown={handleTablePointerDown}
              onPointerMove={handleTablePointerMove}
              onPointerUp={handleTablePointerUp}
              onPointerCancel={handleTablePointerUp}
            >
              <motion.table
                className="database-table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <thead>
                  <tr>
                    <th className="database-checkbox-column">
                      <input
                        type="checkbox"
                        checked={allVisibleRowsSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>

                    {columns.map((column, index) => (
                      <th key={`${column}-${index}`}>{formatColumnName(column)}</th>
                    ))}

                    <th className="database-actions-column">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, rowIndex) => {
                    const id = getRowId(row);
                    /*
                     * Primary key is preferred.
                     *
                     * The fallback makes the
                     * render safe even if malformed
                     * data reaches the frontend.
                     */
                    const rowKey =
                      id !== null
                        ? `${activeSection}-${id}`
                        : `${activeSection}-row-${offset + rowIndex}`;

                    const isEditing =
                      editingRow !== null && id !== null && getRowId(editingRow) === id;

                    return (
                      <Fragment key={rowKey}>
                        <motion.tr
                          initial={{ opacity: 0, y: 7 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(rowIndex * 0.018, 0.22) }}
                        >
                          {/* checkbox */}

                          <td className="database-checkbox-column">
                            <input
                              type="checkbox"
                              checked={id !== null && selectedIds.includes(id)}
                              disabled={id === null}
                              onChange={() => toggleRow(row)}
                            />
                          </td>

                          {/* cells */}

                          {columns.map((column, columnIndex) => (
                            <td key={`${rowKey}-${column}-${columnIndex}`}>
                              {formatValue(getCellValue(row, column))}
                            </td>
                          ))}

                          {/* actions */}

                          <td className="database-actions-column">
                            <div className="database-row-actions">
                              <button
                                type="button"
                                className="database-edit-button"
                                disabled={id === null}
                                onClick={() => startEdit(row)}
                              >
                                <AppIcon name="edit" size={14} />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                className="database-row-delete-button"
                                disabled={id === null}
                                onClick={() => void deleteSingle(row)}
                              >
                                <AppIcon name="trash" size={14} />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </motion.tr>

                        {/* ------------------------
                                INLINE EDIT FORM
                            ------------------------ */}

                        {isEditing && (
                          <tr className="database-inline-edit-row">
                            <td colSpan={columns.length + 2} className="database-inline-edit-cell">
                              <div className="database-edit-form inline">
                                <div className="database-edit-header">
                                  <h4>Edit Record</h4>

                                  <button
                                    type="button"
                                    className="database-edit-close"
                                    onClick={cancelEdit}
                                    aria-label="Close edit form"
                                  >
                                    ×
                                  </button>
                                </div>

                                <div className="database-edit-grid">
                                  {Object.entries(editValues).map(([column, value], index) => (
                                    <label
                                      key={`${column}-${index}`}
                                      className="database-edit-field"
                                    >
                                      <span>{formatColumnName(column)}</span>

                                      {column === "status" && STATUS_OPTIONS[activeSection] ? (
                                        <select
                                          value={value == null ? "" : String(value)}
                                          disabled={column === activeConfig.primaryKey}
                                          onChange={(event) =>
                                            setEditValues((current) => ({
                                              ...current,

                                              [column]: event.target.value,
                                            }))
                                          }
                                        >
                                          {STATUS_OPTIONS[activeSection]?.map((status) => (
                                            <option
                                              key={`${activeSection}-${status}`}
                                              value={status}
                                            >
                                              {status}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          type={getInputType(column)}
                                          step={getInputStep(column)}
                                          value={value == null ? "" : String(value)}
                                          disabled={column === activeConfig.primaryKey}
                                          onChange={(event) =>
                                            setEditValues((current) => ({
                                              ...current,

                                              [column]: event.target.value,
                                            }))
                                          }
                                        />
                                      )}
                                    </label>
                                  ))}
                                </div>

                                {editError && (
                                  <div className="database-edit-error">{editError}</div>
                                )}

                                <div className="database-edit-actions">
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </button>

                                  <button
                                    type="button"
                                    className="primary-button"
                                    onClick={() => void saveEdit()}
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </motion.table>
            </div>
          )}

          {/* ---------------------------------------
              PAGINATION
          --------------------------------------- */}

          {!error && totalRecords > 0 && (
            <div className="database-pagination">
              <button
                type="button"
                className="secondary-button"
                disabled={offset === 0}
                onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
              >
                Previous
              </button>

              <span>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                className="secondary-button"
                disabled={offset + PAGE_SIZE >= totalRecords}
                onClick={() => setOffset((current) => current + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function formatColumnName(column: string) {
  return column.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  return String(value);
}

function getInputType(column: string) {
  const dateColumns = new Set([
    "joining_date",
    "effective_from",
    "effective_to",
    "sale_date",
    "prescription_date",
    "payout_month",
  ]);

  const numberColumns = new Set([
    "quantity",
    "sales_amount",
    "sales_target",
    "actual_sales",
    "sales_achievement",
    "base_incentive",
    "achievement_multiplier",
    "calculated_payout",
    "maximum_payout",
    "expected_payout",
    "actual_payout",
    "payout_difference",
  ]);

  if (dateColumns.has(column)) {
    return "date";
  }

  if (numberColumns.has(column)) {
    return "number";
  }

  return "text";
}

function getInputStep(column: string) {
  if (column === "quantity") {
    return "1";
  }

  if (getInputType(column) === "number") {
    return "0.01";
  }

  return undefined;
}

function getErrorMessage(errorData: unknown, fallback: string) {
  if (!errorData || typeof errorData !== "object") {
    return fallback;
  }

  const data = errorData as {
    detail?:
      | string
      | {
          message?: string;
        };
  };

  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (typeof data.detail === "object" && data.detail?.message) {
    return data.detail.message;
  }

  return fallback;
}
