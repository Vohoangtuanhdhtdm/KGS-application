import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listingsApi,
  EMPTY_TERMS,
  type CreateListingDirectInput,
  type ListingImageDto,
  type ListingTermsDto,
} from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import {
  ASSET_TYPE,
  MODERATION_ACTION,
  MODERATION_REASON,
  PAYMENT_CYCLE,
  enumOptions,
  type PaymentCycleCode,
} from "@/constants/enums";
import { formatDateTime } from "@/lib/format";
import { ListingTermsFields } from "@/components/listings/ListingTermsFields";
import { VietnamAddressPicker } from "@/components/assets/VietnamAddressPicker";
import { CurrencyInput } from "@/components/CurrencyInput";
import { PriceSuggestion } from "@/components/listings/PriceSuggestion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Circle, ImagePlus, Loader2, Save, Send, X } from "lucide-react";

/**
 * ĐĂNG TIN — một biểu mẫu duy nhất.
 *
 * Luồng cũ bắt người dùng: tạo tài sản → upload ảnh vào thư viện tài sản → mở tab Tin
 * đăng → chọn ảnh → nhập giá → gửi. Ba màn hình, và họ phải học khái niệm "tài sản" mà
 * họ không quan tâm. Đó là di sản của thời quản lý tài sản còn là lõi sản phẩm.
 *
 * Nay: một trang. Asset vẫn được tạo phía sau từ chính dữ liệu địa chỉ, nhưng người đăng
 * không bao giờ nhìn thấy khái niệm đó.
 *
 * Backend chia làm ba bước (tạo nháp → thêm ảnh → gửi duyệt) chứ không phải một request
 * khổng lồ. Nhờ vậy ảnh tải lên có tiến trình thật, và bỏ dở giữa chừng thì bản nháp vẫn
 * còn nguyên thay vì mất trắng.
 */
// ?id= — soạn tiếp bản nháp hoặc sửa một tin đã đăng. Cùng một biểu mẫu cho cả hai:
// người dùng không cần học hai màn hình khác nhau cho cùng một việc.
export const Route = createFileRoute("/dang-tin")({
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s.id === "string" ? { id: s.id } : {},
  head: () => ({ meta: [{ title: "Đăng tin — KGS" }] }),
  component: CreateListingPage,
});

function CreateListingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { id: editingId } = Route.useSearch();
  const isEditing = !!editingId;

  // Bước 1 — nội dung tin
  const [type, setType] = useState<1 | 2>(2);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [cycle, setCycle] = useState<PaymentCycleCode>(1);

  // Bước 2 — bất động sản
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [propertyType, setPropertyType] = useState<number>(1);
  const [area, setArea] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [floors, setFloors] = useState("");

  // Bước 3 — điều kiện thuê
  const [terms, setTerms] = useState<ListingTermsDto>(EMPTY_TERMS);
  const [amenities, setAmenities] = useState<string[]>([]);

  // Bước 4 — ảnh. Chỉ tải lên được sau khi bản nháp đã tồn tại (cần listingId).
  const [draftId, setDraftId] = useState<string | null>(editingId ?? null);
  const [images, setImages] = useState<ListingImageDto[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Khoá phần thông tin bất động sản khi tài sản còn tin đăng khác — sửa ở đây sẽ
  // đổi luôn nội dung của những tin kia mà người dùng không hề biết.
  const [canEditProperty, setCanEditProperty] = useState(true);
  const [moderationNote, setModerationNote] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);

  const existingQ = useQuery({
    queryKey: ["listing-edit", editingId],
    queryFn: () => listingsApi.forEdit(editingId!),
    enabled: isEditing,
    retry: 1,
  });

  // Nạp một lần khi có dữ liệu. Dùng useEffect thay vì set thẳng trong thân render
  // để không ghi đè những gì người dùng vừa gõ ở các lần render sau.
  const loaded = useRef(false);
  useEffect(() => {
    const d = existingQ.data;
    if (!d || loaded.current) return;
    loaded.current = true;

    setType(d.type);
    setTitle(d.title);
    setDescription(d.description);
    setPrice(d.price);
    if (d.rentPaymentCycle) setCycle(d.rentPaymentCycle);
    setCity(d.city);
    setDistrict(d.district);
    setWard(d.ward);
    setAddressDetail(d.addressDetail);
    setPropertyType(d.propertyType);
    setArea(d.area?.toString() ?? "");
    setBedrooms(d.bedrooms?.toString() ?? "");
    setBathrooms(d.bathrooms?.toString() ?? "");
    setFloors(d.floors?.toString() ?? "");
    setTerms(d.terms);
    setAmenities(d.amenities);
    setImages(d.images);
    setCanEditProperty(d.canEditPropertyFields);
    setModerationNote(d.moderationNote);
    setStatus(d.status);
  }, [existingQ.data]);

  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  const buildBody = (): CreateListingDirectInput => ({
    type,
    title: title.trim(),
    description: description.trim(),
    price: price ?? 0,
    rentPaymentCycle: type === 2 ? cycle : null,
    city,
    district,
    ward,
    addressDetail: addressDetail.trim() || null,
    propertyType,
    area: num(area),
    bedrooms: num(bedrooms),
    bathrooms: num(bathrooms),
    floors: num(floors),
    terms,
    amenities,
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (draftId) {
        const b = buildBody();
        return listingsApi.update(draftId, {
          title: b.title,
          description: b.description,
          price: b.price,
          rentPaymentCycle: b.rentPaymentCycle,
          terms: b.terms,
          amenities: b.amenities,
          // Chỉ gửi phần vật lý khi được phép sửa; backend cũng tự bỏ qua nếu tài
          // sản còn tin khác, nhưng không gửi thì rõ ràng hơn.
          ...(canEditProperty
            ? {
                city: b.city,
                district: b.district,
                ward: b.ward,
                addressDetail: b.addressDetail,
                propertyType: b.propertyType,
                area: b.area,
                bedrooms: b.bedrooms,
                bathrooms: b.bathrooms,
                floors: b.floors,
              }
            : {}),
        });
      }
      return listingsApi.createDirect(buildBody());
    },
    onSuccess: (l) => {
      setDraftId(l.id);
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      toast.success(draftId ? "Đã lưu thay đổi" : "Đã lưu nháp", {
        description: draftId ? undefined : "Giờ bạn có thể thêm ảnh.",
      });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không lưu được")),
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => listingsApi.addImages(draftId!, files),
    onSuccess: (list) => setImages(list),
    onError: (e) => toast.error(getErrorMessage(e, "Không tải được ảnh lên")),
  });

  const removeImage = useMutation({
    mutationFn: (imageId: string) => listingsApi.removeImage(draftId!, imageId),
    onSuccess: (_, imageId) => setImages((prev) => prev.filter((i) => i.id !== imageId)),
    onError: (e) => toast.error(getErrorMessage(e, "Không xoá được ảnh")),
  });

  const submit = useMutation({
    mutationFn: () => listingsApi.submit(draftId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      toast.success("Đã gửi tin đi duyệt", {
        description: "Tin sẽ hiển thị công khai sau khi quản trị viên duyệt.",
      });
      navigate({ to: "/tin-cua-toi" });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không gửi được tin")),
  });

  const contentReady =
    title.trim().length >= 10 &&
    description.trim().length >= 30 &&
    (price ?? 0) > 0 &&
    !!city &&
    !!district &&
    !!ward;

  const busy = saveDraft.isPending || upload.isPending || submit.isPending;

  /**
   * Còn thiếu gì để gửi duyệt được.
   *
   * Nút "Gửi duyệt" trước đây bị vô hiệu hoá mà không nói vì sao, ở cuối một biểu mẫu dài
   * hơn hai màn hình. Người dùng điền xong, cuộn xuống, thấy nút xám và không có cách nào
   * biết mình thiếu gì — dòng gợi ý duy nhất thì nằm trong một thẻ khác ở tít trên, lại
   * không hề nhắc tới yêu cầu về ảnh. Danh sách này liệt kê ĐÚNG những thứ còn thiếu, và
   * đặt ngay cạnh nút.
   */
  /* Bốn mục của biểu mẫu, kèm việc mục đó đã đủ chưa. "Chi phí & điều kiện" không bắt buộc
     — đánh dấu nó là thiếu sót sẽ nói sai với người dùng rằng họ chưa được gửi duyệt. */
  const tienDo = [
    {
      id: "muc-noi-dung",
      nhan: "Nội dung tin",
      batBuoc: true,
      xong: title.trim().length >= 10 && description.trim().length >= 30 && (price ?? 0) > 0,
    },
    {
      id: "muc-bat-dong-san",
      nhan: "Thông tin bất động sản",
      batBuoc: true,
      xong: !!city && !!district && !!ward,
    },
    {
      id: "muc-chi-phi",
      nhan: "Chi phí & điều kiện",
      batBuoc: false,
      xong: true,
    },
    {
      id: "muc-hinh-anh",
      nhan: "Hình ảnh",
      batBuoc: true,
      xong: images.length > 0,
    },
  ];

  /**
   * Nhảy tới một mục của biểu mẫu.
   *
   * Tính toạ độ rồi gọi window.scrollTo, thay vì scrollIntoView. Lý do đo được trên trình
   * duyệt: cả `scrollIntoView({behavior:"smooth"})` LẪN `scroll-behavior: smooth` trong CSS
   * đều là no-op ở một số ngữ cảnh nhúng — bấm nút thì scrollY giữ nguyên 0 và không có gì
   * xảy ra. Một nút điều hướng im lặng không làm gì là kiểu hỏng tệ nhất, nên ở đây chọn
   * cách luôn chạy và chấp nhận mất hiệu ứng mượt.
   *
   * Trừ đi 96px cho header dính (56) cộng thanh tiến độ (~40) — không trừ thì tiêu đề mục
   * nằm ngay dưới hai thanh đó và bị che mất.
   */
  const nhayToiMuc = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96 });
  };

  const thieuDeGuiDuyet: string[] = [];
  if (title.trim().length < 10) thieuDeGuiDuyet.push("tiêu đề từ 10 ký tự");
  if (description.trim().length < 30) thieuDeGuiDuyet.push("mô tả từ 30 ký tự");
  if ((price ?? 0) <= 0) thieuDeGuiDuyet.push("giá");
  if (!city || !district || !ward) thieuDeGuiDuyet.push("tỉnh/thành, quận/huyện và phường/xã");
  if (!draftId) thieuDeGuiDuyet.push("lưu nháp một lần");
  if (images.length === 0) thieuDeGuiDuyet.push("ít nhất 1 ảnh");

  return (
    <div className="mx-auto max-w-[820px] p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEditing ? "Sửa tin đăng" : "Đăng tin"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isEditing
            ? "Sửa xong bấm Lưu thay đổi, rồi gửi duyệt lại."
            : "Điền một lần rồi gửi duyệt. Bản nháp được lưu lại nên bạn có thể quay lại sau."}
        </p>
      </div>

      {/* Thanh tiến độ.
          Biểu mẫu này dài hơn hai màn hình, và trước đây không có gì cho biết còn bao nhiêu
          nữa, mục nào đã xong, hay mục nào đang thiếu — người dùng chỉ có thể cuộn và đoán.

          Chọn thanh tiến độ dính thay vì chia thành wizard nhiều bước: wizard buộc phải đổi
          cấu trúc state và tách validate theo từng bước, mà luồng lưu nháp / gửi duyệt hiện
          tại đang chạy đúng. Thanh này cho đúng thứ wizard cho — biết mình đang ở đâu và còn
          thiếu gì — mà không đụng vào phần đang chạy. */}
      <div className="sticky top-14 z-20 -mx-6 border-y bg-background/95 px-6 py-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {tienDo.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => nhayToiMuc(m.id)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent"
            >
              {m.xong ? (
                <CheckCircle2 className="h-4 w-4 text-price" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/50" />
              )}
              <span className={m.xong ? "text-foreground" : "text-muted-foreground"}>
                {m.nhan}
              </span>
              {!m.batBuoc && <span className="text-xs text-muted-foreground">(tuỳ chọn)</span>}
              {i < tienDo.length - 1 && (
                <span aria-hidden="true" className="ml-1 text-muted-foreground/40">
                  ›
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Kết quả kiểm duyệt: phải hiện ngay đầu trang, cạnh chỗ sửa. Đặt nó ở màn hình
          khác đồng nghĩa với việc người dùng sửa mà không nhớ mình sai gì. */}
      {(status === 3 || status === 6) && (
        <div
          className={`rounded-lg border p-4 flex gap-3 ${
            status === 6
              ? "border-warning/40 bg-warning/10"
              : "border-destructive/40 bg-destructive/5"
          }`}
        >
          <AlertCircle
            className={`h-5 w-5 shrink-0 mt-0.5 ${
              status === 6 ? "text-warning-foreground" : "text-destructive"
            }`}
          />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium">
              {status === 6 ? "Tin cần chỉnh sửa trước khi đăng" : "Tin đã bị từ chối"}
            </p>
            {moderationNote && (
              <p className="text-sm text-muted-foreground">{moderationNote}</p>
            )}
            {status === 6 && (
              <p className="text-sm text-muted-foreground">
                Tin không bị xoá. Sửa xong bấm Gửi duyệt lại ở cuối trang.
              </p>
            )}
          </div>
        </div>
      )}

      {draftId && <LichSuKiemDuyet listingId={draftId} />}

      {/* ---------- Loại tin ---------- */}
      <Card id="muc-noi-dung" className="scroll-mt-28">
        <CardContent className="p-5 space-y-4">
          <Field label="Bạn muốn đăng tin">
            <Tabs value={String(type)} onValueChange={(v) => setType(Number(v) as 1 | 2)}>
              <TabsList>
                <TabsTrigger value="2">Cho thuê</TabsTrigger>
                <TabsTrigger value="1">Bán</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>

          <Field label="Tiêu đề" hint="Ít nhất 10 ký tự. Nêu rõ loại hình, khu vực và điểm nổi bật.">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Phòng trọ 25m² có gác, hẻm yên tĩnh Quận Bình Thạnh"
              maxLength={200}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={type === 2 ? "Giá thuê" : "Giá bán"}>
              <CurrencyInput value={price} onChange={setPrice} />
            </Field>
            {type === 2 && (
              <Field label="Chu kỳ thanh toán">
                <Select value={String(cycle)} onValueChange={(v) => setCycle(Number(v) as PaymentCycleCode)}>
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
              </Field>
            )}
          </div>

          {/* Chỉ tin BÁN. Mô hình huấn luyện trên tin rao bán — dùng nó cho giá thuê sẽ cho
              ra con số sai hàng nghìn lần, và một gợi ý sai kiểu đó tệ hơn không gợi ý. */}
          {type === 1 && (
            <PriceSuggestion
              currentPrice={price}
              input={
                Number(area) > 0 && city.trim() && district.trim()
                  ? {
                      area: Number(area),
                      city: city.trim(),
                      district: district.trim(),
                      ward: ward.trim() || null,
                      bedrooms: bedrooms ? Number(bedrooms) : null,
                      bathrooms: bathrooms ? Number(bathrooms) : null,
                      floors: floors ? Number(floors) : null,
                    }
                  : null
              }
            />
          )}

          <Field
            label="Mô tả"
            hint="Ít nhất 30 ký tự. Càng tả rõ không gian và khu vực, tin càng dễ được tìm thấy."
          >
            <Textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả phòng, khu vực xung quanh, ai sẽ hợp ở đây..."
            />
          </Field>
        </CardContent>
      </Card>

      {/* ---------- Bất động sản ---------- */}
      <Card id="muc-bat-dong-san" className="scroll-mt-28">
        <CardContent className="p-5 space-y-4">
          <h2 className="font-medium">Thông tin bất động sản</h2>

          {!canEditProperty && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              Địa chỉ này còn tin đăng khác nên phần dưới đang khoá — sửa ở đây sẽ đổi
              luôn nội dung của những tin kia.
            </div>
          )}

          <fieldset disabled={!canEditProperty} className="space-y-4 disabled:opacity-60">
          <VietnamAddressPicker
            city={city}
            district={district}
            ward={ward}
            onChange={(v) => {
              setCity(v.city);
              setDistrict(v.district);
              setWard(v.ward);
            }}
          />

          <Field label="Địa chỉ chi tiết" hint="Số nhà, tên đường. Không bắt buộc.">
            <Input
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              placeholder="Ví dụ: 45/12 Điện Biên Phủ"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Loại hình">
              <Select value={String(propertyType)} onValueChange={(v) => setPropertyType(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumOptions(ASSET_TYPE).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Diện tích (m²)">
              <Input type="number" min={0} value={area} onChange={(e) => setArea(e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Phòng ngủ">
              <Input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
            </Field>
            <Field label="Phòng tắm">
              <Input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
            </Field>
            <Field label="Số tầng">
              <Input type="number" min={0} value={floors} onChange={(e) => setFloors(e.target.value)} />
            </Field>
          </div>
          </fieldset>
        </CardContent>
      </Card>

      {/* ---------- Điều kiện thuê ---------- */}
      <Card id="muc-chi-phi" className="scroll-mt-28">
        <CardContent className="p-5 space-y-4">
          <h2 className="font-medium">Chi phí &amp; điều kiện</h2>
          <ListingTermsFields
            value={terms}
            onChange={setTerms}
            amenities={amenities}
            onAmenitiesChange={setAmenities}
            isRent={type === 2}
          />
        </CardContent>
      </Card>

      {/* ---------- Ảnh ---------- */}
      <Card id="muc-hinh-anh" className="scroll-mt-28">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-medium">Hình ảnh</h2>
            <span className="text-xs text-muted-foreground">{images.length}/20 ảnh</span>
          </div>

          {!draftId ? (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Lưu nháp trước rồi mới tải ảnh lên được — ảnh cần gắn với một tin cụ thể.
              </p>
              <Button
                variant="outline"
                disabled={!contentReady || busy}
                onClick={() => saveDraft.mutate()}
              >  {/* eslint-disable-line */}
                {saveDraft.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4 mr-1.5" />
                )}
                Lưu nháp để thêm ảnh
              </Button>
              {!contentReady && (
                <p className="text-xs text-muted-foreground">
                  Còn thiếu: {thieuDeGuiDuyet.filter((t) => t !== "lưu nháp một lần" && t !== "ít nhất 1 ảnh").join(", ")}.
                </p>
              )}
            </div>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) upload.mutate(files);
                  e.target.value = "";
                }}
              />

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative aspect-square rounded-md overflow-hidden border group">
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Xoá ảnh"
                      onClick={() => removeImage.mutate(img.id)}
                      className="absolute top-1 right-1 rounded-full bg-background/90 p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {images.length < 20 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={upload.isPending}
                    className="aspect-square rounded-md border border-dashed grid place-items-center text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    {upload.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-5 w-5" />
                    )}
                  </button>
                )}
              </div>

              {images.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Cần ít nhất 1 ảnh mới gửi duyệt được. Tin có ảnh thật được xem nhiều hơn hẳn.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- Gửi ---------- */}
      <div className="flex items-center gap-3 flex-wrap">
        {draftId && (
          <Button variant="outline" size="lg" disabled={busy} onClick={() => saveDraft.mutate()}>
            {saveDraft.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Lưu thay đổi
          </Button>
        )}

        <Button
          size="lg"
          disabled={!draftId || images.length === 0 || busy}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1.5" />
          )}
          {status === 3 ? "Gửi duyệt lại" : "Gửi duyệt"}
        </Button>

        {thieuDeGuiDuyet.length > 0 && (
          <p className="basis-full text-xs text-muted-foreground">
            Chưa gửi duyệt được — còn thiếu: {thieuDeGuiDuyet.join(", ")}.
          </p>
        )}

        {draftId && (
          <Button variant="ghost" onClick={() => navigate({ to: "/tin-cua-toi" })} disabled={busy}>
            Để sau
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Tin sẽ hiển thị công khai sau khi quản trị viên duyệt.
        </p>
      </div>
    </div>
  );
}

