import "../App.css";

import type {
  Representative,
  Product,
} from "../api/masterData";


type InvestigationFormProps = {
  representativeId: string;
  productId: string;
  month: string;
  loading: boolean;

  representatives: Representative[];
  products: Product[];

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

  representatives,
  products,

  onRepresentativeChange,
  onProductChange,
  onMonthChange,
  onSubmit,
}: InvestigationFormProps) {
  return (
    <section className="investigation-form">
      <select
        className="form-input"
        value={representativeId}
        onChange={(e) =>
          onRepresentativeChange(e.target.value)
        }
      >
        <option value="">
          Select Representative
        </option>

        {representatives.map((rep) => (
          <option
            key={rep.representative_id}
            value={rep.representative_id}
          >
            {rep.representative_id} - {rep.first_name} {rep.last_name}
          </option>
        ))}
      </select>

      <select
        className="form-input"
        value={productId}
        onChange={(e) =>
          onProductChange(e.target.value)
        }
      >
        <option value="">
          Select Product
        </option>

        {products.map((product) => (
          <option
            key={product.product_id}
            value={product.product_id}
          >
            {product.product_id} - {product.product_name}
          </option>
        ))}
      </select>

      <input
        className="form-input"
        type="month"
        value={month}
        onChange={(e) =>
          onMonthChange(e.target.value)
        }
      />

      <button
        className="primary-button"
        onClick={onSubmit}
        disabled={
          loading ||
          !representativeId ||
          !productId ||
          !month
        }
      >
        {loading
          ? "Running..."
          : "Run Investigation"}
      </button>
    </section>
  );
}


export default InvestigationForm;