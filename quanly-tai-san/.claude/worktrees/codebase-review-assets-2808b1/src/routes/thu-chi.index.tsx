import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi } from "@/lib/api/assets";
import { contractsApi, toIsoUtc } from "@/lib/api/contracts";
import { cashflowsApi, type CashFlowDto, type CashFlowFilters } from "@/lib/api/cashflows";
import { reportsApi } from "@/lib/api/reports";
import { getErrorMessage } from "@/lib/api/errors";
import { formatVND, formatCurrency, formatDate } from "@/lib/format";
import { MoneyValue } from "@/components/MoneyValue";
import {
  CASH_FLOW_DIRECTION,
  CASH_FLOW_CATEGORY,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  type CashFlowCategoryCode,
  type CashFlowDirectionCode,
} from "@/constants/enums";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Plus, Trash2, Receipt, Wallet, Loader2, X } from "lucide-react";

export const Route = createFileRoute("/thu-chi/")({
  head: () => ({ meta: [{ title: "Sổ thu chi & Báo cáo — Quản Lý Tài Sản" }] }),
  component: CashflowPage,
});

// Màu ngữ nghĩa cho biểu đồ tài chính — thu=xanh, chi=đỏ, KHÔNG dùng bảng màu
// rainbow mặc định của recharts để người xem phân biệt ngay 2 nhóm.
const INCOME_COLOR = "#16a34a";
const EXPENSE_COLOR = "#dc2626";
// Nhiều hạng mục trong cùng 1 pie → tạo dải sắc độ từ màu gốc (đậm → nhạt dần)
function shadesOf(baseHex: string, count: number): string[] {
  const r = parseInt(baseHex.slice(1, 3), 16);
  const g = parseInt(baseHex.slice(3, 5), 16);
  const b = parseInt(baseHex.slice(5, 7), 16);
  return Array.from({ length: count }, (_, i) => {
    const t = count <= 1 ? 0 : (i / (count - 1)) * 0.6; // pha trắng dần tối đa 60%
    const mix = (c: number) => Math.round(c + (255 - c) * t);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  });
}

const RECEIPT_ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const RECEIPT_MAX = 10 * 1024 * 1024;

/** Danh sách tài sản cho dropdown chọn/lọc (dùng chung các tab). */
function useAssetOptions() {
  return useQuery({
    queryKey: ["assets", { pageSize: 200 }],
    queryFn: () => assetsApi.list({ pageSize: 200 }),
    staleTime: 60_000,
    retry: 1,
  });
}

