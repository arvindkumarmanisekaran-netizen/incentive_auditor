type InvestigationFormProps = {
  representativeId: string;
  productId: string;
  month: string;
  loading: boolean;

  onRepresentativeChange: (value: string) => void;
  onProductChange: (value: string) => void;
  onMonthChange: (value: string) => void;

  onSubmit: () => void;
};


function InvestigationForm({
  representativeId,
  productId,
  month,
  loading,
  onRepresentativeChange,
  onProductChange,
  onMonthChange,
  onSubmit,
}: InvestigationFormProps) {
  return (
    <section
      style={{
        display: "flex",
        gap: "12px",
        marginBottom: "24px",
        flexWrap: "wrap",
      }}
    >
      <input
        value={representativeId}
        onChange={(e) =>
          onRepresentativeChange(e.target.value)
        }
        placeholder="Representative"
      />

      <input
        value={productId}
        onChange={(e) =>
          onProductChange(e.target.value)
        }
        placeholder="Product"
      />

      <input
        type="month"
        value={month}
        onChange={(e) =>
          onMonthChange(e.target.value)
        }
      />

      <button
        onClick={onSubmit}
        disabled={loading}
      >
        {loading
          ? "Running..."
          : "Run Investigation"}
      </button>
    </section>
  );
}


export default InvestigationForm;