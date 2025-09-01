import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from "recharts";

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-md p-5 border border-gray-100 ${className}`}>
      <h2 className="font-serif text-xl text-slate-800 mb-3">{title}</h2>
      <div className="font-sans text-sm text-black/80">{children}</div>
    </div>
  );
}

function calculateIRR(cashFlows) {
  // Handle edge cases
  if (!cashFlows || cashFlows.length < 2) return NaN;
  if (cashFlows.every(cf => cf === 0)) return NaN;
  
  let guess = 0.1;
  let maxIter = 100;
  let tol = 1e-6;
  
  for (let iter = 0; iter < maxIter; iter++) {
    let npv = 0;
    let dnpv = 0;
    
    for (let t = 0; t < cashFlows.length; t++) {
      const denominator = Math.pow(1 + guess, t);
      if (denominator === 0) return NaN;
      
      npv += cashFlows[t] / denominator;
      dnpv += -t * cashFlows[t] / Math.pow(1 + guess, t + 1);
    }
    
    if (Math.abs(dnpv) < tol) return NaN; // Avoid division by zero
    
    const newGuess = guess - npv / dnpv;
    if (Math.abs(newGuess - guess) < tol) return newGuess;
    guess = newGuess;
    
    // Prevent runaway values
    if (Math.abs(guess) > 10) return NaN;
  }
  return NaN;
}

function calculateTWR(startValues, gains, totalDividends) {
  if (!startValues || !gains || !totalDividends) return NaN;
  if (startValues.length !== gains.length || gains.length !== totalDividends.length) return NaN;
  
  const subReturns = startValues.map((start, i) => {
    if (start <= 0) return 1; // Avoid division by zero
    const total = start + gains[i] + totalDividends[i];
    return total / start;
  });
  
  const product = subReturns.reduce((acc, r) => acc * r, 1);
  if (product <= 0) return NaN;
  
  return Math.pow(product, 1 / subReturns.length) - 1;
}

function safeParseFloat(value, fallback = 0) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

export default function PortfolioReturnSim() {
  // Default values match SME example (in millions for investments)
  const [investment, setInvestment] = useState([100, 950, 0]);
  const [returns, setReturns] = useState([-0.5, 0.35, 0.27]);
  const [divReinvested, setDivReinvested] = useState([0, 10, 0]);
  const [divNotReinvested, setDivNotReinvested] = useState([5, 0, 0]);
  const [withdrawals, setWithdrawals] = useState([0, -350, 0]);

  // Input validation
  const validateInputs = () => {
    const errors = [];
    
    if (investment.some(inv => inv < 0 || inv > 10000)) {
      errors.push("Investment amounts must be between 0 and 10,000 million");
    }
    if (returns.some(ret => ret < -1 || ret > 5)) {
      errors.push("Returns must be between -100% and 500%");
    }
    if (divReinvested.some(div => div < 0 || div > 1000)) {
      errors.push("Reinvested dividends must be between 0 and 1,000 million");
    }
    if (divNotReinvested.some(div => div < 0 || div > 1000)) {
      errors.push("Non-reinvested dividends must be between 0 and 1,000 million");
    }
    if (withdrawals.some(w => w < -10000 || w > 10000)) {
      errors.push("Withdrawals must be between -10,000 and 10,000 million");
    }
    
    return errors;
  };

  const inputErrors = validateInputs();

  // Calculations using useMemo for performance
  const calculations = useMemo(() => {
    if (inputErrors.length > 0) return null;

    // Convert investments from millions to actual dollars for calculations
    const investmentActual = investment.map(inv => inv * 1000000);
    const divReinvestedActual = divReinvested.map(div => div * 1000000);
    const divNotReinvestedActual = divNotReinvested.map(div => div * 1000000);
    const withdrawalsActual = withdrawals.map(w => w * 1000000);

    const startValues = [investmentActual[0]];
    const gains = [startValues[0] * returns[0]];
    const endValues = [
      startValues[0] + gains[0] + divReinvestedActual[0] + withdrawalsActual[0],
    ];

    for (let i = 1; i < 3; i++) {
      startValues[i] = endValues[i - 1] + investmentActual[i];
      gains[i] = startValues[i] * returns[i];
      endValues[i] =
        startValues[i] + gains[i] + divReinvestedActual[i] + withdrawalsActual[i];
    }

    // Cash flows for IRR calculation (in actual dollars)
    const cashFlows = [];
    cashFlows.push(-investmentActual[0] + divNotReinvestedActual[0] + withdrawalsActual[0]);
    cashFlows.push(-investmentActual[1] + divNotReinvestedActual[1] + withdrawalsActual[1]);
    cashFlows.push(-investmentActual[2] + divNotReinvestedActual[2] + withdrawalsActual[2]);
    cashFlows.push(endValues[2]);

    const totalDividends = divReinvestedActual.map((val, i) => val + divNotReinvestedActual[i]);

    const irr = calculateIRR(cashFlows);
    const twr = calculateTWR(startValues, gains, totalDividends);
    const annualGeometric = Math.pow(
      returns.reduce((acc, ret) => acc * (1 + ret), 1),
      1 / returns.length
    ) - 1;
    const annualArithmetic = returns.reduce((acc, ret) => acc + ret, 0) / returns.length;

    return {
      startValues,
      gains,
      endValues,
      cashFlows,
      totalDividends,
      irr,
      twr,
      annualGeometric,
      annualArithmetic,
      // Store original inputs for display
      investmentDisplay: investment,
      divReinvestedDisplay: divReinvested,
      divNotReinvestedDisplay: divNotReinvested,
      withdrawalsDisplay: withdrawals
    };
  }, [investment, returns, divReinvested, divNotReinvested, withdrawals, inputErrors]);

  const chartData = useMemo(() => {
    if (!calculations) return [];
    return [
      { year: "Year 1", yearLabel: "1", value: calculations.endValues[0] },
      { year: "Year 2", yearLabel: "2", value: calculations.endValues[1] },
      { year: "Year 3", yearLabel: "3", value: calculations.endValues[2] },
    ];
  }, [calculations]);

  const metricsData = useMemo(() => {
    if (!calculations) return [];
    return [
      { 
        name: "Money-Weighted Return (IRR)", 
        shortName: "MWR",
        value: calculations.irr * 100,
        isValid: !isNaN(calculations.irr)
      },
      { 
        name: "Time-Weighted Return", 
        shortName: "TWR",
        value: calculations.twr * 100,
        isValid: !isNaN(calculations.twr)
      },
      { 
        name: "Geometric Mean (Price Only)", 
        shortName: "Geom. Mean",
        value: calculations.annualGeometric * 100,
        isValid: !isNaN(calculations.annualGeometric)
      },
      { 
        name: "Arithmetic Mean (Price Only)", 
        shortName: "Arith. Mean",
        value: calculations.annualArithmetic * 100,
        isValid: !isNaN(calculations.annualArithmetic)
      },
    ];
  }, [calculations]);

  const updateInvestment = (index, value) => {
    const newInv = [...investment];
    newInv[index] = safeParseFloat(value);
    setInvestment(newInv);
  };

  const updateReturns = (index, value) => {
    const newRet = [...returns];
    newRet[index] = safeParseFloat(value);
    setReturns(newRet);
  };

  const updateDivReinvested = (index, value) => {
    const newDiv = [...divReinvested];
    newDiv[index] = safeParseFloat(value);
    setDivReinvested(newDiv);
  };

  const updateDivNotReinvested = (index, value) => {
    const newDiv = [...divNotReinvested];
    newDiv[index] = safeParseFloat(value);
    setDivNotReinvested(newDiv);
  };

  const updateWithdrawals = (index, value) => {
    const newWith = [...withdrawals];
    newWith[index] = safeParseFloat(value);
    setWithdrawals(newWith);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow">
          <p className="font-medium">{`Year: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: $${entry.value.toFixed(2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-6xl mx-auto px-4">
        <Card title="Portfolio Return Analysis: IRR vs TWR" className="w-full">
          {/* Input Section */}
          <div className="mb-6">
            <h3 className="font-serif text-lg text-slate-700 mb-4">Input Parameters</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <caption className="sr-only">
                  Portfolio parameters for 3-year investment analysis including investments, returns, dividends, and withdrawals
                </caption>
                <thead>
                  <tr className="bg-gray-50">
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-left font-semibold">
                      Parameter
                    </th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-center font-semibold">
                      Year 1
                    </th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-center font-semibold">
                      Year 2
                    </th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-center font-semibold">
                      Year 3
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold bg-gray-50">
                      Investment (in Millions) <span className="text-gray-500 font-normal">(0 - 10,000)</span>
                    </th>
                    {[0, 1, 2].map(i => (
                      <td key={`inv-${i}`} className="border border-gray-300 px-2 py-2">
                        <input
                          id={`investment-${i}`}
                          type="number"
                          min="0"
                          max="10000"
                          step="1"
                          value={investment[i]}
                          onChange={e => updateInvestment(i, e.target.value)}
                          className="w-full rounded border px-2 py-1 text-center"
                          aria-describedby={`investment-help-${i}`}
                        />
                        <span id={`investment-help-${i}`} className="sr-only">
                          Enter investment amount for year {i + 1} in millions of dollars
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold bg-gray-50">
                      Return (decimal) <span className="text-gray-500 font-normal">(-1 to 5)</span>
                    </th>
                    {[0, 1, 2].map(i => (
                      <td key={`ret-${i}`} className="border border-gray-300 px-2 py-2">
                        <input
                          id={`return-${i}`}
                          type="number"
                          min="-1"
                          max="5"
                          step="0.01"
                          value={returns[i]}
                          onChange={e => updateReturns(i, e.target.value)}
                          className="w-full rounded border px-2 py-1 text-center"
                          aria-describedby={`return-help-${i}`}
                        />
                        <span id={`return-help-${i}`} className="sr-only">
                          Enter return rate for year {i + 1} as decimal (e.g., 0.10 for 10%)
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold bg-gray-50">
                      Dividend Reinvested (in Millions) <span className="text-gray-500 font-normal">(0 - 1,000)</span>
                    </th>
                    {[0, 1, 2].map(i => (
                      <td key={`divr-${i}`} className="border border-gray-300 px-2 py-2">
                        <input
                          id={`div-reinvested-${i}`}
                          type="number"
                          min="0"
                          max="1000"
                          step="0.1"
                          value={divReinvested[i]}
                          onChange={e => updateDivReinvested(i, e.target.value)}
                          className="w-full rounded border px-2 py-1 text-center"
                          aria-describedby={`div-reinvested-help-${i}`}
                        />
                        <span id={`div-reinvested-help-${i}`} className="sr-only">
                          Enter reinvested dividend amount for year {i + 1} in millions of dollars
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold bg-gray-50">
                      Dividend Not Reinvested (in Millions) <span className="text-gray-500 font-normal">(0 - 1,000)</span>
                    </th>
                    {[0, 1, 2].map(i => (
                      <td key={`divn-${i}`} className="border border-gray-300 px-2 py-2">
                        <input
                          id={`div-not-reinvested-${i}`}
                          type="number"
                          min="0"
                          max="1000"
                          step="0.1"
                          value={divNotReinvested[i]}
                          onChange={e => updateDivNotReinvested(i, e.target.value)}
                          className="w-full rounded border px-2 py-1 text-center"
                          aria-describedby={`div-not-reinvested-help-${i}`}
                        />
                        <span id={`div-not-reinvested-help-${i}`} className="sr-only">
                          Enter non-reinvested dividend amount for year {i + 1} in millions of dollars
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold bg-gray-50">
                      Withdrawal (in Millions) <span className="text-gray-500 font-normal">(-10,000 to 10,000)</span>
                    </th>
                    {[0, 1, 2].map(i => (
                      <td key={`with-${i}`} className="border border-gray-300 px-2 py-2">
                        <input
                          id={`withdrawal-${i}`}
                          type="number"
                          min="-10000"
                          max="10000"
                          step="0.1"
                          value={withdrawals[i]}
                          onChange={e => updateWithdrawals(i, e.target.value)}
                          className="w-full rounded border px-2 py-1 text-center"
                          aria-describedby={`withdrawal-help-${i}`}
                        />
                        <span id={`withdrawal-help-${i}`} className="sr-only">
                          Enter withdrawal amount for year {i + 1} in millions (negative for additional contributions)
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Error Messages */}
          {inputErrors.length > 0 && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <div className="text-red-800 text-sm">
                <strong>Input Errors:</strong>
                <ul className="mt-1 list-disc list-inside">
                  {inputErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Charts and Results */}
          {calculations && (
            <>
              {/* Portfolio Value Chart */}
              <div className="mb-6">
                <h3 className="font-serif text-lg text-slate-700 mb-2">Portfolio Value Over Time</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="yearLabel" 
                        label={{ value: 'Year', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="linear" 
                        dataKey="value" 
                        stroke="#4476FF" 
                        strokeWidth={2}
                        dot={{ fill: '#4476FF', r: 4 }}
                        name="Portfolio Value"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Return Metrics Comparison Chart */}
              <div className="mb-6">
                <h3 className="font-serif text-lg text-slate-700 mb-2">Return Metric Comparison</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metricsData.filter(m => m.isValid)}
                      margin={{ top: 30, right: 30, left: 30, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="shortName" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                      />
                      <YAxis 
                        label={{ value: 'Return (%)', angle: -90, position: 'insideLeft' }}
                        tickFormatter={(value) => value.toFixed(1)}
                      />
                      <Tooltip 
                        formatter={(value, name) => [`${value.toFixed(2)}%`, name]}
                        labelFormatter={(label) => {
                          const metric = metricsData.find(m => m.shortName === label);
                          return metric ? metric.name : label;
                        }}
                      />
                      <Bar dataKey="value" name="Return">
                        {metricsData.filter(m => m.isValid).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.value >= 0 ? "#000000" : "#dc2626"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Black bars indicate positive returns, red bars indicate negative returns. 
                  Invalid calculations (NaN) are excluded from the chart.
                </p>
              </div>

              {/* Detailed Results Table */}
              <div className="mb-6 overflow-x-auto">
                <h3 className="font-serif text-lg text-slate-700 mb-3">Detailed Cash Flow Analysis (CFA Institute Format)</h3>
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <caption className="sr-only">
                    Detailed cash flow and return analysis showing year-by-year portfolio performance
                  </caption>
                  <thead>
                    <tr className="bg-gray-50">
                      <th scope="col" className="border border-gray-300 px-3 py-2 text-left font-semibold">
                        Item
                      </th>
                      <th scope="col" className="border border-gray-300 px-2 py-2 text-center font-semibold">
                        Timing
                      </th>
                      <th scope="col" className="border border-gray-300 px-2 py-2 text-center font-semibold">
                        Year 0
                      </th>
                      <th scope="col" className="border border-gray-300 px-2 py-2 text-center font-semibold">
                        Year 1
                      </th>
                      <th scope="col" className="border border-gray-300 px-2 py-2 text-center font-semibold">
                        Year 2
                      </th>
                      <th scope="col" className="border border-gray-300 px-2 py-2 text-center font-semibold">
                        Year 3
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">New Investment (in Millions)</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">Beginning</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.investmentDisplay[0]}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.investmentDisplay[1]}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.investmentDisplay[2]}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">Net balance</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">Beginning</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{(calculations.startValues[0] / 1000000).toFixed(0)}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{(calculations.startValues[1] / 1000000).toFixed(0)}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{(calculations.startValues[2] / 1000000).toFixed(0)}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">Annual Return (excluding dividends)</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">Over</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{(returns[0] * 100).toFixed(0)}%</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{(returns[1] * 100).toFixed(0)}%</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{(returns[2] * 100).toFixed(0)}%</td>
                    </tr>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">Investment gain (loss)</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">Over</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{(calculations.gains[0] / 1000000).toFixed(0)}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{(calculations.gains[1] / 1000000).toFixed(0)}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{(calculations.gains[2] / 1000000).toFixed(1)}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">Dividend received (and not reinvested)</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">End</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.divNotReinvestedDisplay[0]}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.divNotReinvestedDisplay[1]}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.divNotReinvestedDisplay[2]}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">Dividend received (and reinvested)</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">End</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.divReinvestedDisplay[0]}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.divReinvestedDisplay[1]}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.divReinvestedDisplay[2]}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">Dividend yield</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {(calculations.totalDividends[0] / calculations.startValues[0] * 100).toFixed(1)}%
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {(calculations.totalDividends[1] / calculations.startValues[1] * 100).toFixed(1)}%
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {(calculations.totalDividends[2] / calculations.startValues[2] * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">Total Annual Return (including dividends)</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {(((calculations.gains[0] + calculations.totalDividends[0]) / calculations.startValues[0]) * 100).toFixed(2)}%
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {(((calculations.gains[1] + calculations.totalDividends[1]) / calculations.startValues[1]) * 100).toFixed(2)}%
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {(((calculations.gains[2] + calculations.totalDividends[2]) / calculations.startValues[2]) * 100).toFixed(2)}%
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">Withdrawal by investor</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">End</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.withdrawalsDisplay[0]}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.withdrawalsDisplay[1]}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{calculations.withdrawalsDisplay[2]}</td>
                    </tr>
                    <tr className="bg-blue-50">
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">Balance</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">End</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">—</td>
                      <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{(calculations.endValues[0] / 1000000).toFixed(0)}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{(calculations.endValues[1] / 1000000).toFixed(0)}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{(calculations.endValues[2] / 1000000).toFixed(1)}</td>
                    </tr>
                    <tr className="bg-yellow-50">
                      <th scope="row" className="border border-gray-300 px-3 py-2 font-semibold">Net cash flows</th>
                      <td className="border border-gray-300 px-2 py-2 text-center">Over</td>
                      <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{(calculations.cashFlows[0] / 1000000).toFixed(0)}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{(calculations.cashFlows[1] / 1000000).toFixed(0)}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{(calculations.cashFlows[2] / 1000000).toFixed(0)}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{(calculations.cashFlows[3] / 1000000).toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Return Metrics Summary */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-serif text-lg text-slate-700 mb-3">Return Metric Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Money-Weighted Return (IRR):</strong> {
                      isNaN(calculations.irr) ? 'Unable to calculate' : `${(calculations.irr * 100).toFixed(2)}%`
                    }</p>
                    <p><strong>Time-Weighted Return:</strong> {
                      isNaN(calculations.twr) ? 'Unable to calculate' : `${(calculations.twr * 100).toFixed(2)}%`
                    }</p>
                  </div>
                  <div>
                    <p><strong>Geometric Mean (Price Only):</strong> {(calculations.annualGeometric * 100).toFixed(2)}%</p>
                    <p><strong>Arithmetic Mean (Price Only):</strong> {(calculations.annualArithmetic * 100).toFixed(2)}%</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Educational Note */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>IRR vs TWR Analysis:</strong> The Money-Weighted Return (IRR) reflects the actual return 
              experienced by the investor considering the timing and size of cash flows, while the Time-Weighted 
              Return (TWR) measures the portfolio manager's performance independent of external cash flows. 
              Use TWR to evaluate manager performance and IRR to assess investor experience.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}