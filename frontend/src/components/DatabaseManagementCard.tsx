import {
  getDatabaseRepresentatives,
  getDoctors,
  getProducts,
  getTerritories,
  getAssignments,
  getPrograms,
  getPayouts,
  getSales,
  getPrescriptions,
  getSalesTargets,
  getIncentiveTiers,
  getProductIncentiveRates,
  type RepresentativeRow,
  type DoctorRow,
  type ProductRow,
  type TerritoryRow,
  type AssignmentRow,
  type ProgramRow,
  type PayoutRow,
  type SaleRow,
  type PrescriptionRow,
  type SalesTargetRow,
  type IncentiveTierRow,
  type ProductIncentiveRateRow,
} from "../api/databaseManagement";

import { Fragment, useEffect, useMemo, useState } from "react";

type Section =
  | "territories"
  | "representatives"
  | "products"
  | "doctors"
  | "assignments"
  | "prescriptions"
  | "sales"
  | "salesTargets"
  | "programs"
  | "tiers"
  | "productRates"
  | "payouts";

type RowData =
  | RepresentativeRow
  | DoctorRow
  | ProductRow
  | TerritoryRow
  | AssignmentRow
  | ProgramRow
  | PayoutRow
  | SaleRow
  | PrescriptionRow
  | SalesTargetRow
  | IncentiveTierRow
  | ProductIncentiveRateRow;

interface SectionConfig {
  id: Section;
  title: string;
  primaryKey: string;
  apiPath: string;
}

const API_BASE_URL = "http://localhost:8000";
const sections: SectionConfig[] = [
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
    title: "Doctor Assignments",
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
    id: "salesTargets",
    title: "Sales Targets",
    primaryKey: "target_id",
    apiPath: "/api/sales-targets",
  },
  {
    id: "programs",
    title: "Incentive Programs",
    primaryKey: "program_id",
    apiPath: "/api/incentive-programs",
  },
  {
    id: "tiers",
    title: "Incentive Tiers",
    primaryKey: "tier_id",
    apiPath: "/api/incentive-tiers",
  },
  {
    id: "productRates",
    title: "Product Incentive Rates",
    primaryKey: "rate_id",
    apiPath: "/api/product-incentive-rates",
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

  doctors: ["Active", "Inactive"],

  products: ["Active", "Inactive"],

  assignments: ["Active", "Inactive", "Cancelled"],

  sales: ["Valid", "Cancelled", "Returned", "Adjusted"],

  prescriptions: ["Valid", "Cancelled", "Reversed"],

  salesTargets: ["Active", "Inactive"],

  programs: ["Active", "Inactive"],

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

  const activeConfig = useMemo(
    () => sections.find((section) => section.id === activeSection)!,
    [activeSection],
  );

  useEffect(() => {
    loadTable(activeSection);
  }, [activeSection]);

  async function loadTable(section: Section) {
    setLoading(true);
    setError(null);
    setSelectedIds([]);
    setEditingRow(null);

    try {
      let data: RowData[] = [];

      switch (section) {
        case "territories":
          data = await getTerritories();
          break;

        case "representatives":
          data = await getDatabaseRepresentatives();
          break;

        case "products":
          data = await getProducts();
          break;

        case "doctors":
          data = await getDoctors();
          break;

        case "assignments":
          data = await getAssignments();
          break;

        case "prescriptions":
          data = await getPrescriptions();
          break;

        case "sales":
          data = await getSales();
          break;

        case "programs":
          data = await getPrograms();
          break;

        case "salesTargets":
          data = await getSalesTargets();
          break;

        case "tiers":
          data = await getIncentiveTiers();
          break;

        case "productRates":
          data = await getProductIncentiveRates();
          break;

        case "payouts":
          data = await getPayouts();
          break;
      }

      setRows(data);
    } catch (err) {
      console.error(err);

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
    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(rows.map((row) => getRowId(row)));
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

        throw new Error(errorData?.detail ?? "Failed to delete record");
      }

      setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));

      if (editingRow && getRowId(editingRow) === id) {
        cancelEdit();
      }

      await loadTable(activeSection);
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
        throw new Error("Failed to delete selected records");
      }

      setSelectedIds([]);

      await loadTable(activeSection);
    } catch (err) {
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

    try {
      setEditError(null);

      const payload = {
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

        const detail = errorData?.detail;

        if (typeof detail === "string") {
          throw new Error(detail);
        }

        if (detail?.message) {
          throw new Error(detail.message);
        }

        throw new Error("Failed to update record");
      }

      setEditingRow(null);
      setEditValues({});
      setEditError(null);

      await loadTable(activeSection);
    } catch (err) {
      console.error("Update failed:", err);

      setEditError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <article className="admin-card database-card">
      <div className="admin-card-icon">🗄️</div>

      <div className="admin-card-content">
        <h3>Database Management</h3>

        <div className="database-sections">
          {sections.map((section) => (
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

              <span>{loading ? "Loading..." : `${rows.length} records`}</span>
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
                                          value={
                                            value === null || value === undefined
                                              ? ""
                                              : String(value)
                                          }
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
                                          value={
                                            value === null || value === undefined
                                              ? ""
                                              : String(value)
                                          }
                                          disabled={column === activeConfig.primaryKey}
                                          onChange={(event) =>
                                            setEditValues((current) => ({
                                              ...current,
                                              [column]:
                                                getInputType(column) === "number"
                                                  ? event.target.value
                                                  : event.target.value,
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
    "target_month",
    "payout_month",
  ]);

  const numberColumns = new Set([
    "quantity",
    "sales_amount",
    "target_amount",
    "minimum_sales_achievement",
    "maximum_payout_multiplier",
    "minimum_achievement",
    "maximum_achievement",
    "payout_multiplier",
    "incentive_rate",
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
