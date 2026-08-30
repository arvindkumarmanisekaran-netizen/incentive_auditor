import "../styles/index.css";

import type { Representative } from "../api/masterData";

import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  if (!value) return new Date();

  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

type CustomDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
};

export function CustomDatePicker({ value, onChange, ariaLabel, disabled = false }: CustomDatePickerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDate(value));

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: Array<number | null> = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  function previousMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  function selectDay(day: number) {
    const selectedDate = new Date(year, month, day);

    onChange(formatDate(selectedDate));
    setOpen(false);
  }

  const monthLabel = viewDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="custom-date-picker" ref={wrapperRef}>
      <button
        type="button"
        className="custom-date-input"
        onClick={() => {
          if (!open && value) {
            setViewDate(parseDate(value));
          }
          setOpen((current) => !current);
        }}
        aria-label={ariaLabel}
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={value ? "" : "custom-date-placeholder"}>{value || "Select date"}</span>

        <span className="custom-date-icon" aria-hidden="true">
          <AppIcon name="calendar" size={17} />
        </span>
      </button>

      {open && (
        <div className="custom-calendar-popover">
          <div className="custom-calendar-header">
            <button
              type="button"
              className="custom-calendar-nav"
              onClick={previousMonth}
              aria-label="Previous month"
            >
              ‹
            </button>

            <strong>{monthLabel}</strong>

            <button
              type="button"
              className="custom-calendar-nav"
              onClick={nextMonth}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="custom-calendar-weekdays">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          <div className="custom-calendar-grid">
            {days.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} className="custom-calendar-empty" />;
              }

              const dateValue = formatDate(new Date(year, month, day));

              const selected = dateValue === value;

              return (
                <button
                  key={dateValue}
                  type="button"
                  className={`custom-calendar-day ${selected ? "selected" : ""}`}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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

        {(Array.isArray(representatives) ? representatives : []).map((rep) => (
          <option key={rep.representative_id} value={rep.representative_id}>
            {rep.first_name} {rep.last_name} ({rep.representative_id})
          </option>
        ))}
      </select>

      <CustomDatePicker
        value={startDate}
        onChange={onStartDateChange}
        ariaLabel="Select start date"
      />

      <CustomDatePicker value={endDate} onChange={onEndDateChange} ariaLabel="Select end date" />
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
