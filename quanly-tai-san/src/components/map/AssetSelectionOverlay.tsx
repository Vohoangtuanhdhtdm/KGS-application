// Lớp spotlight + thẻ xem nhanh của bản đồ tài sản — dùng chung cho bản Leaflet và bản GL.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PortfolioIncome } from "@/lib/asset-income";
import { AssetQuickCard, QUICK_CARD_WIDTH } from "./AssetQuickCard";
import { ringInnerHtml, type LocatedAsset } from "./assetMapShared";

const CARD_GAP = 16;
const CARD_EDGE = 8;
/** Chiều cao ước lượng để căn chỗ; card thật có thể thấp hơn, không ảnh hưởng thẩm mỹ. */
const CARD_EST_HEIGHT = 360;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export interface OverlayGeometry {
  /** Toạ độ marker trong container bản đồ. */
  pt: { x: number; y: number };
  /** Kích thước container bản đồ. */
  size: { x: number; y: number };
  /** Góc trên-trái của container theo viewport. */
  offset: { x: number; y: number };
}

/**
 * Lớp "spotlight": làm tối nền bản đồ, vẽ lại marker đang chọn ở trên lớp tối, và mở card
 * ngay tại điểm vừa click.
 *
 * Vì sao phải vẽ LẠI marker thay vì nâng z-index marker gốc: marker nằm trong lớp riêng của
 * bản đồ (pane của Leaflet, khung canvas của GL) — lớp đó tự tạo stacking context, nên không
 * con nào bên trong vượt lên trên lớp tối đặt ngoài được.
 *
 * `read` trả toạ độ hiện tại, `subscribe` báo mỗi khi bản đồ di chuyển/đổi cỡ — card neo theo
 * marker: pan/zoom thì đi theo, không bị "rớt" lại một chỗ.
 */
export function SelectionOverlay({
  target,
  radius,
  alive,
  income,
  onClose,
  onOpenDetail,
  rightInset,
  read,
  subscribe,
}: {
  target: LocatedAsset;
  radius: number;
  alive: boolean;
  income: PortfolioIncome;
  onClose: () => void;
  onOpenDetail: (id: string) => void;
  rightInset: number;
  read: () => OverlayGeometry;
  subscribe: (cb: () => void) => () => void;
}) {
  const [geo, setGeo] = useState(read);
  const sync = useCallback(() => setGeo(read()), [read]);
  useEffect(() => sync(), [sync]);
  useEffect(() => subscribe(sync), [subscribe, sync]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Chỉ lớp trên cùng được xử lý Esc. Khi AssetDetailDialog (hoặc sheet) đang mở đè
      // lên, một lần Esc phải đóng đúng lớp đó — không đóng luôn cả thẻ xem nhanh bên dưới.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { pt, size, offset } = geo;

  // Chọn phía còn nhiều chỗ nhất, rồi kẹp lại trong viewport — cùng cách đã dùng để sửa
  // popover "Tìm quanh vị trí" ở Marketplace.
  const usableRight =
    size.x - rightInset > QUICK_CARD_WIDTH + CARD_GAP * 2 ? size.x - rightInset : size.x;
  const spaceRight = usableRight - pt.x;
  const spaceLeft = pt.x;
  let left =
    spaceRight >= QUICK_CARD_WIDTH + CARD_GAP || spaceRight >= spaceLeft
      ? pt.x + radius + CARD_GAP
      : pt.x - radius - CARD_GAP - QUICK_CARD_WIDTH;
  left = clamp(left, CARD_EDGE, usableRight - QUICK_CARD_WIDTH - CARD_EDGE);

  let top = pt.y - CARD_EST_HEIGHT / 2;
  top = clamp(top, CARD_EDGE, size.y - CARD_EST_HEIGHT - CARD_EDGE);

  // Gốc phóng nằm đúng phía marker → card "nở ra" từ điểm vừa click
  const originX = clamp(pt.x - left, 0, QUICK_CARD_WIDTH);
  const originY = clamp(pt.y - top, 0, CARD_EST_HEIGHT);

  // PORTAL ra document.body: nếu render trong cây bản đồ, cả 3 lớp này bị nhốt trong
  // stacking context `z-0` của wrapper bản đồ (thứ bắt buộc phải có để giam các pane
  // Leaflet z-400..700). Hệ quả đã đo được: quick card khai báo z-1000 vẫn bị panel
  // thống kê z-10 che mất. Ra ngoài body thì z-index mới có hiệu lực thật.
  return createPortal(
    <>
      <div className="asset-spotlight" onClick={onClose} role="presentation" aria-hidden="true" />
      {/* Bản sao sáng của marker đang chọn, nằm trên lớp tối */}
      <div
        className="asset-selected-ring"
        style={{ left: offset.x + pt.x - radius, top: offset.y + pt.y - radius }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{
          __html: ringInnerHtml(target.status, radius, alive, true),
        }}
      />
      <div
        className="asset-quickcard"
        style={{
          left: offset.x + left,
          top: offset.y + top,
          width: QUICK_CARD_WIDTH,
          transformOrigin: `${originX}px ${originY}px`,
        }}
      >
        <AssetQuickCard
          asset={target}
          income={income[target.id]}
          onClose={onClose}
          onOpenDetail={onOpenDetail}
        />
      </div>
    </>,
    document.body,
  );
}
