import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  Finding,
} from "../types/investigation";


type Props = {
  findings?: Finding[];
};

const COLORS = {
  blue: "#2563EB",
  indigo: "#7C3AED",
  green: "#16A34A",
  red: "#DC2626",
};


const DOCTOR_COLORS = [
  "#2563EB",
  "#DC2626",
  "#16A34A",
  "#F59E0B",
  "#7C3AED",
  "#0891B2",
  "#EA580C",
  "#DB2777",
];


const TERRITORY_COLORS = [
  "#0891B2",
  "#F97316",
  "#4F46E5",
  "#65A30D",
  "#E11D48",
  "#9333EA",
];


function formatMoney(
  value: number | string
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(Number(value));
}


function getFinding(
  findings: Finding[] = [],
  type: string
) {
  return findings.find(
    (finding) =>
      finding.type === type
  );
}


function InvestigationCharts({
  findings = [],
}: Props) {
  // --------------------------------------------------
  // Find individual deterministic findings
  // --------------------------------------------------

  const salesFinding = getFinding(
    findings,
    "sales_deviation"
  );

  const doctorFinding = getFinding(
    findings,
    "doctor_concentration"
  );

  const territoryFinding = getFinding(
    findings,
    "cross_territory_concentration"
  );

  const payoutFinding = getFinding(
    findings,
    "payout_discrepancy"
  );


  // --------------------------------------------------
  // Sales chart
  // --------------------------------------------------

  const salesData = salesFinding
    ? [
        {
          name: "Historical Avg",

          amount:
            Number(
              salesFinding.evidence
                .historical_average
            ) || 0,

          fill: COLORS.blue,
        },

        {
          name: "Current Sales",

          amount:
            Number(
              salesFinding.evidence
                .current_sales
            ) || 0,

          fill: COLORS.indigo,
        },
      ]
    : [];


  // --------------------------------------------------
  // Doctor concentration
  // --------------------------------------------------

  const doctorBreakdown =
    (
      doctorFinding?.evidence
        .doctor_breakdown as Array<{
          doctor_id: string;
          doctor_name: string;
          sales: number;
        }>
    ) ?? [];


  const doctorChartData =
    doctorBreakdown.map(
      (doctor, index) => ({
        ...doctor,

        fill:
          DOCTOR_COLORS[
            index % DOCTOR_COLORS.length
          ],
      })
    );


  // --------------------------------------------------
  // Territory distribution
  // --------------------------------------------------

  const territoryBreakdown =
    (
      territoryFinding?.evidence
        .territory_breakdown as Array<{
          territory_id: string;
          territory_name: string;
          sales: number;
        }>
    ) ?? [];


  const territoryChartData =
    territoryBreakdown.map(
      (territory, index) => ({
        ...territory,

        fill:
          TERRITORY_COLORS[
            index %
              TERRITORY_COLORS.length
          ],
      })
    );


  // --------------------------------------------------
  // Payout chart
  // --------------------------------------------------

  const payoutData = payoutFinding
    ? [
        {
          name: "Expected",

          amount:
            Number(
              payoutFinding.evidence
                .expected_payout
            ) || 0,

          fill: COLORS.green,
        },

        {
          name: "Actual",

          amount:
            Number(
              payoutFinding.evidence
                .actual_payout
            ) || 0,

          fill: COLORS.red,
        },
      ]
    : [];


  return (
    <section className="charts-grid">

      {/* ==================================================
          SALES PERFORMANCE
      ================================================== */}

      <div className="chart-card">

        <div className="chart-heading">
          <div>
            <h3>
              Sales Performance
            </h3>

            <p>
              Current sales vs historical baseline
            </p>
          </div>
        </div>


        {salesData.length > 0 ? (

          <div className="chart-container">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={salesData}
                margin={{
                  top: 15,
                  right: 15,
                  left: 10,
                  bottom: 5,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />


                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                />


                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    `₹${Number(value) / 1000}k`
                  }
                />


                <Tooltip
                  formatter={(value) => [
                    formatMoney(
                      Number(value)
                    ),
                    "Sales",
                  ]}
                />


                <Bar
                  dataKey="amount"
                  radius={[
                    8,
                    8,
                    0,
                    0,
                  ]}
                  maxBarSize={80}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        ) : (

          <p className="chart-empty">
            No sales comparison available.
          </p>

        )}

      </div>


      {/* ==================================================
          PAYOUT
      ================================================== */}

      <div className="chart-card">

        <div className="chart-heading">
          <div>
            <h3>
              Payout Comparison
            </h3>

            <p>
              Expected incentive vs actual payout
            </p>
          </div>
        </div>


        {payoutData.length > 0 ? (

          <div className="chart-container">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={payoutData}
                margin={{
                  top: 15,
                  right: 15,
                  left: 10,
                  bottom: 5,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />


                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                />


                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    `₹${Number(value) / 1000}k`
                  }
                />


                <Tooltip
                  formatter={(value) => [
                    formatMoney(
                      Number(value)
                    ),
                    "Payout",
                  ]}
                />


                <Bar
                  dataKey="amount"
                  radius={[
                    8,
                    8,
                    0,
                    0,
                  ]}
                  maxBarSize={80}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        ) : (

          <p className="chart-empty">
            No payout comparison available.
          </p>

        )}

      </div>


      {/* ==================================================
          DOCTOR CONCENTRATION
      ================================================== */}

      <div className="chart-card">

        <div className="chart-heading">
          <div>
            <h3>
              Doctor Concentration
            </h3>

            <p>
              Sales contribution by doctor
            </p>
          </div>
        </div>


        {doctorChartData.length > 0 ? (

          <div className="chart-container">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <PieChart>

                <Pie
                  data={doctorChartData}
                  dataKey="sales"
                  nameKey="doctor_name"

                  innerRadius={60}
                  outerRadius={95}

                  paddingAngle={3}

                  stroke="#FFFFFF"
                  strokeWidth={3}
                />


                <Tooltip
                  formatter={(value) =>
                    formatMoney(
                      Number(value)
                    )
                  }
                />


                <Legend
                  verticalAlign="bottom"
                  height={36}
                />

              </PieChart>

            </ResponsiveContainer>

          </div>

        ) : (

          <p className="chart-empty">
            No doctor concentration data.
          </p>

        )}

      </div>


      {/* ==================================================
          TERRITORY DISTRIBUTION
      ================================================== */}

      <div className="chart-card">

        <div className="chart-heading">
          <div>
            <h3>
              Territory Distribution
            </h3>

            <p>
              Attributed sales by selling territory
            </p>
          </div>
        </div>


        {territoryChartData.length > 0 ? (

          <div className="chart-container">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <PieChart>

                <Pie
                  data={territoryChartData}
                  dataKey="sales"
                  nameKey="territory_name"

                  innerRadius={60}
                  outerRadius={95}

                  paddingAngle={3}

                  stroke="#FFFFFF"
                  strokeWidth={3}
                />


                <Tooltip
                  formatter={(value) =>
                    formatMoney(
                      Number(value)
                    )
                  }
                />


                <Legend
                  verticalAlign="bottom"
                  height={36}
                />

              </PieChart>

            </ResponsiveContainer>

          </div>

        ) : (

          <p className="chart-empty">
            No territory data available.
          </p>

        )}

      </div>

    </section>
  );
}


export default InvestigationCharts;