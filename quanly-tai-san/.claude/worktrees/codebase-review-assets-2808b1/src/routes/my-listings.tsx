import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { propertiesApi, formatListingPrice, type OwnerListingDto } from "@/lib/api/properties";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { LISTING_TYPE, PROPERTY_STATUS, PROPERTY_STATUS_CLASS } from "@/constants/enums";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Megaphone } from "lucide-react";

export const Route = createFileRoute("/my-listings")({
  head: () => ({ meta: [{ title: "Tin đăng của tôi — Quản Lý Tài Sản" }] }),
  component: MyListingsPage,
});

function MyListingsPage() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => propertiesApi.myListings(),
    retry: 1,
  });

  const rows = query.data ?? [];

  const openListing = (l: OwnerListingDto) => {
    // Chỉ tin đã duyệt mới có trang công khai; tin khác không điều hướng
    if (l.status === 2) navigate({ to: "/tin-dang/$slug", params: { slug: l.slug } });
  };

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tin đăng của tôi</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Theo dõi trạng thái duyệt và lượt xem các tin đăng bạn đã gửi lên marketplace.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="py-10 text-center text-sm text-destructive">
              {getErrorMessage(query.error, "Không tải được danh sách tin đăng")}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              Bạn chưa đăng tin nào lên marketplace. Vào chi tiết một tài sản → tab Rao bán để đăng
              tin công khai.
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Giá</TableHead>
                    <TableHead className="text-center">Lượt xem</TableHead>
                    <TableHead>Ngày đăng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => {
                    const approved = l.status === 2;
                    const row = (
                      <TableRow
                        key={l.id}
                        className={approved ? "cursor-pointer" : "cursor-default"}
                        onClick={() => openListing(l)}
                      >
                        <TableCell className="font-medium">{l.title}</TableCell>
                        <TableCell className="text-sm">{LISTING_TYPE[l.type]}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={PROPERTY_STATUS_CLASS[l.status]}>
                            {PROPERTY_STATUS[l.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatListingPrice(l.price, l.type, l.rentPaymentCycle)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                            <Eye className="h-3.5 w-3.5" />
                            {l.viewCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(l.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                    // Tin chờ duyệt: tooltip giải thích chưa hiển thị công khai
                    return l.status === 1 ? (
                      <Tooltip key={l.id}>
                        <TooltipTrigger asChild>{row}</TooltipTrigger>
                        <TooltipContent>Đang chờ duyệt, chưa hiển thị công khai.</TooltipContent>
                      </Tooltip>
                    ) : (
                      row
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
