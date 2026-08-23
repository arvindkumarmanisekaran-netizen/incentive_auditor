import "../styles/index.css";

import type { Representative } from "../api/masterData";

type InvestigationFormProps = {
  representativeId: string;

  startDate: string;

  endDate: string;

  loading: boolean;

  representatives: Representative[];

  onRepresentativeChange: (value: string) => void;

  onStartDateChange: (value: string) => void;

  onEndDateChange: (value: string) => void;

  onSubmit: () => void;
};

function InvestigationForm({
  representativeId,

  startDate,

  endDate,

  loading,

  representatives,

  onRepresentativeChange,

  onStartDateChange,

  onEndDateChange,

  onSubmit,
}: InvestigationFormProps) {
  return (
    <section className="investigation-form">
      {/* Representative */}

      <select
        className="form-input"
        value={representativeId}
        onChange={(e) => onRepresentativeChange(e.target.value)}
      >
        <option value="">Select Representative</option>
        // ✅ SAFE FIX 1: Default to empty array with (representatives || [])
        {(representatives || []).map((e) => (
          <option key={e.representative_id} value={e.representative_id}>
            {e.representative_id} - {e.first_name} {e.last_name}
          </option>
        ))}
        // ✅ SAFE FIX 2: Strict Array Check (Prevents crash if representatives is an object {})
        {(Array.isArray(representatives) ? representatives : []).map((e) => (
          <option key={e.representative_id} value={e.representative_id}>
            {e.representative_id} - {e.first_name} {e.last_name}
          </option>
        ))}
      </select>

      {/* Start Date */}

      <input
        className="form-input"
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
      />

      {/* End Date */}

      <input
        className="form-input"
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
      />

      <button
        className="primary-button"
        onClick={onSubmit}
        disabled={loading || !representativeId || !startDate || !endDate}
      >
        {loading ? "Running..." : "Run Investigation"}
      </button>
    </section>
  );
}

export default InvestigationForm;
