import { API_BASE_URL } from "../config";

import { Fragment, useEffect, useMemo, useState } from "react";

import {
  getDatabaseRepresentatives,
  getDoctors,
  getProducts,
  getTerritories,
  getAssignments,
  getPayouts,
  getSales,
  getPrescriptions,
  type RepresentativeRow,
  type DoctorRow,
  type ProductRow,
  type TerritoryRow,
  type AssignmentRow,
  type SaleRow,
  type PrescriptionRow,
  type IncentivePayoutRow,
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
    id: "territories",
    title: "Territories",
    primaryKey: "territory_id",
    apiPath: "/api/territories",
  },
  {
    id: "representatives",
    title: "Representatives",
    primaryKey: "representative_id",
    apiPath: "/api/representatives",
  },
  {
    id: "products",
    title: "Products",
    primaryKey: "product_id",
    apiPath: "/api/products",
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

export default function DatabaseManagementCard() {
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

  // ---------------------------------------------
  // Reset pagination ONLY when table changes.
  // ---------------------------------------------

  useEffect(() => {
    setOffset(0);
  }, [activeSection]);

  // ---------------------------------------------
  // Load current page.
  // ---------------------------------------------

  useEffect(() => {
    void loadTable(activeSection, offset);
  }, [activeSection, offset]);

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

      console.log("Database page loaded:", {
        section,
        offset: currentOffset,
        records: records.length,
        total,
      });

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

  const columns =
    rows.length > 0
      ? Object.keys(rows[0]).filter((column) => column !== "created_at" && column !== "updated_at")
      : [];

  function getRowId(row: RowData) {
    return String(getCellValue(row, activeConfig.primaryKey) ?? "");
  }

  function toggleRow(row: RowData) {
    const id = getRowId(row);

    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleSelectAll() {
    if (rows.length > 0 && selectedIds.length === rows.length) {
      setSelectedIds([]);

      return;
    }

    setSelectedIds(rows.map((row) => getRowId(row)).filter((id) => id !== ""));
  }

  async function deleteSingle(row: RowData) {
    const id = getRowId(row);

    if (!id) {
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

      // If last record on page was deleted,
      // move to previous page.
      if (rows.length === 1 && offset > 0) {
        setOffset(Math.max(0, offset - PAGE_SIZE));
      } else {
        await loadTable(activeSection, offset);
      }
    } catch (err) {
      console.error("Delete failed:", err);

      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

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

      // Entire current page deleted:
      // move to previous page.
      if (deletedCount >= rows.length && offset > 0) {
        setOffset(Math.max(0, offset - PAGE_SIZE));
      } else {
        await loadTable(activeSection, offset);
      }
    } catch (err) {
      console.error("Bulk delete failed:", err);

      setError(err instanceof Error ? err.message : "Bulk delete failed");
    }
  }

  function startEdit(row: RowData) {
    setEditingRow(row);

    setEditError(null);

    const copy: Record<string, unknown> = {};

    Object.entries(row as unknown as Record<string, unknown>).forEach(([key, value]) => {
      if (key !== "created_at" && key !== "updated_at") {
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

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const firstRecord = totalRecords === 0 ? 0 : offset + 1;

  const lastRecord = totalRecords === 0 ? 0 : Math.min(offset + rows.length, totalRecords);

  return (
    <article className="admin-card database-card">
      <div className="admin-card-icon">🗄️</div>

      <div className="admin-card-content">
        <h3>Database Management</h3>

        <div className="database-sections">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={
                activeSection === section.id ? "database-section active" : "database-section"
              }
              onClick={() => setActiveSection(section.id)}
            >
              {section.title}
            </button>
          ))}
        </div>

        <div className="database-table-container">
          <div className="database-table-header">
            <div>
              <h4>{activeConfig.title}</h4>

              <span>
                {loading ? "Loading..." : `${firstRecord}-${lastRecord} of ${totalRecords} records`}
              </span>
            </div>

            {selectedIds.length > 0 && (
              <button type="button" className="database-delete-button" onClick={deleteSelected}>
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          {!loading && !error && rows.length === 0 && (
            <div className="database-empty">No records found.</div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="database-table-scroll">
              <table className="database-table">
                <thead>
                  <tr>
                    <th className="database-checkbox-column">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && selectedIds.length === rows.length}
                        onChange={toggleSelectAll}
                      />
                    </th>

                    {columns.map((column) => (
                      <th key={column}>{formatColumnName(column)}</th>
                    ))}

                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => {
                    const id = getRowId(row);

                    const isEditing = editingRow !== null && getRowId(editingRow) === id;

                    return (
                      <Fragment key={id}>
                        <tr>
                          <td className="database-checkbox-column">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(id)}
                              onChange={() => toggleRow(row)}
                            />
                          </td>

                          {columns.map((column) => (
                            <td key={column}>{formatValue(getCellValue(row, column))}</td>
                          ))}

                          <td>
                            <div className="database-row-actions">
                              <button
                                type="button"
                                className="database-edit-button"
                                onClick={() => startEdit(row)}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="database-row-delete-button"
                                onClick={() => deleteSingle(row)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>

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
                                  >
                                    ×
                                  </button>
                                </div>

                                <div className="database-edit-grid">
                                  {Object.entries(editValues).map(([column, value]) => (
                                    <label key={column} className="database-edit-field">
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
                                            <option key={status} value={status}>
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
                                    onClick={saveEdit}
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
              </table>
            </div>
          )}

          {/* PAGINATION */}

          {!loading && !error && totalRecords > 0 && (
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
