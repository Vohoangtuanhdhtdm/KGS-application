import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi } from "@/lib/api/assets";
import { contactsApi, type ContactInput } from "@/lib/api/contacts";
import { contractsApi, toIsoUtc, type CreateContractInput } from "@/lib/api/contracts";
import { ApiError } from "@/lib/auth/types";
import { getErrorMessage } from "@/lib/api/errors";
import {
  CONTACT_TYPE,
  CONTRACT_DIRECTION,
  PAYMENT_CYCLE,
  TAX_RESPONSIBILITY,
  enumOptions,
  type ContactTypeCode,
  type ContractDirectionCode,
  type PaymentCycleCode,
  type TaxResponsibilityCode,
} from "@/constants/enums";
import { formatCurrency } from "@/lib/format";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, ChevronDown } from "lucide-react";

const searchSchema = z.object({ assetId: z.string().optional() });

export const Route = createFileRoute("/hop-dong/moi")({
  head: () => ({ meta: [{ title: "Tạo hợp đồng mới — Quản Lý Tài Sản" }] }),
  validateSearch: searchSchema,
  component: NewContract,
});

const STEPS = ["Tài sản & phạm vi", "Chiều & đối tác", "Điều khoản", "Xác nhận"];

function NewContract() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  // Step 1
  const [assetId, setAssetId] = useState<string>(search.assetId ?? "");
  const [scope, setScope] = useState<"whole" | "unit">("whole");
  const [assetUnitId, setAssetUnitId] = useState<string>("");

  // Step 2
  const [direction, setDirection] = useState<ContractDirectionCode>(1);
  const [counterpartyId, setCounterpartyId] = useState<string>("");
  const [addContactOpen, setAddContactOpen] = useState(false);

  // Step 3
  const initialStart = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState("");
  const [rentAmount, setRentAmount] = useState<number | null>(null);
  const [paymentCycle, setPaymentCycle] = useState<PaymentCycleCode>(1);
  // paymentDueDay tự khớp ngày trong tháng của startDate; user vẫn sửa được
  const [paymentDueDay, setPaymentDueDay] = useState(new Date(initialStart).getDate());
  const [dueDayTouched, setDueDayTouched] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [nextIncrease, setNextIncrease] = useState("");
  const [taxResp, setTaxResp] = useState<TaxResponsibilityCode>(1);
  const [notes, setNotes] = useState("");
  const [activate, setActivate] = useState(true);
  const [optionalOpen, setOptionalOpen] = useState(false);

  const assetsQ = useQuery({
    queryKey: ["assets", { pageSize: 200 }],
    queryFn: () => assetsApi.list({ pageSize: 200 }),
  });
  const unitsQ = useQuery({
    queryKey: ["asset-units", assetId],
    queryFn: () => assetsApi.units.list(assetId),
    enabled: !!assetId,
  });
  const selectedAsset = assetsQ.data?.items.find((a) => a.id === assetId);
  const availableUnits = (unitsQ.data ?? []).filter((u) => u.status === 1);

  // Force whole if no units
  const hasUnits = (unitsQ.data?.length ?? 0) > 0;
  const effectiveScope = hasUnits ? scope : "whole";
  const effectiveUnitId = effectiveScope === "unit" ? assetUnitId : "";

  // Force direction=1 if ownership=Sở hữu (1)
  const isOwned = selectedAsset?.ownershipType === 1;
  const effectiveDirection: ContractDirectionCode = isOwned ? 1 : direction;

  const suggestedType: ContactTypeCode = effectiveDirection === 1 ? 1 : 2;
  const contactsQ = useQuery({
    queryKey: ["contacts", { pageSize: 200 }],
    queryFn: () => contactsApi.list({ pageSize: 200 }),
  });
  const contactOptions = useMemo(() => {
    const all = contactsQ.data?.items ?? [];
    const preferred = all.filter((c) => c.type === suggestedType);
    const others = all.filter((c) => c.type !== suggestedType);
    return { preferred, others };
  }, [contactsQ.data, suggestedType]);

  const create = useMutation({
    mutationFn: (b: CreateContractInput) => contractsApi.create(b),
    onSuccess: (created) => {
      toast.success("Đã tạo hợp đồng. Hệ thống đã tự tạo 2 nhắc lịch.", {
        icon: <Sparkles className="h-4 w-4" />,
      });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      qc.invalidateQueries({ queryKey: ["asset-units", assetId] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contracts-expiring"] });
      qc.invalidateQueries({ queryKey: ["reminders"] });
      navigate({ to: "/hop-dong/$id", params: { id: created.id } });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(getErrorMessage(err), {
          description: "Hãy xem lại danh sách hợp đồng của tài sản này.",
        });
      } else {
        toast.error(getErrorMessage(err, "Không tạo được hợp đồng"));
      }
    },
  });

  const canNext =
    (step === 0 && !!assetId && (effectiveScope === "whole" || !!assetUnitId)) ||
    (step === 1 && !!counterpartyId) ||
    (step === 2 &&
      !!startDate &&
      !!endDate &&
      (rentAmount ?? 0) > 0 &&
      paymentDueDay >= 1 &&
      paymentDueDay <= 31 &&
      new Date(endDate) > new Date(startDate)) ||
    step === 3;

  const submit = () => {
    if (!assetId || !counterpartyId || !rentAmount || !startDate || !endDate) return;
    create.mutate({
      assetId,
      assetUnitId: effectiveUnitId || null,
      direction: effectiveDirection,
      counterpartyId,
      startDate: toIsoUtc(startDate),
      endDate: toIsoUtc(endDate),
      rentAmount,
      paymentCycle,
      paymentDueDay,
      depositAmount: depositAmount ?? null,
      nextRentIncreaseDate: nextIncrease ? toIsoUtc(nextIncrease) : null,
      taxResponsibility: taxResp,
      notes: notes.trim() || null,
      activateImmediately: activate,
    });
  };

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/hop-dong">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Quay lại
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tạo hợp đồng mới</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bước {step + 1}/{STEPS.length} · {STEPS[step]}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
                i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 ${i < step ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label>Tài sản *</Label>
                <Select
                  value={assetId}
                  onValueChange={(v) => {
                    setAssetId(v);
                    setScope("whole");
                    setAssetUnitId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn tài sản" />
                  </SelectTrigger>
                  <SelectContent>
                    {(assetsQ.data?.items ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.district}, {a.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {assetId && hasUnits && (
                <div className="space-y-2">
                  <Label>Phạm vi</Label>
                  <RadioGroup value={scope} onValueChange={(v) => setScope(v as "whole" | "unit")}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="whole" id="whole" />
                      <Label htmlFor="whole" className="font-normal">
                        Cho thuê nguyên căn
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="unit" id="unit" />
                      <Label htmlFor="unit" className="font-normal">
                        Cho thuê theo tầng/phòng
                      </Label>
                    </div>
                  </RadioGroup>
                  {scope === "unit" && (
                    <div className="pl-6 pt-1">
                      <Select value={assetUnitId} onValueChange={setAssetUnitId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn phòng trống" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUnits.length === 0 && (
                            <div className="p-2 text-xs text-muted-foreground">
                              Không có phòng nào ở trạng thái Trống.
                            </div>
                          )}
                          {availableUnits.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                              {u.floorNumber != null ? ` — tầng ${u.floorNumber}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
              {assetId && !hasUnits && (
                <p className="text-xs text-muted-foreground">
                  Tài sản không chia tầng/phòng — hợp đồng sẽ áp dụng cho toàn bộ tài sản.
                </p>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Chiều hợp đồng</Label>
                <RadioGroup
                  value={String(effectiveDirection)}
                  onValueChange={(v) => {
                    setDirection(Number(v) as ContractDirectionCode);
                    setCounterpartyId("");
                  }}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="1" id="d1" />
                    <Label htmlFor="d1" className="font-normal">
                      Tôi cho thuê
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="2" id="d2" disabled={isOwned} />
                    <Label
                      htmlFor="d2"
                      className={`font-normal ${isOwned ? "text-muted-foreground" : ""}`}
                    >
                      Tôi đi thuê
                    </Label>
                    {isOwned && (
                      <span className="text-xs text-muted-foreground">
                        (chỉ áp dụng cho tài sản đi thuê)
                      </span>
                    )}
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>
                    Đối tác *{" "}
                    <span className="text-muted-foreground font-normal">
                      — gợi ý: {CONTACT_TYPE[suggestedType]}
                    </span>
                  </Label>
                  <Button size="sm" variant="ghost" onClick={() => setAddContactOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Thêm đối tác
                  </Button>
                </div>
                <Select value={counterpartyId} onValueChange={setCounterpartyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn đối tác" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactOptions.preferred.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} — {CONTACT_TYPE[c.type]}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </SelectItem>
                    ))}
                    {contactOptions.others.length > 0 && contactOptions.preferred.length > 0 && (
                      <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1 pt-2">
                        Khác:
                      </div>
                    )}
                    {contactOptions.others.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} — {CONTACT_TYPE[c.type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ngày bắt đầu *</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStartDate(v);
                      // Tự đồng bộ ngày trả trong kỳ theo ngày bắt đầu, trừ khi user đã sửa
                      if (!dueDayTouched && v) {
                        const d = new Date(v).getDate();
                        if (d >= 1 && d <= 31) setPaymentDueDay(d);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ngày kết thúc *</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tiền thuê *</Label>
                <CurrencyInput value={rentAmount} onChange={setRentAmount} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Chu kỳ thanh toán</Label>
                  <Select
                    value={String(paymentCycle)}
                    onValueChange={(v) => setPaymentCycle(Number(v) as PaymentCycleCode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {enumOptions(PAYMENT_CYCLE).map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ngày trả trong kỳ (1-31)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={paymentDueDay}
                    onChange={(e) => {
                      setDueDayTouched(true);
                      setPaymentDueDay(Number(e.target.value));
                    }}
                  />
                  {!dueDayTouched && (
                    <p className="text-xs text-muted-foreground">
                      Tự điền theo ngày bắt đầu — bạn có thể sửa
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Ai chịu thuế</Label>
                <RadioGroup
                  value={String(taxResp)}
                  onValueChange={(v) => setTaxResp(Number(v) as TaxResponsibilityCode)}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="1" id="t1" />
                    <Label htmlFor="t1" className="font-normal">
                      Chủ nhà
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="2" id="t2" />
                    <Label htmlFor="t2" className="font-normal">
                      Người thuê
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <Collapsible
                open={optionalOpen}
                onOpenChange={setOptionalOpen}
                className="rounded-lg border"
              >
                <CollapsibleTrigger className="group w-full flex items-center justify-between gap-3 p-3 text-left">
                  <div className="text-sm font-medium">Tuỳ chọn thêm</div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="p-3 pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tiền cọc</Label>
                      <CurrencyInput value={depositAmount} onChange={setDepositAmount} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Ngày tăng giá tiếp theo</Label>
                      <Input
                        type="date"
                        value={nextIncrease}
                        onChange={(e) => setNextIncrease(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ghi chú</Label>
                    <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <div className="flex items-center gap-2">
                <Checkbox id="act" checked={activate} onCheckedChange={(v) => setActivate(!!v)} />
                <Label htmlFor="act" className="font-normal">
                  Kích hoạt ngay sau khi tạo
                </Label>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                <Row label="Tài sản" value={selectedAsset?.name ?? "—"} />
                <Row
                  label="Phạm vi"
                  value={
                    effectiveScope === "unit"
                      ? (availableUnits.find((u) => u.id === assetUnitId)?.name ?? "—")
                      : "Nguyên căn"
                  }
                />
                <Row label="Chiều" value={CONTRACT_DIRECTION[effectiveDirection]} />
                <Row
                  label="Đối tác"
                  value={
                    contactsQ.data?.items.find((c) => c.id === counterpartyId)?.fullName ?? "—"
                  }
                />
                <Row label="Kỳ hạn" value={`${startDate} → ${endDate}`} />
                <Row label="Tiền thuê" value={rentAmount ? formatCurrency(rentAmount) : "—"} />
                <Row label="Chu kỳ" value={PAYMENT_CYCLE[paymentCycle]} />
                <Row label="Ngày trả" value={`Ngày ${paymentDueDay} mỗi kỳ`} />
                {depositAmount != null && (
                  <Row label="Tiền cọc" value={formatCurrency(depositAmount)} />
                )}
                <Row label="Ai chịu thuế" value={TAX_RESPONSIBILITY[taxResp]} />
                <Row label="Kích hoạt ngay" value={activate ? "Có" : "Không"} />
              </div>
              <div className="rounded-md border border-info/40 bg-info/10 p-3 text-sm flex gap-2 items-start">
                <Sparkles className="h-4 w-4 text-info shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Sau khi tạo, hệ thống sẽ tự động:</div>
                  <ul className="mt-1 text-muted-foreground list-disc list-inside space-y-0.5">
                    <li>Cập nhật trạng thái tài sản/phòng sang "Đang cho thuê"</li>
                    <li>
                      Tạo nhắc lịch thu/đóng tiền định kỳ và nhắc hết hạn hợp đồng (trước 30 ngày)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => (step === 0 ? navigate({ to: "/hop-dong" }) : setStep(step - 1))}
          disabled={create.isPending}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {step === 0 ? "Huỷ" : "Quay lại"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
            Tiếp
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Đang tạo..." : "Tạo hợp đồng"}
          </Button>
        )}
      </div>

      <QuickAddContactDialog
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        defaultType={suggestedType}
        onCreated={(c) => setCounterpartyId(c.id)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function QuickAddContactDialog({
  open,
  onOpenChange,
  defaultType,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType: ContactTypeCode;
  onCreated: (c: { id: string }) => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<ContactTypeCode>(defaultType);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const mut = useMutation({
    mutationFn: (b: ContactInput) => contactsApi.create(b),
    onSuccess: (created) => {
      toast.success("Đã thêm đối tác");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      onCreated(created);
      onOpenChange(false);
      setFullName("");
      setPhone("");
      setEmail("");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không thêm được đối tác")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm đối tác nhanh</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Loại</Label>
            <Select
              value={String(type)}
              onValueChange={(v) => setType(Number(v) as ContactTypeCode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {enumOptions(CONTACT_TYPE).map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Họ tên *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SĐT</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Huỷ
          </Button>
          <Button
            onClick={() => {
              if (!fullName.trim()) {
                toast.error("Vui lòng nhập họ tên");
                return;
              }
              mut.mutate({
                type,
                fullName: fullName.trim(),
                phone: phone.trim() || null,
                email: email.trim() || null,
              });
            }}
            disabled={mut.isPending}
          >
            {mut.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
