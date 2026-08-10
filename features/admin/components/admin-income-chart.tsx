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
  date: string;
  amount: number;
}

interface AdminIncomeChartProps {
  data: ChartPoint[];
  gmtoPrice: number;
  currencySymbol: string;
}

const chartConfig = {
  amount: {
    label: "GMTO",
    color: "#10b981",
  },
} satisfies ChartConfig;

export function AdminIncomeChart({ data, gmtoPrice, currencySymbol }: AdminIncomeChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const maxData = React.useMemo((): { index: number; date: string; amount: number } => {
    if (data.length === 0) return { index: 0, date: "", amount: 0 };
    return data.reduce(
      (max: { index: number; date: string; amount: number }, item, index) =>
        item.amount > max.amount ? { index, date: item.date, amount: item.amount } : max,
      { index: 0, date: data[0].date, amount: data[0].amount },
    );
  }, [data]);

  const selectedData: { index: number; date: string; amount: number } =
    activeIndex != null && data[activeIndex]
      ? { index: activeIndex, date: data[activeIndex].date, amount: data[activeIndex].amount }
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

  const [prevData, setPrevData] = React.useState(data);
  if (prevData !== data) {
    setPrevData(data);
    setActiveIndex(null);
  }

  React.useEffect(() => {
    valueSpring.set(maxData.amount);
  }, [maxData.amount, valueSpring]);

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No income data in the last 30 days.
      </div>
    );
  }

  return (
    <div className="flex h-[288px] flex-col">
      {/* Header — highlighted value */}
      <div className="mb-4 flex items-end justify-between px-1">
        <div className="space-y-0.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
            <Image src="/gmto.png" alt="GMTO" width={20} height={20} className="rounded-full" />
            GMTO Income <span className="opacity-50">({currencySymbol}{gmtoPrice.toFixed(4)})</span>
          </p>
          <div className="flex items-baseline gap-3">
            <p className="font-mono text-2xl tracking-tight text-emerald-500">
              +<NumberFlow
                value={selectedData.amount}
                format={{ minimumFractionDigits: 2, maximumFractionDigits: 4 }}
              />
            </p>
            <p className="font-mono text-sm tracking-tight text-emerald-500/50">
              ≈ {currencySymbol}<NumberFlow
                value={selectedData.amount * gmtoPrice}
                format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
              />
            </p>
          </div>
        </div>
        <div className="space-y-0.5 text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Date
          </p>
          <p className="font-mono text-xs text-foreground">{selectedData.date || "—"}</p>
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
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              interval="preserveStartEnd"
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
              label={<ReferenceLabel value={springValue} exactValue={selectedData.amount} />}
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
