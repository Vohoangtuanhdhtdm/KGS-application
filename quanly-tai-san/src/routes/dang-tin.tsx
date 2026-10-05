import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listingsApi,
  EMPTY_TERMS,
  type CreateListingDirectInput,
  type ListingImageDto,
  type ListingTermsDto,
  type PublicListingSummaryDto,
} from "@/lib/api/listings";
import { assistantApi } from "@/lib/api/assistant";
import { buildingsApi, type OwnerBuilding, type OwnerBuildingUnit } from "@/lib/api/buildings";
import { getErrorMessage } from "@/lib/api/errors";
import {
  AMENITIES,
  AMENITY_LIST,
  ASSET_TYPE,
  FURNITURE_STATE_OPTIONS,
  HOUSE_DIRECTIONS,
  LEGAL_STATUS_OPTIONS,
  TYPE_FIELDS,
  type AmenityKey,
  type AssetTypeCode,
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
import { LocationPinField, type LatLngValue } from "@/components/listings/LocationPinField";
import { PropertyListCard } from "@/components/public/PropertyListCard";
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
import {
  AlertCircle,
  BedDouble,
  Briefcase,
  Building2,
  Castle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  House,
  ImagePlus,
  LandPlot,
  Loader2,
  Save,
  Send,
  Shapes,
  ShoppingBag,
  Sparkles,
  Store,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * ĐĂNG TIN — bốn bước ngắn thay cho một biểu mẫu dài hai màn hình.
 *
 *   1. Loại & vị trí   — cho thuê/bán, loại hình, địa chỉ (ghim bản đồ nên có).
 *   2. Thông số & giá  — CHỈ những trường có nghĩa với loại hình đã chọn, chọn bằng chip.
 *   3. Ảnh & mô tả     — bản nháp đã được tạo ngầm khi rời bước 2, nên tải ảnh được ngay;
 *                        tiêu đề và mô tả được soạn sẵn từ thông số, hoặc nhờ AI viết.
 *   4. Chi phí & gửi   — cọc, điện nước, nội quy: không bắt buộc, gửi duyệt ở đây.
 *
 * Người đăng chỉ thật sự PHẢI nhập: loại hình, địa chỉ, diện tích, giá và một ảnh. Tiêu đề
 * và mô tả — hai ô tốn công nhất của biểu mẫu cũ — luôn có sẵn một bản đúng sự thật dựng từ
 * thông số; người đăng sửa thêm nếu muốn.
 *
 * Bên phải là thẻ tin y hệt thẻ ở trang Tìm nhà, cập nhật theo từng phím gõ, cùng điểm độ
 * đầy đủ — người đăng thấy ngay tin của mình sẽ trông thế nào và còn thiếu gì.
 *
 * Backend vẫn ba bước (tạo nháp → thêm ảnh → gửi duyệt): bỏ dở giữa chừng thì bản nháp còn
 * nguyên ở "Tin của tôi".
 */
// ?id= — soạn tiếp bản nháp hoặc sửa một tin đã đăng. Cùng một trang cho cả hai.
// ?toaNha=&can= — đăng cho một căn trong toà nhà (từ trang Toà nhà, nút "Đăng tin căn này").
export const Route = createFileRoute("/dang-tin")({
  validateSearch: (s: Record<string, unknown>): { id?: string; toaNha?: string; can?: string } => ({
    id: typeof s.id === "string" ? s.id : undefined,
    toaNha: typeof s.toaNha === "string" ? s.toaNha : undefined,
    can: typeof s.can === "string" ? s.can : undefined,
  }),
  head: () => ({ meta: [{ title: "Đăng tin — KGS" }] }),
  component: CreateListingPage,
});

const STEPS = [
  { nhan: "Loại & vị trí", ngan: "Vị trí" },
  { nhan: "Thông số & giá", ngan: "Thông số" },
  { nhan: "Ảnh & mô tả", ngan: "Ảnh" },
  { nhan: "Chi phí & gửi", ngan: "Gửi" },
] as const;

const TYPE_ORDER: AssetTypeCode[] = [7, 2, 1, 5, 4, 3, 6, 8, 9, 99];
const TYPE_ICONS: Record<AssetTypeCode, LucideIcon> = {
  1: House,
  2: Building2,
  3: LandPlot,
  4: Castle,
  5: Store,
  6: Briefcase,
  7: BedDouble,
  8: ShoppingBag,
  9: Warehouse,
  99: Shapes,
};

/** Gợi ý điểm nổi bật cho trợ lý viết. Người đăng chọn — mô hình không được tự thêm. */
const HIGHLIGHTS_RENT = [
  "Yên tĩnh",
  "An ninh",
  "Gần chợ",
  "Gần trường học",
  "Gần trung tâm",
  "Hẻm rộng",
  "Mới sửa",
  "Thoáng mát",
  "Chủ thân thiện",
  "Giờ giấc tự do",
];
const HIGHLIGHTS_SALE = [
  "Sổ sẵn, công chứng ngay",
  "Hẻm xe hơi",
  "Mặt tiền kinh doanh",
  "Khu dân trí cao",
  "Gần trường học",
  "Gần trung tâm",
  "Nở hậu",
  "Mới xây",
  "Thoáng mát",
  "Giá thương lượng",
];

/** Trạng thái cho phép tự lưu ngầm: tin chưa hiển thị công khai. Sửa tin đang hiển thị sẽ
 *  đưa tin về chờ duyệt (xem ListingService.UpdateAsync) — việc đó phải là một cú bấm có
 *  chủ ý, không được xảy ra chỉ vì người dùng chuyển bước. */
const AUTOSAVE_STATUSES = [null, 3, 5, 6];
const SUBMITTABLE_STATUSES = [null, 3, 5, 6];

function CreateListingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { id: editingId, toaNha, can } = Route.useSearch();
  const isEditing = !!editingId;

  const [step, setStep] = useState(0);
  // Bước xa nhất đã tới — các bước tới đó bấm được trên thanh bước.
  const [reached, setReached] = useState(0);

  const [type, setType] = useState<1 | 2>(2);
  const [propertyType, setPropertyType] = useState<number>(7);
  // Chưa tự chọn loại hình thì đổi Cho thuê/Bán sẽ đổi luôn mặc định (phòng trọ / nhà riêng).
  const typeTouched = useRef(false);

  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [pin, setPin] = useState<LatLngValue | null>(null);

  const [area, setArea] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [floors, setFloors] = useState("");
  const [frontage, setFrontage] = useState("");
  const [houseDirection, setHouseDirection] = useState("");
  const [legalStatus, setLegalStatus] = useState("");
  const [furnitureState, setFurnitureState] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [cycle, setCycle] = useState<PaymentCycleCode>(1);
  const [amenities, setAmenities] = useState<string[]>([]);

  // Tiêu đề/mô tả: chừng nào người đăng chưa tự gõ, giá trị hiển thị là bản soạn từ thông số
  // và đi theo mọi thay đổi ở bước trước. Gõ một phím (hoặc nhận bản AI) là thành của họ.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [autoTitle, setAutoTitle] = useState(true);
  const [autoDescription, setAutoDescription] = useState(true);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const [terms, setTerms] = useState<ListingTermsDto>(EMPTY_TERMS);

  const [draftId, setDraftId] = useState<string | null>(editingId ?? null);
  const [images, setImages] = useState<ListingImageDto[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const [canEditProperty, setCanEditProperty] = useState(true);

  // Đăng cho MỘT CĂN trong toà nhà của mình: địa chỉ, vị trí, loại hình là của toà nhà, và tin
  // hiện đúng chỗ trên mô hình 3D. Sửa tin có sẵn của một căn: chỉ hiện nhãn căn.
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [editUnit, setEditUnit] = useState<{ assetName: string | null; unitName: string } | null>(
    null,
  );
  const buildingsQ = useQuery({
    queryKey: ["owner-buildings"],
    queryFn: buildingsApi.mine,
    enabled: !isEditing,
    retry: 0,
  });
  const buildings = buildingsQ.data ?? [];
  const building = buildings.find((b) => b.assetId === buildingId) ?? null;
  const unit = building?.units.find((u) => u.id === unitId) ?? null;
  const inBuilding = !!building || !!editUnit;
  const [moderationNote, setModerationNote] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);

  const existingQ = useQuery({
    queryKey: ["listing-edit", editingId],
    queryFn: () => listingsApi.forEdit(editingId!),
    enabled: isEditing,
    retry: 1,
  });

  // Nạp một lần — không ghi đè những gì người dùng gõ ở các lần render sau.
  const loaded = useRef(false);
  useEffect(() => {
    const d = existingQ.data;
    if (!d || loaded.current) return;
    loaded.current = true;
    typeTouched.current = true;

    setType(d.type);
    setTitle(d.title);
    setDescription(d.description);
    setAutoTitle(false);
    setAutoDescription(false);
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
    setFrontage(d.frontage?.toString() ?? "");
    setHouseDirection(d.houseDirection ?? "");
    setLegalStatus(d.legalStatus ?? "");
    setFurnitureState(d.furnitureState ?? "");
    if (d.latitude != null && d.longitude != null) setPin({ lat: d.latitude, lng: d.longitude });
    setTerms(d.terms);
    setAmenities(d.amenities);
    setImages(d.images);
    setCanEditProperty(d.canEditPropertyFields);
    if (d.assetUnitId && d.unitName) setEditUnit({ assetName: d.assetName, unitName: d.unitName });
    setModerationNote(d.moderationNote);
    setStatus(d.status);
    // Sửa tin có sẵn: mọi bước đều đã có dữ liệu, cho nhảy tự do.
    setReached(STEPS.length - 1);
  }, [existingQ.data]);

  const pickBuilding = (b: OwnerBuilding | null) => {
    setBuildingId(b?.assetId ?? null);
    setUnitId(null);
    if (!b) return;
    typeTouched.current = true;
    setPropertyType(b.propertyType);
    setCity(b.city);
    setDistrict(b.district);
    setWard(b.ward);
    setAddressDetail(b.addressDetail);
    if (b.latitude != null && b.longitude != null) setPin({ lat: b.latitude, lng: b.longitude });
  };
  const pickUnit = (u: OwnerBuildingUnit) => {
    setUnitId(u.id);
    if (u.area) setArea(String(u.area));
  };

  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || isEditing || !toaNha || !buildingsQ.data) return;
    prefilled.current = true;
    const b = buildingsQ.data.find((x) => x.assetId === toaNha);
    if (!b) return;
    pickBuilding(b);
    const u = b.units.find((x) => x.id === can && x.listingId == null);
    if (u) pickUnit(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingsQ.data]);

  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  /* Trường nào có nghĩa với loại hình đang chọn. Trường bị ẩn thì KHÔNG gửi lên — giá trị cũ
     còn sót trong state (chọn nhà phố, gõ mặt tiền, rồi đổi sang phòng trọ) không được lọt
     vào tin. Pháp lý chỉ hỏi với tin BÁN. */
  const NO_FIELDS = {
    rooms: false,
    floors: false,
    frontage: false,
    direction: false,
    legal: false,
    furniture: false,
  };
  // Một căn trong toà nhà: đặc điểm chung (số tầng, hướng, pháp lý…) là của TOÀ NHÀ — không
  // hỏi lại ở từng tin, và không để một tin ghi đè lên toà nhà.
  const fields = inBuilding
    ? NO_FIELDS
    : TYPE_FIELDS[(propertyType in TYPE_FIELDS ? propertyType : 99) as AssetTypeCode];
  const showLegal = fields.legal && type === 1;
  const shown = <T,>(on: boolean, v: T): T | null => (on ? v : null);

  const typeLabel = ASSET_TYPE[(propertyType in ASSET_TYPE ? propertyType : 99) as AssetTypeCode];
  const amenityLabels = amenities.map((a) => AMENITIES[a as AmenityKey] ?? a);

  const facts = {
    verb: type === 2 ? "Cho thuê" : "Bán",
    typeLabel,
    area: num(area),
    bedrooms: shown(fields.rooms, num(bedrooms)),
    bathrooms: shown(fields.rooms, num(bathrooms)),
    floors: shown(fields.floors, num(floors)),
    frontage: shown(fields.frontage, num(frontage)),
    direction: shown(fields.direction, houseDirection || null),
    legal: shown(showLegal, legalStatus || null),
    furniture: shown(fields.furniture, furnitureState || null),
    addressDetail: addressDetail.trim(),
    ward,
    district,
    city,
    amenityLabels,
    highlights,
    unitName: unit?.name ?? editUnit?.unitName ?? null,
    unitFloor: unit?.floor ?? null,
  };
  const titleValue = autoTitle ? suggestTitle(facts) : title;
  const descriptionValue = autoDescription ? suggestDescription(facts) : description;

  const buildBody = (): CreateListingDirectInput => ({
    type,
    title: titleValue.trim(),
    description: descriptionValue.trim(),
    price: price ?? 0,
    rentPaymentCycle: type === 2 ? cycle : null,
    city,
    district,
    ward,
    addressDetail: addressDetail.trim() || null,
    propertyType,
    area: facts.area,
    bedrooms: facts.bedrooms,
    bathrooms: facts.bathrooms,
    floors: facts.floors,
    frontage: facts.frontage,
    houseDirection: facts.direction,
    legalStatus: facts.legal,
    furnitureState: facts.furniture,
    latitude: pin?.lat ?? null,
    longitude: pin?.lng ?? null,
    terms,
    amenities,
    assetId: building?.assetId ?? null,
    assetUnitId: unit?.id ?? null,
  });

  const saveDraft = useMutation({
    mutationFn: async (_opts: { silent: boolean }) => {
      const b = buildBody();
      if (draftId) {
        return listingsApi.update(draftId, {
          title: b.title,
          description: b.description,
          price: b.price,
          rentPaymentCycle: b.rentPaymentCycle,
          terms: b.terms,
          amenities: b.amenities,
          // Chỉ gửi phần vật lý khi được phép sửa (tài sản không còn tin khác). Tin của một căn
          // KHÔNG BAO GIỜ gửi: sửa ở đây là sửa cả toà nhà.
          ...(canEditProperty && !inBuilding
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
                frontage: b.frontage,
                houseDirection: b.houseDirection,
                legalStatus: b.legalStatus,
                furnitureState: b.furnitureState,
                // Chưa ghim thì không gửi: null ở đây nghĩa là "giữ nguyên", không phải "xoá".
                ...(pin ? { latitude: pin.lat, longitude: pin.lng } : {}),
              }
            : {}),
        });
      }
      return listingsApi.createDirect(b);
    },
    onSuccess: (l, { silent }) => {
      setDraftId(l.id);
      setStatus(l.status);
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      if (!silent) toast.success("Đã lưu");
    },
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

  const writer = useMutation({
    mutationFn: () =>
      assistantApi.writeListing({
        type,
        propertyType,
        city: city || null,
        district: district || null,
        ward: ward || null,
        addressDetail: facts.addressDetail || null,
        area: facts.area,
        bedrooms: facts.bedrooms,
        bathrooms: facts.bathrooms,
        floors: facts.floors,
        frontage: facts.frontage,
        houseDirection: facts.direction,
        legalStatus: facts.legal,
        furnitureState: facts.furniture,
        price,
        amenities: amenityLabels,
        highlights,
        notes: notes.trim() || null,
      }),
    onSuccess: (r) => {
      setTitle(r.title);
      setDescription(r.description);
      setAutoTitle(false);
      setAutoDescription(false);
      toast.success("AI đã viết xong", { description: "Đọc lại và sửa nếu cần trước khi gửi." });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Trợ lý viết tin đang bận, thử lại sau")),
  });

  const submit = useMutation({
    mutationFn: async () => {
      await saveDraft.mutateAsync({ silent: true });
      return listingsApi.submit(draftId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      toast.success("Đã gửi tin đi duyệt", {
        description: "Tin sẽ hiển thị công khai sau khi quản trị viên duyệt.",
      });
      navigate({ to: "/tin-cua-toi" });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không gửi được tin")),
  });

  const busy = saveDraft.isPending || upload.isPending || submit.isPending;
  const canAutosave = AUTOSAVE_STATUSES.includes(status);
  const canSubmit = SUBMITTABLE_STATUSES.includes(status);

  /* Điều kiện để rời từng bước. Chỉ chặn những gì backend chặn — mọi thứ khác là gợi ý. */
  const stepProblems = (i: number): string[] => {
    const out: string[] = [];
    if (i === 0 && (!city || !district || !ward))
      out.push("chọn tỉnh/thành, quận/huyện, phường/xã");
    if (i === 0 && building && !unit) out.push("chọn căn trong toà nhà");
    if (i === 1) {
      if (!(Number(area) > 0)) out.push("nhập diện tích");
      if (!((price ?? 0) > 0)) out.push("nhập giá");
    }
    if (i === 2) {
      if (titleValue.trim().length < 10) out.push("tiêu đề từ 10 ký tự");
      if (descriptionValue.trim().length < 30) out.push("mô tả từ 30 ký tự");
    }
    return out;
  };

  const goTo = async (target: number) => {
    if (target === step || busy) return;
    if (target > step) {
      for (let i = step; i < target; i++) {
        const p = stepProblems(i);
        if (p.length) {
          setStep(i);
          toast.error(`Bước ${i + 1}: còn thiếu ${p.join(", ")}`);
          return;
        }
      }
      // Rời bước 2 lần đầu: tạo bản nháp ngầm để bước ảnh tải lên được ngay. Các lần sau:
      // tự lưu, nên đóng tab giữa chừng cũng không mất gì.
      if (target >= 2 && (!draftId || canAutosave)) {
        try {
          await saveDraft.mutateAsync({ silent: true });
        } catch (e) {
          toast.error(getErrorMessage(e, "Không lưu được bản nháp"));
          return;
        }
      }
    }
    setStep(target);
    setReached((r) => Math.max(r, target));
    window.scrollTo({ top: 0 });
  };

  /* Điểm độ đầy đủ: phần bắt buộc + những gì làm tin được tìm thấy và được tin tưởng hơn. */
  const checks: { nhan: string; xong: boolean; batBuoc: boolean; buoc: number }[] = [
    { nhan: "Địa chỉ", xong: !!city && !!district && !!ward, batBuoc: true, buoc: 0 },
    { nhan: "Ghim trên bản đồ", xong: !!pin, batBuoc: false, buoc: 0 },
    { nhan: "Diện tích & giá", xong: Number(area) > 0 && (price ?? 0) > 0, batBuoc: true, buoc: 1 },
    {
      nhan: "Thông số chi tiết",
      xong:
        (!fields.rooms || !!bedrooms) &&
        (!fields.floors || !!floors) &&
        (!fields.direction || !!houseDirection) &&
        (!fields.furniture || !!furnitureState),
      batBuoc: false,
      buoc: 1,
    },
    { nhan: "Từ 3 tiện nghi", xong: amenities.length >= 3, batBuoc: false, buoc: 1 },
    { nhan: "Ít nhất 1 ảnh", xong: images.length > 0, batBuoc: true, buoc: 2 },
    { nhan: "Từ 5 ảnh", xong: images.length >= 5, batBuoc: false, buoc: 2 },
    {
      nhan: "Mô tả từ 300 ký tự",
      xong: descriptionValue.trim().length >= 300,
      batBuoc: false,
      buoc: 2,
    },
    ...(type === 2
      ? [
          {
            nhan: "Tiền cọc & điện nước",
            xong: terms.depositMonths != null && terms.electricityPrice != null,
            batBuoc: false,
            buoc: 3,
          },
        ]
      : []),
  ];
  const score = Math.round((checks.filter((c) => c.xong).length / checks.length) * 100);

  const missingForSubmit = [0, 1, 2].flatMap(stepProblems);
  if (images.length === 0) missingForSubmit.push("ít nhất 1 ảnh");

  const preview: PublicListingSummaryDto = {
    id: draftId ?? "preview",
    slug: "preview",
    title: titleValue.trim() || `${facts.verb} ${typeLabel.toLowerCase()}`,
    type,
    price: price ?? 0,
    rentPaymentCycle: type === 2 ? cycle : null,
    city,
    district,
    bedrooms: facts.bedrooms,
    bathrooms: facts.bathrooms,
    area: facts.area,
    thumbnailUrl: images[0]?.url ?? null,
    latitude: null,
    longitude: null,
    distanceMeters: null,
    unitName: unit?.name ?? editUnit?.unitName ?? null,
    publishedAt: new Date().toISOString(),
    totalMonthlyCost:
      (price ?? 0) +
      (type === 2
        ? (terms.serviceFee ?? 0) + (terms.parkingFee ?? 0) + (terms.internetFee ?? 0)
        : 0),
    depositMonths: terms.depositMonths,
    petsAllowed: terms.petsAllowed,
    amenities,
    imageUrls: images.slice(0, 5).map((i) => i.url),
    imageCount: images.length,
    assetType: propertyType,
  };

  const onFiles = (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/")).slice(0, 20 - images.length);
    if (imgs.length) upload.mutate(imgs);
  };

  const highlightPool = type === 2 ? HIGHLIGHTS_RENT : HIGHLIGHTS_SALE;
  const isLast = step === STEPS.length - 1;

  if (isEditing && existingQ.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {!isEditing ? "Đăng tin" : status === 5 ? "Soạn tiếp tin nháp" : "Sửa tin đăng"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEditing
              ? "Sửa ở bước bất kỳ rồi lưu hoặc gửi duyệt lại."
              : "Bốn bước ngắn. Tiêu đề và mô tả được soạn sẵn từ thông số bạn nhập."}
          </p>
        </div>
        {draftId && canAutosave && (
          <p className="text-xs text-muted-foreground">
            {saveDraft.isPending ? "Đang lưu nháp…" : "Bản nháp tự lưu khi chuyển bước"}
          </p>
        )}
      </div>

      {/* Thanh bước — bấm được tới bước xa nhất đã qua. */}
      <ol className="mb-5 grid grid-cols-4 gap-1.5 sm:gap-2" aria-label="Các bước đăng tin">
        {STEPS.map((s, i) => {
          const done = i < step || (i <= reached && i !== step && stepProblems(i).length === 0);
          const active = i === step;
          const clickable = i <= reached || i === step + 1;
          return (
            <li key={s.nhan}>
              <button
                type="button"
                disabled={!clickable || busy}
                onClick={() => goTo(i)}
                aria-current={active ? "step" : undefined}
                className={`flex w-full flex-col gap-1.5 text-left disabled:cursor-default ${
                  clickable && !active ? "hover:opacity-80" : ""
                }`}
              >
                <span
                  className={`h-1.5 w-full rounded-full ${
                    active || done ? "bg-primary" : "bg-muted"
                  } ${active ? "" : done ? "opacity-60" : ""}`}
                />
                <span
                  className={`flex items-center gap-1 text-xs sm:text-sm ${
                    active ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {done && !active ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <span className="tabular-nums">{i + 1}.</span>
                  )}
                  <span className="hidden truncate sm:inline">{s.nhan}</span>
                  <span className="truncate sm:hidden">{s.ngan}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {(status === 3 || status === 6) && (
        <div
          className={`mb-4 flex gap-3 rounded-lg border p-4 ${
            status === 6
              ? "border-warning/40 bg-warning/10"
              : "border-destructive/40 bg-destructive/5"
          }`}
        >
          <AlertCircle
            className={`mt-0.5 h-5 w-5 shrink-0 ${status === 6 ? "text-warning" : "text-destructive"}`}
          />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">
              {status === 6 ? "Tin cần chỉnh sửa trước khi đăng" : "Tin đã bị từ chối"}
            </p>
            {moderationNote && <p className="text-sm text-muted-foreground">{moderationNote}</p>}
            <p className="text-sm text-muted-foreground">
              Sửa ở bước tương ứng rồi bấm Gửi duyệt lại ở bước cuối.
            </p>
          </div>
        </div>
      )}
      {(status === 1 || status === 2) && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          {status === 2
            ? "Tin đang hiển thị. Lưu thay đổi sẽ đưa tin về chờ duyệt lại."
            : "Tin đang chờ duyệt. Thay đổi được lưu khi bạn bấm Lưu thay đổi."}
        </div>
      )}

      {draftId && isEditing && (
        <div className="mb-4">
          <LichSuKiemDuyet listingId={draftId} />
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardContent className="space-y-6 p-4 sm:p-6">
            {/* ---------- 1. Loại & vị trí ---------- */}
            {step === 0 && (
              <>
                <StepTitle n={1} title="Bạn đăng tin gì, ở đâu?" />
                <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                  {(
                    [
                      [2, "Cho thuê"],
                      [1, "Bán"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={type === v}
                      disabled={isEditing}
                      onClick={() => {
                        setType(v);
                        if (!typeTouched.current) setPropertyType(v === 2 ? 7 : 1);
                      }}
                      className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                        type === v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {editUnit ? (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                    <Building2 className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Tin của căn <b>{editUnit.unitName}</b>
                      {editUnit.assetName ? ` · ${editUnit.assetName}` : ""} — địa chỉ và đặc điểm
                      chung theo toà nhà.
                    </span>
                  </div>
                ) : (
                  !isEditing && (
                    <BuildingPicker
                      buildings={buildings}
                      loading={buildingsQ.isLoading}
                      building={building}
                      unitId={unitId}
                      onPickBuilding={pickBuilding}
                      onPickUnit={pickUnit}
                    />
                  )
                )}

                {!canEditProperty && !editUnit && <PropertyLockNote />}

                <fieldset
                  disabled={!canEditProperty || inBuilding}
                  className="space-y-6 disabled:opacity-60"
                >
                  {inBuilding && (
                    <p className="text-xs text-muted-foreground">
                      Loại hình, địa chỉ và vị trí lấy theo toà nhà — sửa ở trang Toà nhà.
                    </p>
                  )}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Loại hình</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {TYPE_ORDER.map((code) => {
                        const Icon = TYPE_ICONS[code];
                        const on = propertyType === code;
                        return (
                          <button
                            key={code}
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              typeTouched.current = true;
                              setPropertyType(code);
                            }}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors sm:flex-col sm:items-start sm:gap-1.5 ${
                              on
                                ? "border-primary bg-primary/10 font-medium text-foreground ring-1 ring-primary"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                            <span className="leading-tight">{ASSET_TYPE[code]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm font-medium">Địa chỉ</p>
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
                    <Field label="Số nhà, tên đường" hint="Không bắt buộc. Chỉ người xem tin thấy.">
                      <Input
                        value={addressDetail}
                        onChange={(e) => setAddressDetail(e.target.value)}
                        placeholder="Ví dụ: 45/12 Điện Biên Phủ"
                      />
                    </Field>
                  </div>

                  <section aria-labelledby="ghim-nhan" className="space-y-1.5">
                    <p id="ghim-nhan" className="text-sm font-medium leading-none">
                      Ghim trên bản đồ{" "}
                      <span className="font-normal text-muted-foreground">
                        (nên có — tin chưa ghim không hiện trên bản đồ tìm kiếm)
                      </span>
                    </p>
                    <LocationPinField
                      value={pin}
                      onChange={setPin}
                      disabled={!canEditProperty || inBuilding}
                    />
                  </section>
                </fieldset>
              </>
            )}

            {/* ---------- 2. Thông số & giá ---------- */}
            {step === 1 && (
              <>
                <StepTitle
                  n={2}
                  title={`${typeLabel}: thông số & giá`}
                  sub="Chỉ hiện những gì có nghĩa với loại hình này."
                />
                {!canEditProperty && !editUnit && <PropertyLockNote />}
                {inBuilding && (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Đặc điểm chung (số tầng, hướng, pháp lý…) là của toà nhà. Ở đây chỉ cần diện
                    tích căn, giá và tiện nghi của căn này.
                  </p>
                )}

                <fieldset disabled={!canEditProperty} className="space-y-5 disabled:opacity-60">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="Diện tích (m²) *">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        placeholder="25"
                      />
                    </Field>
                    {fields.rooms && (
                      <NumField label="Phòng ngủ" value={bedrooms} onChange={setBedrooms} />
                    )}
                    {fields.rooms && (
                      <NumField label="Phòng tắm" value={bathrooms} onChange={setBathrooms} />
                    )}
                    {fields.floors && (
                      <NumField label="Số tầng" value={floors} onChange={setFloors} />
                    )}
                    {fields.frontage && (
                      <Field label="Mặt tiền (m)">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.1"
                          value={frontage}
                          onChange={(e) => setFrontage(e.target.value)}
                        />
                      </Field>
                    )}
                  </div>

                  {fields.furniture && (
                    <ChipGroup
                      label="Nội thất"
                      value={furnitureState}
                      onChange={setFurnitureState}
                      options={FURNITURE_STATE_OPTIONS.filter((x) => x !== "Khác")}
                    />
                  )}
                  {showLegal && (
                    <ChipGroup
                      label="Pháp lý"
                      value={legalStatus}
                      onChange={setLegalStatus}
                      options={LEGAL_STATUS_OPTIONS.filter((x) => x !== "Khác")}
                    />
                  )}
                  {fields.direction && (
                    <ChipGroup
                      label="Hướng"
                      value={houseDirection}
                      onChange={setHouseDirection}
                      options={HOUSE_DIRECTIONS}
                    />
                  )}
                </fieldset>

                <div className="space-y-3 border-t pt-5">
                  <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                    <Field label={type === 2 ? "Giá thuê *" : "Giá bán *"}>
                      <CurrencyInput value={price} onChange={setPrice} />
                    </Field>
                    {type === 2 && (
                      <Field label="Chu kỳ thanh toán">
                        <Select
                          value={String(cycle)}
                          onValueChange={(v) => setCycle(Number(v) as PaymentCycleCode)}
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
                      </Field>
                    )}
                  </div>
                  {/* Chỉ tin BÁN: mô hình định giá học trên giá rao bán. */}
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
                </div>

                <div className="space-y-2 border-t pt-5">
                  <p className="text-sm font-medium">
                    Tiện nghi{" "}
                    <span className="font-normal text-muted-foreground">
                      (người tìm lọc theo những mục này)
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {AMENITY_LIST.map(([key, label]) => (
                      <Chip
                        key={key}
                        on={amenities.includes(key)}
                        onClick={() =>
                          setAmenities((prev) =>
                            prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key],
                          )
                        }
                      >
                        {label}
                      </Chip>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ---------- 3. Ảnh & mô tả ---------- */}
            {step === 2 && (
              <>
                <StepTitle
                  n={3}
                  title="Ảnh & mô tả"
                  sub="Bản nháp đã được lưu — ảnh tải lên ngay. Ảnh đầu tiên là ảnh bìa."
                />

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    onFiles(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
                {images.length === 0 ? (
                  <button
                    type="button"
                    disabled={!draftId || upload.isPending}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      onFiles(Array.from(e.dataTransfer.files));
                    }}
                    className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
                      dragOver ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    {upload.isPending ? (
                      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                    ) : (
                      <ImagePlus className="h-7 w-7 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">Chọn hoặc kéo ảnh vào đây</span>
                    <span className="text-xs text-muted-foreground">
                      Cần ít nhất 1 ảnh. Tin từ 5 ảnh thật được xem nhiều hơn hẳn.
                    </span>
                  </button>
                ) : (
                  <div
                    className="grid grid-cols-3 gap-2 sm:grid-cols-5"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      onFiles(Array.from(e.dataTransfer.files));
                    }}
                  >
                    {images.map((img, i) => (
                      <div
                        key={img.id}
                        className="group relative aspect-square overflow-hidden rounded-md border"
                      >
                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 rounded bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold">
                            Ảnh bìa
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="Xoá ảnh"
                          onClick={() => removeImage.mutate(img.id)}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-1 opacity-100 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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
                        className="grid aspect-square place-items-center rounded-md border border-dashed text-muted-foreground transition-colors hover:bg-muted/50"
                        aria-label="Thêm ảnh"
                      >
                        {upload.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <ImagePlus className="h-5 w-5" />
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Trợ lý viết: người đăng chọn điểm nổi bật, AI chỉ viết lại những gì có thật. */}
                <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Điểm nổi bật</p>
                    <span className="basis-full text-xs text-muted-foreground sm:basis-auto">
                      chọn vài ý — AI chỉ viết những gì bạn chọn
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ...highlightPool,
                      ...highlights.filter((h) => !highlightPool.includes(h)),
                    ].map((h) => (
                      <Chip
                        key={h}
                        on={highlights.includes(h)}
                        onClick={() =>
                          setHighlights((prev) =>
                            prev.includes(h)
                              ? prev.filter((x) => x !== h)
                              : prev.length >= 8
                                ? prev
                                : [...prev, h],
                          )
                        }
                      >
                        {h}
                      </Chip>
                    ))}
                  </div>
                  <Textarea
                    rows={2}
                    maxLength={400}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ghi chú thêm cho AI (không bắt buộc): cách chợ Bà Chiểu 300m, phòng tầng 2 có cửa sổ lớn…"
                    aria-label="Ghi chú thêm cho trợ lý viết"
                  />
                  <Button
                    type="button"
                    onClick={() => writer.mutate()}
                    disabled={writer.isPending}
                    className="w-full sm:w-auto"
                  >
                    {writer.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-4 w-4" />
                    )}
                    {autoDescription ? "Viết tiêu đề & mô tả bằng AI" : "Viết lại bằng AI"}
                  </Button>
                </div>

                <Field
                  label="Tiêu đề *"
                  hint={
                    autoTitle
                      ? "Soạn sẵn từ thông số — gõ để sửa."
                      : `${titleValue.trim().length}/200 ký tự, tối thiểu 10.`
                  }
                >
                  <Input
                    value={titleValue}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setAutoTitle(false);
                    }}
                    maxLength={200}
                  />
                </Field>
                <Field
                  label="Mô tả *"
                  hint={
                    autoDescription
                      ? "Soạn sẵn từ thông số — sửa thêm hoặc nhờ AI viết cho tự nhiên hơn."
                      : `${descriptionValue.trim().length} ký tự, tối thiểu 30.`
                  }
                >
                  <Textarea
                    rows={8}
                    value={descriptionValue}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setAutoDescription(false);
                    }}
                  />
                </Field>
                {(!autoTitle || !autoDescription) && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => {
                      setAutoTitle(true);
                      setAutoDescription(true);
                    }}
                  >
                    Quay về bản soạn sẵn từ thông số
                  </button>
                )}
              </>
            )}

            {/* ---------- 4. Chi phí & gửi ---------- */}
            {step === 3 && (
              <>
                <StepTitle
                  n={4}
                  title={type === 2 ? "Chi phí & điều kiện" : "Kiểm tra & gửi duyệt"}
                  sub={
                    type === 2
                      ? "Không bắt buộc — nhưng cọc và giá điện nước là câu người thuê hỏi đầu tiên."
                      : undefined
                  }
                />
                <ListingTermsFields
                  value={terms}
                  onChange={setTerms}
                  amenities={amenities}
                  onAmenitiesChange={setAmenities}
                  isRent={type === 2}
                  hideAmenities
                />

                <div className="space-y-2 rounded-xl border p-4">
                  <p className="text-sm font-medium">
                    {missingForSubmit.length === 0
                      ? "Tin đã đủ để gửi duyệt"
                      : "Còn thiếu trước khi gửi duyệt"}
                  </p>
                  {missingForSubmit.length > 0 ? (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {missingForSubmit.map((m) => (
                        <li key={m} className="flex items-center gap-2">
                          <Circle className="h-3.5 w-3.5" /> {m}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Tin hiển thị công khai sau khi quản trị viên duyệt — thường trong ngày.
                    </p>
                  )}
                </div>

                {/* Màn hình nhỏ: cột xem trước bị ẩn, nên xem trước nằm ở bước cuối. */}
                <div className="space-y-2 lg:hidden">
                  <p className="text-sm font-medium">Tin của bạn sẽ trông như thế này</p>
                  <PreviewCard listing={preview} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Cột phải: thẻ tin thật + độ đầy đủ. */}
        <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Xem trước trên trang Tìm nhà
            </p>
            <PreviewCard listing={preview} />
          </div>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Độ đầy đủ</p>
                <span className="text-sm font-semibold tabular-nums">{score}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${score}%` }}
                />
              </div>
              <ul className="space-y-1.5">
                {checks.map((c) => (
                  <li key={c.nhan}>
                    <button
                      type="button"
                      disabled={c.buoc > reached + 1 || busy}
                      onClick={() => goTo(c.buoc)}
                      className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-accent disabled:hover:bg-transparent"
                    >
                      {c.xong ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-price" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className={c.xong ? "" : "text-muted-foreground"}>{c.nhan}</span>
                      {c.batBuoc && !c.xong && (
                        <span className="ml-auto text-[11px] text-destructive">bắt buộc</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Thanh điều hướng: dính đáy trên điện thoại, nằm dưới biểu mẫu trên máy tính. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1180px] items-center gap-2 lg:pr-[364px]">
          <Button
            variant="ghost"
            disabled={step === 0 || busy}
            onClick={() => goTo(step - 1)}
            className="px-3"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Quay lại
          </Button>
          <span className="text-xs text-muted-foreground lg:hidden">
            {step + 1}/{STEPS.length}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {draftId && (isLast || !canAutosave) && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  saveDraft.mutate(
                    { silent: false },
                    { onError: (e) => toast.error(getErrorMessage(e, "Không lưu được")) },
                  )
                }
              >
                {saveDraft.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {canAutosave ? "Lưu nháp" : "Lưu thay đổi"}
                </span>
                <span className="sm:hidden">Lưu</span>
              </Button>
            )}
            {!isLast ? (
              <Button disabled={busy} onClick={() => goTo(step + 1)}>
                {saveDraft.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Tiếp tục
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              canSubmit && (
                <Button
                  disabled={!draftId || missingForSubmit.length > 0 || busy}
                  onClick={() => submit.mutate()}
                >
                  {submit.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-4 w-4" />
                  )}
                  {status === 3 || status === 6 ? "Gửi duyệt lại" : "Gửi duyệt"}
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type Facts = {
  verb: string;
  typeLabel: string;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;
  frontage: number | null;
  direction: string | null;
  legal: string | null;
  furniture: string | null;
  addressDetail: string;
  ward: string;
  district: string;
  city: string;
  amenityLabels: string[];
  highlights: string[];
  unitName: string | null;
  unitFloor: number | null;
};

const nf = (n: number) => n.toLocaleString("vi-VN");

/** "Cho thuê phòng trọ 25m², Quận Bình Thạnh" — đúng sự thật, đủ để tìm thấy. */
function suggestTitle(f: Facts): string {
  let t = `${f.verb} ${f.typeLabel.toLowerCase()}`;
  if (f.area) t += ` ${nf(f.area)}m²`;
  if (f.unitName) t += ` ${f.unitName}`;
  if (f.bedrooms) t += `, ${f.bedrooms} phòng ngủ`;
  if (f.highlights[0]) t += `, ${f.highlights[0].toLowerCase()}`;
  if (f.district) t += `, ${f.district}`;
  return t.slice(0, 200);
}

/** Mô tả dựng từ thông số: không hay bằng AI, nhưng luôn có, luôn đúng và luôn đủ 30 ký tự. */
function suggestDescription(f: Facts): string {
  const where = [f.addressDetail, f.ward, f.district, f.city].filter(Boolean).join(", ");
  const lines: string[] = [];
  lines.push(
    `${f.verb} ${f.typeLabel.toLowerCase()}${f.area ? ` diện tích ${nf(f.area)}m²` : ""}${
      where ? ` tại ${where}` : ""
    }.`,
  );
  if (f.unitName)
    lines.push(`Căn ${f.unitName}${f.unitFloor ? ` ở tầng ${f.unitFloor}` : ""} của toà nhà.`);
  const specs = [
    f.bedrooms ? `${f.bedrooms} phòng ngủ` : null,
    f.bathrooms ? `${f.bathrooms} phòng tắm` : null,
    f.floors ? `${f.floors} tầng` : null,
    f.frontage ? `mặt tiền ${nf(f.frontage)}m` : null,
    f.direction ? `hướng ${f.direction}` : null,
  ].filter(Boolean);
  if (specs.length) lines.push(`Gồm ${specs.join(", ")}.`);
  if (f.furniture) lines.push(`Nội thất: ${f.furniture.toLowerCase()}.`);
  if (f.legal) lines.push(`Pháp lý: ${f.legal}.`);
  if (f.amenityLabels.length) lines.push(`Tiện nghi: ${f.amenityLabels.join(", ").toLowerCase()}.`);
  if (f.highlights.length) lines.push(`Điểm nổi bật: ${f.highlights.join(", ").toLowerCase()}.`);
  lines.push("Liên hệ để được xem nhà và tư vấn thêm.");
  return lines.join("\n");
}

/** Thẻ tin y như ở trang Tìm nhà; chặn điều hướng vì tin chưa có trang công khai. */
function PreviewCard({ listing }: { listing: PublicListingSummaryDto }) {
  return (
    <div onClickCapture={(e) => e.preventDefault()} aria-label="Xem trước thẻ tin">
      <PropertyListCard
        property={listing}
        saved={false}
        onToggleSave={() => {}}
        layout="vertical"
      />
    </div>
  );
}

/**
 * "Đây là một căn trong toà nhà của tôi?" — chỉ hiện khi chủ nhà đã khai toà nhà. Chưa có thì
 * chỉ một dòng mời khai toà nhà (lối duy nhất để tin hiện trên mô hình 3D).
 */
function BuildingPicker({
  buildings,
  loading,
  building,
  unitId,
  onPickBuilding,
  onPickUnit,
}: {
  buildings: OwnerBuilding[];
  loading: boolean;
  building: OwnerBuilding | null;
  unitId: string | null;
  onPickBuilding: (b: OwnerBuilding | null) => void;
  onPickUnit: (u: OwnerBuildingUnit) => void;
}) {
  if (loading) return null;
  if (buildings.length === 0)
    return (
      <Link
        to="/toa-nha"
        className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1">
          Có toà nhà / khu trọ nhiều căn? <b className="text-foreground">Khai toà nhà</b> để người
          tìm nhà xem 3D từng căn và đăng tin theo căn.
        </span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </Link>
    );

  const floors = new Map<number, OwnerBuildingUnit[]>();
  for (const u of building?.units ?? []) {
    const f = u.floor ?? 0;
    floors.set(f, [...(floors.get(f) ?? []), u]);
  }
  const floorKeys = [...floors.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1 text-sm">
        <button
          type="button"
          aria-pressed={!building}
          onClick={() => onPickBuilding(null)}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            !building ? "bg-card shadow-sm" : "text-muted-foreground"
          }`}
        >
          Nhà / căn độc lập
        </button>
        <button
          type="button"
          aria-pressed={!!building}
          onClick={() => !building && onPickBuilding(buildings[0])}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
            building ? "bg-card shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" /> Căn trong toà nhà
        </button>
      </div>

      {building && (
        <div className="space-y-3">
          {buildings.length > 1 && (
            <Select
              value={building.assetId}
              onValueChange={(v) => onPickBuilding(buildings.find((b) => b.assetId === v) ?? null)}
            >
              <SelectTrigger aria-label="Toà nhà">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((b) => (
                  <SelectItem key={b.assetId} value={b.assetId}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">
            {buildings.length === 1 && <b className="text-foreground">{building.name} · </b>}
            Chọn căn muốn đăng. Căn đã có tin (kể cả nháp) không chọn được — mở tin đó để sửa.
          </p>
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {floorKeys.map((f) => (
              <div key={f} className="flex items-start gap-2">
                <span className="w-14 shrink-0 pt-1 text-xs text-muted-foreground">
                  {f ? `Tầng ${f}` : "Khác"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {floors.get(f)!.map((u) => {
                    const taken = u.listingId != null;
                    const on = u.id === unitId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={taken}
                        aria-pressed={on}
                        title={
                          taken
                            ? "Căn này đã có tin"
                            : u.status !== 1
                              ? "Căn đang đánh dấu có người / đang sửa"
                              : undefined
                        }
                        onClick={() => onPickUnit(u)}
                        className={`rounded-md border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : u.status === 1
                              ? "hover:bg-accent"
                              : "border-dashed text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {u.name}
                        {u.area ? <span className="opacity-70"> · {u.area}m²</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {floorKeys.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Toà nhà chưa có căn nào —{" "}
                <Link
                  to="/toa-nha/$id"
                  params={{ id: building.assetId }}
                  className="text-primary underline"
                >
                  thêm căn
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StepTitle({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Bước {n}/4</p>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PropertyLockNote() {
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
      Địa chỉ này còn tin đăng khác nên thông tin bất động sản đang khoá — sửa ở đây sẽ đổi luôn nội
      dung của những tin kia.
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        on
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {on && <Check className="h-3.5 w-3.5 text-primary" />}
      {children}
    </button>
  );
}

/** Chọn MỘT giá trị (bấm lại để bỏ). Giá trị cũ ngoài bộ chuẩn vẫn hiện, không biến mất. */
function ChipGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  const all = value && !options.includes(value) ? [...options, value] : options;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {all.map((o) => (
          <Chip key={o} on={value === o} onClick={() => onChange(value === o ? "" : o)}>
            {o}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** Ô số nhỏ có nút −/+ — số phòng, số tầng gõ bằng ngón cái trên điện thoại rất khó. */
function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const n = Number(value) || 0;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex h-9 items-center rounded-md border">
        <button
          type="button"
          aria-label={`Giảm ${label.toLowerCase()}`}
          className="h-full px-2.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
          disabled={n <= 0}
          onClick={() => onChange(n <= 1 ? "" : String(n - 1))}
        >
          −
        </button>
        <input
          id={id}
          inputMode="numeric"
          className="h-full w-full min-w-0 bg-transparent text-center text-sm outline-none"
          value={value}
          placeholder="–"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
        />
        <button
          type="button"
          aria-label={`Tăng ${label.toLowerCase()}`}
          className="h-full px-2.5 text-muted-foreground hover:text-foreground"
          onClick={() => onChange(String(Math.min(n + 1, 999)))}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Nhãn + ô nhập, nối bằng id sinh tự động (cloneElement) — bấm nhãn đưa con trỏ vào ô, và
 * trình đọc màn hình đọc đúng tên ô.
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
 * Lịch sử kiểm duyệt của tin, hiện cho CHỦ TIN — mọi vòng, không chỉ ghi chú lần gần nhất.
 * KHÔNG hiện tên người duyệt.
 */
function LichSuKiemDuyet({ listingId }: { listingId: string }) {
  const query = useQuery({
    queryKey: ["moderation-history", listingId],
    queryFn: () => listingsApi.moderationHistory(listingId),
    retry: 1,
  });

  const rows = query.data ?? [];
  if (rows.length === 0) return null;

  return (
    <details className="rounded-lg border bg-card px-4 py-3">
      <summary className="cursor-pointer select-none text-sm font-medium">
        Lịch sử kiểm duyệt ({rows.length} lượt)
      </summary>
      <ol className="mt-3 space-y-3">
        {rows.map((e, i) => (
          <li key={`${e.round}-${i}`} className="flex gap-3 text-sm">
            <span className="shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
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