/**
 * Nhãn + ô nhập.
 *
 * Nhãn phải NỐI được với ô nhập, không chỉ nằm cạnh nó. Trước đây <Label> không có
 * htmlFor và ô nhập không có id, nên bấm vào nhãn không đưa được con trỏ vào ô, và trình
 * đọc màn hình đọc ra một ô "không tên". Ở đây sinh một id, gắn cho ô nhập bằng
 * cloneElement rồi trỏ nhãn vào đó — chỗ dùng không phải thay đổi gì.
 */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  // Chỉ gắn được id khi con là MỘT phần tử React. Nếu không phải, giữ nguyên hành vi cũ
  // thay vì hỏng — nhãn vẫn hiện, chỉ là không nối được.
  const control =
    isValidElement(children) && !(children.props as { id?: string }).id
      ? cloneElement(children as ReactElement<{ id?: string; "aria-describedby"?: string }>, {
          id,
          "aria-describedby": hintId,
        })
      : children;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={isValidElement(children) ? id : undefined}>{label}</Label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Lịch sử kiểm duyệt của tin, hiện cho CHỦ TIN.
 *
 * Trước đây chủ tin chỉ thấy đúng một dòng — `ModerationNote` của lần gần nhất, vì trường
 * đó bị ghi đè mỗi vòng. Tin đi qua ba vòng thì họ không nhớ nổi lần một mình sai chỗ nào,
 * và cũng không có cách nào kiểm chứng rằng mình đã sửa đủ.
 *
 * KHÔNG hiện tên người duyệt — chủ tin cần biết tin của mình đã qua những gì và phải sửa
 * gì, không cần biết ai đã bấm nút.
 */