function CashflowPage() {
  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sổ thu chi & Báo cáo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ghi chép giao dịch và xem báo cáo tài chính theo tài sản, thời gian.
        </p>
      </div>
      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">Sổ giao dịch</TabsTrigger>
          <TabsTrigger value="income">Thu nhập</TabsTrigger>
          <TabsTrigger value="profit">Lợi nhuận theo tài sản</TabsTrigger>
          <TabsTrigger value="tax">Thuế theo năm</TabsTrigger>
        </TabsList>
        <TabsContent value="ledger" className="mt-4">
          <LedgerTab />
        </TabsContent>
        <TabsContent value="income" className="mt-4">
          <IncomeTab />
        </TabsContent>
        <TabsContent value="profit" className="mt-4">
          <ProfitTab />
        </TabsContent>
        <TabsContent value="tax" className="mt-4">
          <TaxTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------- Sổ giao dịch

function LedgerTab() {
  const qc = useQueryClient();
  const assetsQ = useAssetOptions();

  const [fAsset, setFAsset] = useState("all");
  const [fDir, setFDir] = useState<CashFlowDirectionCode | "all">("all");
  const [fCat, setFCat] = useState<CashFlowCategoryCode | "all">("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [deleting, setDeleting] = useState<CashFlowDto | null>(null);

  // Loại phụ thuộc chiều đã lọc
  const catOptions: CashFlowCategoryCode[] =
    fDir === 1
      ? INCOME_CATEGORIES
      : fDir === 2
        ? EXPENSE_CATEGORIES
        : [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

  const filters: CashFlowFilters = {
    assetId: fAsset === "all" ? undefined : fAsset,
    direction: fDir === "all" ? "" : fDir,
    category: fCat === "all" ? "" : fCat,
    from: fFrom ? `${fFrom}T00:00:00Z` : undefined,
    to: fTo ? `${fTo}T23:59:59Z` : undefined,
    pageSize: 30,
  };

  // Keyset pagination — useInfiniteQuery + nút "Tải thêm", không có số trang/tổng
  const query = useInfiniteQuery({
    queryKey: ["cashflows", filters],
    queryFn: ({ pageParam }) => cashflowsApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: 1,
  });

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const del = useMutation({
    mutationFn: (id: string) => cashflowsApi.remove(id),
    onSuccess: () => {
      toast.success("Đã xoá bút toán");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["cashflows"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không xoá được bút toán")),
  });

  return (
    <>
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end justify-between">
          <div className="flex gap-3 flex-wrap">
            <div className="w-52">
              <Label className="text-xs">Tài sản</Label>
              <Select value={fAsset} onValueChange={setFAsset}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {(assetsQ.data?.items ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label className="text-xs">Chiều</Label>
              <Select
                value={fDir === "all" ? "all" : String(fDir)}
                onValueChange={(v) => {
                  setFDir(v === "all" ? "all" : (Number(v) as CashFlowDirectionCode));
                  setFCat("all");
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cả hai</SelectItem>
                  <SelectItem value="1">Thu</SelectItem>
                  <SelectItem value="2">Chi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs">Loại</Label>
              <Select
                value={fCat === "all" ? "all" : String(fCat)}
                onValueChange={(v) =>
                  setFCat(v === "all" ? "all" : (Number(v) as CashFlowCategoryCode))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  {catOptions.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {CASH_FLOW_CATEGORY[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Từ ngày</Label>
              <Input
                type="date"
                className="mt-1 w-40"
                value={fFrom}
                onChange={(e) => setFFrom(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Đến ngày</Label>
              <Input
                type="date"
                className="mt-1 w-40"
                value={fTo}
                onChange={(e) => setFTo(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ghi thu/chi mới
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="py-10 text-center text-sm text-destructive">
              {getErrorMessage(query.error, "Không tải được sổ thu chi")}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              Chưa có bút toán thu/chi nào.
              <div className="mt-3">
                <Button size="sm" onClick={() => setOpenCreate(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Ghi thu/chi mới
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Tài sản</TableHead>
                    <TableHead>Chiều</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead>Mô tả</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.occurredAt)}</TableCell>
                      <TableCell className="text-sm">{e.assetName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            e.direction === 1
                              ? "bg-success/15 text-success border-success/30"
                              : "bg-destructive/15 text-destructive border-destructive/30"
                          }
                        >
                          {CASH_FLOW_DIRECTION[e.direction]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {CASH_FLOW_CATEGORY[e.category] ?? e.category}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Cột gộp thu/chi → dấu +/- rõ ràng kèm màu qua MoneyValue */}
                        <MoneyValue amount={e.direction === 1 ? e.amount : -e.amount} showSign />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[260px] truncate">
                        {e.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          {e.receipt && (
                            <Button size="icon" variant="ghost" asChild title="Xem biên lai">
                              <a href={e.receipt.url} target="_blank" rel="noreferrer">
                                <Receipt className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleting(e)}
                            title="Xoá bút toán"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {query.hasNextPage && (
                <div className="p-4 flex justify-center border-t">
                  <Button
                    variant="outline"
                    onClick={() => query.fetchNextPage()}
                    disabled={query.isFetchingNextPage}
                  >
                    {query.isFetchingNextPage && (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    )}
                    Tải thêm
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AddCashflowDialog open={openCreate} onOpenChange={setOpenCreate} />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bút toán?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  {CASH_FLOW_DIRECTION[deleting.direction]} {formatCurrency(deleting.amount)} —{" "}
                  {CASH_FLOW_CATEGORY[deleting.category]} ({formatDate(deleting.occurredAt)}). Hành
                  động này không thể hoàn tác.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={del.isPending}
              onClick={(ev) => {
                ev.preventDefault();
                if (deleting) del.mutate(deleting.id);
              }}
            >
              {del.isPending ? "Đang xoá..." : "Xoá"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ------------------------------------------------------------- Form ghi thu/chi

function AddCashflowDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const assetsQ = useAssetOptions();
  const receiptRef = useRef<HTMLInputElement>(null);

  const [direction, setDirection] = useState<CashFlowDirectionCode>(1);
  const [category, setCategory] = useState<CashFlowCategoryCode | "">("");
  const [assetId, setAssetId] = useState("");
  const [assetUnitId, setAssetUnitId] = useState("");
  const [leaseContractId, setLeaseContractId] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // ⚠️ Loại phụ thuộc Chiều: Thu chỉ có 3 loại, "Khác" (99) chỉ hợp lệ với Chi
  const catOptions = direction === 1 ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const unitsQ = useQuery({
    queryKey: ["asset-units", assetId],
    queryFn: () => assetsApi.units.list(assetId),
    enabled: !!assetId,
    retry: 1,
  });
  const contractsQ = useQuery({
    queryKey: ["contracts", { assetId, pageSize: 100 }],
    queryFn: () => contractsApi.list({ assetId, pageSize: 100 }),
    enabled: !!assetId,
    retry: 1,
  });

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearReceipt = () => {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceipt(null);
    setReceiptPreview(null);
    if (receiptRef.current) receiptRef.current.value = "";
  };

  const reset = () => {
    setDirection(1);
    setCategory("");
    setAssetId("");
    setAssetUnitId("");
    setLeaseContractId("");
    setAmount(null);
    setOccurredAt(new Date().toISOString().slice(0, 10));
    setPeriodStart("");
    setPeriodEnd("");
    setDescription("");
    clearReceipt();
  };

  const create = useMutation({
    mutationFn: () =>
      cashflowsApi.create({
        assetId,
        assetUnitId: assetUnitId || null,
        leaseContractId: leaseContractId || null,
        direction,
        category: category as CashFlowCategoryCode,
        amount: amount ?? 0,
        occurredAt: toIsoUtc(occurredAt),
        periodStart: periodStart ? toIsoUtc(periodStart) : null,
        periodEnd: periodEnd ? toIsoUtc(periodEnd) : null,
        description: description.trim() || null,
        receipt,
      }),
    onSuccess: () => {
      toast.success("Đã ghi bút toán thu/chi");
      qc.invalidateQueries({ queryKey: ["cashflows"] });
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không ghi được bút toán")),
  });

  const handleReceipt = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!RECEIPT_ACCEPT.includes(f.type) && !f.name.toLowerCase().endsWith(".heic")) {
      toast.error(`${f.name}: định dạng không hỗ trợ (chỉ JPEG/PNG/WEBP/HEIC)`);
      return;
    }
    if (f.size > RECEIPT_MAX) {
      toast.error(`${f.name}: vượt quá 10MB`);
      return;
    }
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceipt(f);
    setReceiptPreview(URL.createObjectURL(f));
  };

  const submit = () => {
    if (!assetId) {
      toast.error("Vui lòng chọn tài sản");
      return;
    }
    if (category === "") {
      toast.error("Vui lòng chọn loại thu/chi");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      return;
    }
    if (!occurredAt) {
      toast.error("Vui lòng chọn ngày phát sinh");
      return;
    }
    create.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!create.isPending) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ghi thu/chi mới</DialogTitle>
          <DialogDescription>
            Chọn chiều trước — danh sách loại sẽ thay đổi theo chiều Thu/Chi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Chiều *</Label>
            <RadioGroup
              className="flex gap-6"
              value={String(direction)}
              onValueChange={(v) => {
                setDirection(Number(v) as CashFlowDirectionCode);
                setCategory(""); // đổi chiều → reset loại, tránh giữ lựa chọn không hợp lệ
              }}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="1" id="dir-thu" />
                <Label htmlFor="dir-thu" className="text-success font-medium cursor-pointer">
                  Thu
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="2" id="dir-chi" />
                <Label htmlFor="dir-chi" className="text-destructive font-medium cursor-pointer">
                  Chi
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Loại *</Label>
              <Select
                value={category === "" ? "" : String(category)}
                onValueChange={(v) => setCategory(Number(v) as CashFlowCategoryCode)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent>
                  {catOptions.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {CASH_FLOW_CATEGORY[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ngày phát sinh *</Label>
              <Input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tài sản *</Label>
            <Select
              value={assetId}
              onValueChange={(v) => {
                setAssetId(v);
                setAssetUnitId("");
                setLeaseContractId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn tài sản" />
              </SelectTrigger>
              <SelectContent>
                {(assetsQ.data?.items ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assetId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tầng/Phòng (tuỳ chọn)</Label>
                <Select
                  value={assetUnitId || "none"}
                  onValueChange={(v) => setAssetUnitId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không gắn phòng</SelectItem>
                    {(unitsQ.data ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hợp đồng (tuỳ chọn)</Label>
                <Select
                  value={leaseContractId || "none"}
                  onValueChange={(v) => setLeaseContractId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không gắn hợp đồng</SelectItem>
                    {(contractsQ.data?.items ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.counterpartyName} · {formatDate(c.startDate)} → {formatDate(c.endDate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Số tiền (VNĐ) *</Label>
            <CurrencyInput value={amount} onChange={setAmount} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kỳ từ ngày (tuỳ chọn)</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Kỳ đến ngày (tuỳ chọn)</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mô tả</Label>
            <Textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tối đa 500 ký tự"
            />
          </div>

          <div className="space-y-2">
            <Label>Biên lai (tuỳ chọn)</Label>
            {receiptPreview ? (
              <div className="relative w-32 rounded-md overflow-hidden border bg-muted">
                <img src={receiptPreview} alt="Biên lai" className="w-full object-cover" />
                {!create.isPending && (
                  <button
                    type="button"
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                    onClick={clearReceipt}
                    aria-label="Bỏ biên lai"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <Input
                ref={receiptRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleReceipt(e.target.files)}
              />
            )}
            <p className="text-xs text-muted-foreground">JPEG / PNG / WEBP / HEIC · tối đa 10MB</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {create.isPending ? "Đang ghi..." : "Ghi nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Tab Thu nhập

function defaultFrom(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
}

function IncomeTab() {
  const assetsQ = useAssetOptions();
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [assetId, setAssetId] = useState("all");

  const params = {
    from: from ? `${from}T00:00:00Z` : undefined,
    to: to ? `${to}T23:59:59Z` : undefined,
    assetId: assetId === "all" ? undefined : assetId,
  };
  const query = useQuery({
    queryKey: ["report-income", params],
    queryFn: () => reportsApi.income(params),
    retry: 1,
  });

  const chartData = useMemo(
    () =>
      (query.data?.byMonth ?? []).map((m) => ({
        month: `${String(m.month).padStart(2, "0")}/${m.year}`,
        amount: m.amount,
      })),
    [query.data],
  );

  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-4 flex gap-3 flex-wrap items-end">
          <div>
            <Label className="text-xs">Từ ngày</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
          <div>
            <Label className="text-xs">Đến ngày</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
          <div className="w-56">
            <Label className="text-xs">Tài sản</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả tài sản</SelectItem>
                {(assetsQ.data?.items ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
      ) : query.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {getErrorMessage(query.error, "Không tải được báo cáo thu nhập")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thu nhập theo tháng</CardTitle>
            <div className="text-3xl font-semibold text-success">
              {formatCurrency(query.data?.totalIncome ?? 0)}
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Không có dữ liệu trong khoảng thời gian này.
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" fontSize={12} stroke="var(--color-muted-foreground)" />
                    <YAxis
                      fontSize={12}
                      stroke="var(--color-muted-foreground)"
                      tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}tr`}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      name="Thu nhập"
                      fill={INCOME_COLOR}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// -------------------------------------------------- Tab Lợi nhuận theo tài sản

function BreakdownPie({
  title,
  data,
  tone,
}: {
  title: string;
  data: { category: CashFlowCategoryCode; amount: number }[];
  /** thu → dải xanh, chi → dải đỏ — nhất quán với màu ngữ nghĩa toàn app */
  tone: "income" | "expense";
}) {
  const chartData = data.map((d) => ({
    name: CASH_FLOW_CATEGORY[d.category] ?? String(d.category),
    value: d.amount,
  }));
  const colors = shadesOf(tone === "income" ? INCOME_COLOR : EXPENSE_COLOR, chartData.length);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Không có dữ liệu trong khoảng thời gian này.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={colors[i]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfitTab() {
  const assetsQ = useAssetOptions();
  const [assetId, setAssetId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = {
    assetId,
    from: from ? `${from}T00:00:00Z` : undefined,
    to: to ? `${to}T23:59:59Z` : undefined,
  };
  const query = useQuery({
    queryKey: ["report-profit", params],
    queryFn: () => reportsApi.profit(params),
    enabled: !!assetId,
    retry: 1,
  });

  const r = query.data;

  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-4 flex gap-3 flex-wrap items-end">
          <div className="w-72">
            <Label className="text-xs">Tài sản (bắt buộc)</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn tài sản để xem báo cáo" />
              </SelectTrigger>
              <SelectContent>
                {(assetsQ.data?.items ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Từ ngày</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
          <div>
            <Label className="text-xs">Đến ngày</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
        </CardContent>
      </Card>

      {!assetId ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            Chọn một tài sản để xem báo cáo lợi nhuận.
          </CardContent>
        </Card>
      ) : query.isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {getErrorMessage(query.error, "Không tải được báo cáo lợi nhuận")}
          </CardContent>
        </Card>
      ) : r ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tổng thu
                </div>
                <MoneyValue amount={r.totalIncome} tone="income" className="text-2xl mt-1 block" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tổng chi
                </div>
                <MoneyValue
                  amount={r.totalExpense}
                  tone="expense"
                  className="text-2xl mt-1 block"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Lợi nhuận
                </div>
                {/* auto: xanh nếu dương, đỏ nếu âm — quan trọng vì tài sản có thể lỗ */}
                <MoneyValue amount={r.profit} tone="auto" className="text-2xl mt-1 block" />
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <BreakdownPie title="Cơ cấu thu" data={r.incomeBreakdown} tone="income" />
            <BreakdownPie title="Cơ cấu chi" data={r.expenseBreakdown} tone="expense" />
          </div>
        </>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------ Tab Thuế theo năm

function TaxTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const query = useQuery({
    queryKey: ["report-tax", year],
    queryFn: () => reportsApi.tax(year),
    retry: 1,
  });

  const rows = query.data?.byTaxType ?? [];

  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-4">
          <Label className="text-xs">Năm</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="mt-1 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chi tiết thuế năm {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="py-10 text-center text-sm text-destructive">
              {getErrorMessage(query.error, "Không tải được báo cáo thuế")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại thuế</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center py-8 text-muted-foreground text-sm"
                    >
                      Không có dữ liệu trong khoảng thời gian này.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.category}>
                    <TableCell>{CASH_FLOW_CATEGORY[r.category] ?? r.category}</TableCell>
                    <TableCell className="text-right">
                      <MoneyValue amount={r.amount} tone="expense" />
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Tổng cộng</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(query.data?.totalTax ?? 0)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
