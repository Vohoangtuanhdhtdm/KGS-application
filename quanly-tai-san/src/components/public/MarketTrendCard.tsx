import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { priceIndexApi } from "@/lib/api/priceIndex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const HEDONIC = "#7c3aed";
const NAIVE = "#94a3b8";

/** "16/06" — 17 mốc tuần, ghi đủ năm thì nhãn chồng lên nhau. */
function shortWeek(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Xu hướng giá khu vực trên trang chi tiết tin đăng.
 *
 * Chỉ số này là **hedonic**, không phải trung vị giá theo tuần. Khác biệt quan trọng: trung
 * vị thô lên xuống theo việc tuần đó tình cờ có nhiều tin ở quận đắt hay quận rẻ, chứ không
 * theo giá thị trường. Chỉ số hedonic đã trừ đi ảnh hưởng của quận, diện tích, loại hình,
 * số phòng — nên nó trả lời đúng câu cần hỏi: "cùng một căn nhà như thế, tuần này đắt hơn
 * hay rẻ hơn?"
 *
 * Nút "Xem cách tính" bật đường trung vị thô lên để người xem thấy tận mắt khoảng cách giữa
 * hai đường. Khoảng cách đó chính là phần biến động giả do đổi cơ cấu tin đăng.
 */
export function MarketTrendCard({
  city,
  district,
}: {
  city: string;
  district: string;
}) {
  const [showNaive, setShowNaive] = useState(false);

  const query = useQuery({
    queryKey: ["price-index", city, district],
    queryFn: () => priceIndexApi.get(city, district),
    staleTime: 30 * 60_000,
    retry: false,
  });

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Xu hướng giá khu vực</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Dịch vụ chỉ số không chạy hoặc chưa dựng chỉ số → ẩn hẳn thẻ này, không hiện lỗi.
  // Đây là thông tin thêm, không phải nội dung của tin đăng.
  if (query.isError || !query.data?.available || query.data.points.length < 4) return null;

  const d = query.data;
  const isDistrict = d.scope !== "toàn quốc";
  const change = d.changePoints ?? 0;
  const up = change >= 0;

  const naiveByWeek = new Map(d.naivePoints.map((p) => [p.weekStart, p.index]));
  const rows = d.points.map((p) => ({
    label: shortWeek(p.weekStart),
    hedonic: p.index,
    naive: naiveByWeek.get(p.weekStart) ?? null,
    n: p.count,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">
            Xu hướng giá {isDistrict ? `khu vực ${district}` : "thị trường"}
          </CardTitle>
          <Badge
            variant="outline"
            className={`font-normal gap-1 ${
              up ? "text-success border-success/40" : "text-destructive border-destructive/40"
            }`}
          >
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {up ? "+" : ""}
            {change.toFixed(1)} điểm
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Tuần {d.baseWeek ? shortWeek(d.baseWeek) : ""} = 100. Đã loại trừ ảnh hưởng của
          quận, diện tích, loại hình và số phòng.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={rows} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="hedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={HEDONIC} stopOpacity={0.25} />
                <stop offset="100%" stopColor={HEDONIC} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} width={42} domain={["dataMin - 3", "dataMax + 3"]} />
            <Tooltip
              formatter={(v: number, name: string) => [
                v?.toFixed(2),
                name === "hedonic" ? "Chỉ số hedonic" : "Trung vị thô",
              ]}
              labelFormatter={(l) => `Tuần ${l}`}
            />
            <Area
              type="monotone"
              dataKey="hedonic"
              stroke={HEDONIC}
              strokeWidth={2}
              fill="url(#hedFill)"
            />
            {showNaive && (
              <Line
                type="monotone"
                dataKey="naive"
                stroke={NAIVE}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Dự báo. Chỉ hiện như một dự báo khi kiểm tra lùi cho thấy nó đáng tin; không thì
            nói thẳng là chưa đủ dữ liệu, thay vì trưng một con số trông chắc chắn. */}
        {d.forecast && (
          <div className="text-xs text-muted-foreground border-t pt-2.5">
            {d.forecast.reliable ? (
              <>
                Dự báo tuần tới: <span className="font-medium">{d.forecast.nextIndex}</span> (
                {d.forecast.changePercent > 0 ? "+" : ""}
                {d.forecast.changePercent}%), theo phương pháp {d.forecast.method.toLowerCase()}.
              </>
            ) : (
              <>
                Chuỗi mới có {d.points.length} tuần nên chưa dự báo được đáng tin — sai số khi
                kiểm tra lùi là {d.forecast.backtestMape}%. Biểu đồ trên là số liệu đã xảy ra,
                không phải dự đoán.
              </>
            )}
          </div>
        )}

        {d.naivePoints.length > 0 && (
          <div className="border-t pt-2.5 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground gap-1.5"
              onClick={() => setShowNaive((v) => !v)}
            >
              <Info className="h-3.5 w-3.5" />
              {showNaive ? "Ẩn cách tính" : "Vì sao không dùng giá trung bình?"}
            </Button>

            {showNaive && (
              <p className="text-xs text-muted-foreground">
                Đường đứt nét là giá trung vị mỗi m² từng tuần — cách tính hiển nhiên nhưng
                sai. Nó lên xuống theo việc tuần đó tình cờ có nhiều tin ở quận đắt hay quận
                rẻ, chứ không theo giá thị trường.
                {d.mixShiftMaxPoints != null && (
                  <>
                    {" "}Ở đây hai đường lệch nhau tới {d.mixShiftMaxPoints} điểm — toàn bộ
                    phần lệch đó là biến động giả do đổi cơ cấu tin đăng.
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {d.caveats.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Giới hạn của số liệu</summary>
            <ul className="mt-1.5 space-y-1 list-disc pl-4">
              {d.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
