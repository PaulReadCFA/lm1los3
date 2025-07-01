import { useState } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// --------------------------------------------
// Function: calculateIRR
// Calculates Internal Rate of Return (money-weighted)
// Using Newton-Raphson method to solve for IRR
function calculateIRR(cashFlows) {
  let guess = 0.1;
  let maxIter = 100;
  let tol = 1e-6;

  for (let iter = 0; iter < maxIter; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + guess, t);
      dnpv += -t * cashFlows[t] / Math.pow(1 + guess, t + 1);
    }

    const newGuess = guess - npv / dnpv;
    if (Math.abs(newGuess - guess) < tol) return newGuess;
    guess = newGuess;
  }

  return NaN; // if no convergence
}

// --------------------------------------------
// Function: calculateTWR
// Calculates Time-Weighted Return
// Assumes sub-periods are compounded equally
function calculateTWR(startValues, gains, totalDividends) {
  const subReturns = startValues.map((start, i) => {
    const total = start + gains[i] + totalDividends[i];
    return start > 0 ? total / start : 1;
  });
  return Math.pow(subReturns.reduce((acc, r) => acc * r, 1), 1 / subReturns.length) - 1;
}

// --------------------------------------------
// Function: mean
// Simple arithmetic mean of an array
function mean(arr) {
  const sum = arr.reduce((acc, val) => acc + val, 0);
  return sum / arr.length;
}

// --------------------------------------------
// Function: geometricMean
// Compounded average growth rate of returns
function geometricMean(arr) {
  const product = arr.reduce((acc, val) => acc * (1 + val), 1);
  return Math.pow(product, 1 / arr.length) - 1;
}

// --------------------------------------------
// Component: PortfolioReturnSim
// Simulates IRR, TWR, and return stats over 3 years
export default function PortfolioReturnSim() {
  // Input states: all editable via form
  const [investment, setInvestment] = useState([100, 950, 0]); // New investment each year
  const [returns, setReturns] = useState([-0.5, 0.35, 0.27]);   // Annual return (decimal)
  const [divReinvested, setDivReinvested] = useState([0, 10, 0]); // Reinvested dividends
  const [divNotReinvested, setDivNotReinvested] = useState([5, 0, 0]); // Payout dividends
  const [withdrawals, setWithdrawals] = useState([0, -350, 0]);   // Withdrawals (negative inflows)

  // Initialize arrays to track each year’s calculations
  const startValues = [investment[0]]; // Beginning balance
  const gains = [startValues[0] * returns[0]]; // First year gain
  const endValues = [
    startValues[0] + gains[0] + divReinvested[0] + withdrawals[0],
  ];

  // Compute next 2 years’ values iteratively
  for (let i = 1; i < 3; i++) {
    startValues[i] = endValues[i - 1] + investment[i]; // Start = prior year end + new investment
    gains[i] = startValues[i] * returns[i];            // Gain = start * return
    endValues[i] =
      startValues[i] + gains[i] + divReinvested[i] + withdrawals[i]; // End = all effects
  }

  // Calculate IRR cash flows:
  // - investments are outflows (-)
  // - divNotReinvested + withdrawals are inflows
  // - final value is a terminal inflow
  const cashFlows = investment.map((inv, i) =>
    -inv + divNotReinvested[i] + withdrawals[i]
  );
  cashFlows.push(endValues[2]);

  // Metrics
  const irr = calculateIRR(cashFlows); // money-weighted return
  const twr = calculateTWR(startValues, gains, divReinvested); // time-weighted return
  const annualGeometric = geometricMean(returns); // average compounding return
  const annualArithmetic = mean(returns);         // average simple return

  // Chart data for Recharts
  const chartData = [
    { year: "Year 1", value: endValues[0] },
    { year: "Year 2", value: endValues[1] },
    { year: "Year 3", value: endValues[2] },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Input Card */}
      <Card>
        <CardContent className="space-y-2">
          <h2 className="text-lg font-semibold mb-2">Inputs</h2>
          <div className="grid grid-cols-4 gap-4">
            {/* Header Row */}
            <div></div>
            <div className="font-semibold text-center">Year 1</div>
            <div className="font-semibold text-center">Year 2</div>
            <div className="font-semibold text-center">Year 3</div>

            {/* Investment Inputs */}
            <label>Investment ($)</label>
            {investment.map((inv, i) => (
              <Input key={"inv" + i} type="number" value={inv} onChange={(e) => {
                const newInv = [...investment];
                newInv[i] = parseFloat(e.target.value);
                setInvestment(newInv);
              }} />
            ))}

            {/* Return Inputs */}
            <label>Return (decimal)</label>
            {returns.map((ret, i) => (
              <Input key={"ret" + i} type="number" step="0.01" value={ret} onChange={(e) => {
                const newR = [...returns];
                newR[i] = parseFloat(e.target.value);
                setReturns(newR);
              }} />
            ))}

            {/* Reinvested Dividends */}
            <label>Dividend reinvested ($)</label>
            {divReinvested.map((div, i) => (
              <Input key={"divr" + i} type="number" value={div} onChange={(e) => {
                const newD = [...divReinvested];
                newD[i] = parseFloat(e.target.value);
                setDivReinvested(newD);
              }} />
            ))}

            {/* Non-Reinvested Dividends */}
            <label>Dividend not reinvested ($)</label>
            {divNotReinvested.map((div, i) => (
              <Input key={"divn" + i} type="number" value={div} onChange={(e) => {
                const newD = [...divNotReinvested];
                newD[i] = parseFloat(e.target.value);
                setDivNotReinvested(newD);
              }} />
            ))}

            {/* Withdrawals */}
            <label>Withdrawal ($)</label>
            {withdrawals.map((w, i) => (
              <Input key={"w" + i} type="number" value={w} onChange={(e) => {
                const newW = [...withdrawals];
                newW[i] = parseFloat(e.target.value);
                setWithdrawals(newW);
              }} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Output Chart and Stats */}
      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold mb-2">Portfolio Value Over Time</h2>

          {/* Line Chart for End Values */}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#4476FF" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>

          {/* Summary Metrics */}
          <div className="mt-4 text-sm space-y-1">
            <p><strong>Internal Rate of Return (MWR):</strong> {(irr * 100).toFixed(2)}%</p>
            <p><strong>Holding Period Return (TWR):</strong> {(twr * 100).toFixed(2)}%</p>
            <p><strong>Annual Geometric Mean:</strong> {(annualGeometric * 100).toFixed(2)}%</p>
            <p><strong>Annual Arithmetic Mean:</strong> {(annualArithmetic * 100).toFixed(2)}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
