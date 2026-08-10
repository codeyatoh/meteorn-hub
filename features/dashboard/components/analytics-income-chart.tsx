"use client";

import {
  Bar,
  BarChart,
  Rectangle,
  ReferenceLine,
  Tooltip,
  XAxis,
  type BarShapeProps,
  type CartesianViewBox,
} from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { useMotionValueEvent, useSpring } from "motion/react";
import NumberFlow from "@number-flow/react";
import * as React from "react";
import Image from "next/image";

const CHART_MARGIN = 44;

interface ChartPoint {
  time: string;
  amount: number;
  fiat: number;
}

interface AnalyticsIncomeChartProps {
  data: ChartPoint[];
  currencySymbol: string;
  filter: string;
}

const chartConfig = {
  amount: {
    label: "GMTO",
    color: "#10b981",
  },
} satisfies ChartConfig;

export function AnalyticsIncomeChart({ data, currencySymbol, filter }: AnalyticsIncomeChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const maxData = React.useMemo((): { index: number; time: string; amount: number; fiat: number } => {
    if (data.length === 0) return { index: 0, time: "", amount: 0, fiat: 0 };
    return data.reduce(
      (max: { index: number; time: string; amount: number; fiat: number }, item, index) =>
        item.amount > max.amount ? { index, time: item.time, amount: item.amount, fiat: item.fiat } : max,
      { index: 0, time: data[0].time, amount: data[0].amount, fiat: data[0].fiat },
    );
  }, [data]);

  const selectedData: { index: number; time: string; amount: number; fiat: number } =
    activeIndex != null && data[activeIndex]
      ? { index: activeIndex, time: data[activeIndex].time, amount: data[activeIndex].amount, fiat: data[activeIndex].fiat }
      : maxData;

  const valueSpring = useSpring(selectedData.amount, { stiffness: 110, damping: 20 });
  const [springValue, setSpringValue] = React.useState(selectedData.amount);

  const handleBarHover = React.useCallback(
    (index: number) => {
      setActiveIndex(index);
      valueSpring.set(data[index]?.amount ?? maxData.amount);
    },
    [data, maxData.amount, valueSpring],
  );

  useMotionValueEvent(valueSpring, "change", (latest) => {
    setSpringValue(latest);
  });

  // React-recommended pattern: reset state during render when data identity changes
  // (avoids setState-in-effect anti-pattern)
  const [prevData, setPrevData] = React.useState(data);
  if (prevData !== data) {
    setPrevData(data);
    setActiveIndex(null);
  }

  // Separately update the motion spring when maxData changes — this is fine in an
  // effect because valueSpring.set() updates an external system, not React state.
  React.useEffect(() => {
    valueSpring.set(maxData.amount);
  }, [maxData.amount, valueSpring]);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No income data for this period.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header — highlighted value */}
      <div className="mb-4 flex items-end justify-between px-1">
        <div className="space-y-0.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
            <Image src="/gmto.png" alt="GMTO" width={14} height={14} className="rounded-full" />
            GMTO Income
          </p>
          <p className="font-mono text-2xl tracking-tight text-emerald-500">
            +<NumberFlow
              value={selectedData.amount}
              format={{ minimumFractionDigits: 2, maximumFractionDigits: 4 }}
            />
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            ≈ {currencySymbol}
            <NumberFlow
              value={selectedData.fiat}
              format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
            />
          </p>
        </div>
        <div className="space-y-0.5 text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {filter === "today" ? "Time" : "Date"}
          </p>
          <p className="font-mono text-xs text-foreground">{selectedData.time || "—"}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ left: CHART_MARGIN, right: 8, top: 4, bottom: 0 }}
            onMouseMove={(state) => {
              if (state?.activeTooltipIndex != null) {
                handleBarHover(Number(state.activeTooltipIndex));
              }
            }}
            onMouseLeave={() => {
              setActiveIndex(null);
              valueSpring.set(maxData.amount);
            }}
          >
            <XAxis
              dataKey="time"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              interval="preserveStartEnd"
              tickFormatter={(value: string) =>
                filter === "today" ? value : value.slice(0, 6)
              }
            />

            {/* Invisible tooltip — hover tracking only */}
            <Tooltip cursor={false} content={() => null} />

            <Bar
              dataKey="amount"
              fill="#10b981"
              radius={4}
              maxBarSize={48}
              shape={(props: BarShapeProps) => (
                <IncomeBarShape {...props} highlightedIndex={selectedData.index} />
              )}
              activeBar={(props: BarShapeProps) => (
                <IncomeBarShape {...props} highlightedIndex={selectedData.index} />
              )}
            />

            <ReferenceLine
              y={springValue}
              stroke="var(--foreground)"
              strokeDasharray="3 3"
              label={<ReferenceLabel value={springValue} exactValue={selectedData.amount} currencySymbol={currencySymbol} fiat={selectedData.fiat} />}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

// ─── Reference line label (pill + dot) ────────────────────────────────────────

interface ReferenceLabelProps {
  viewBox?: CartesianViewBox;
  value: number;
  exactValue: number;
  currencySymbol: string;
  fiat: number;
}

const ReferenceLabel = ({ viewBox, value }: ReferenceLabelProps) => {
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;
  const label = value.toFixed(2);
  const pillWidth = label.length * 7.5 + 16;

  return (
    <>
      <rect
        x={x - CHART_MARGIN}
        y={y - 9}
        width={pillWidth}
        height={18}
        fill="var(--foreground)"
        rx={4}
      />
      <text
        fontFamily="monospace"
        fontSize={10}
        fontWeight={600}
        x={x - CHART_MARGIN + 8}
        y={y + 4}
        fill="var(--background)"
      >
        {label}
      </text>
      <ellipse cx="99%" cy={y} rx={3} ry={3} fill="var(--foreground)" />
    </>
  );
};

// ─── Custom bar shape with opacity on non-selected bars ───────────────────────

type IncomeBarShapeProps = BarShapeProps & { highlightedIndex: number };

const IncomeBarShape = (props: IncomeBarShapeProps) => {
  const { x, y, width, height, fill, index, isActive, highlightedIndex } = props;
  const fillOpacity = isActive || index === highlightedIndex ? 1 : 0.2;

  return (
    <g>
      {/* Expanded hit area for smoother hover tracking */}
      <Rectangle {...props} fill="transparent" pointerEvents="all" />
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={4}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={isActive ? "#10b981" : undefined}
        strokeOpacity={isActive ? 0.4 : undefined}
        strokeWidth={isActive ? 1 : undefined}
        className="transition-opacity duration-150"
      />
    </g>
  );
};