function LichSuKiemDuyet({ listingId }: { listingId: string }) {
  const query = useQuery({
    queryKey: ["moderation-history", listingId],
    queryFn: () => listingsApi.moderationHistory(listingId),
    retry: 1,
  });

  const rows = query.data ?? [];
  // Tin chưa qua vòng nào thì không dựng khối rỗng — nó chỉ thêm nhiễu cho người đăng lần đầu.
  if (rows.length === 0) return null;

  return (
    <details className="rounded-lg border bg-card px-4 py-3">
      <summary className="cursor-pointer select-none text-sm font-medium">
        Lịch sử kiểm duyệt ({rows.length} lượt)
      </summary>
      <ol className="mt-3 space-y-3">
        {rows.map((e, i) => (
          <li key={`${e.round}-${i}`} className="flex gap-3 text-sm">
            <span className="font-mono text-xs text-muted-foreground pt-0.5 shrink-0">
              #{e.round}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{MODERATION_ACTION[e.action] ?? e.action}</p>
              {e.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {e.reasons.map((r) => (
                    <span
                      key={r}
                      className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-xs"
                    >
                      {MODERATION_REASON[r] ?? r}
                    </span>
                  ))}
                </div>
              )}
              {e.note && <p className="text-muted-foreground">{e.note}</p>}
              <p className="text-xs text-muted-foreground/80">{formatDateTime(e.createdAt)}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
