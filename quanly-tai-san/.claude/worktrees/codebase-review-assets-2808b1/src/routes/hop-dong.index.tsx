import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { contractsApi, type ContractFilters } from "@/lib/api/contracts";
import {
  CONTRACT_DIRECTION,
  CONTRACT_STATUS,
  CONTRACT_STATUS_CLASS,
  PAYMENT_CYCLE,
} from "@/constants/enums";
import { formatDate, formatCurrency, daysUntil } from "@/lib/format";
import { getErrorMessage } from "@/lib/api/errors";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, AlertTriangle, FileText, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/hop-dong/")({
  head: () => ({ meta: [{ title: "Quản lý hợp đồng — Quản Lý Tài Sản" }] }),
  component: ContractList,
});

type Tab = "all" | "out" | "in" | "expiring";

function ContractList() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);

  const filters: ContractFilters = {
    direction: tab === "out" ? 1 : tab === "in" ? 2 : "",
    status: tab === "expiring" ? 2 : "",
    page,
    pageSize: 20,
  };

  const q = useQuery({
    queryKey: ["contracts", filters],
    queryFn: () => contractsApi.list(filters),
    placeholderData: keepPreviousData,
  });

  const items = q.data?.items ?? [];
  const filtered =
    tab === "expiring"
      ? items.filter((c) => {
          const d = daysUntil(c.endDate);
          return d >= 0 && d <= 30;
        })
      : items;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quản lý hợp đồng</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {q.data ? `${q.data.totalCount} hợp đồng` : "Đang tải..."}
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/hop-dong/moi" })}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo hợp đồng
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="out">Cho thuê</TabsTrigger>
          <TabsTrigger value="in">Đi thuê</TabsTrigger>
          <TabsTrigger value="expiring">Sắp hết hạn</TabsTrigger>
        </TabsList>
      </Tabs>

      {q.isLoading && <Skeleton className="h-80 w-full" />}
      {q.isError && (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <p className="text-destructive text-sm">
              {getErrorMessage(q.error, "Không tải được danh sách")}
            </p>
            <Button variant="outline" size="sm" onClick={() => q.refetch()}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Thử lại
            </Button>
          </CardContent>
        </Card>
      )}

      {q.data && filtered.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Chưa có hợp đồng nào.</p>
            <Button className="mt-4" size="sm" onClick={() => navigate({ to: "/hop-dong/moi" })}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo hợp đồng
            </Button>
          </CardContent>
        </Card>
      )}

      {q.data && filtered.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tài sản</TableHead>
                  <TableHead>Chiều</TableHead>
                  <TableHead>Đối tác</TableHead>
                  <TableHead>Kỳ hạn</TableHead>
                  <TableHead className="text-right">Tiền thuê</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const dLeft = daysUntil(c.endDate);
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate({ to: "/hop-dong/$id", params: { id: c.id } })}
                    >
                      <TableCell>
                        <Link
                          to="/tai-san/$id"
                          params={{ id: c.assetId }}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.assetName}
                        </Link>
                        {c.assetUnitName && (
                          <div className="text-xs text-muted-foreground">{c.assetUnitName}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{CONTRACT_DIRECTION[c.direction]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.counterpartyName}
                        {c.counterpartyPhone && (
                          <div className="text-xs text-muted-foreground">{c.counterpartyPhone}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{formatDate(c.startDate)}</div>
                        <div className="text-xs text-muted-foreground">
                          → {formatDate(c.endDate)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(c.rentAmount)}
                        <div className="text-xs text-muted-foreground font-normal">
                          {PAYMENT_CYCLE[c.paymentCycle]}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={CONTRACT_STATUS_CLASS[c.status]}>
                          {CONTRACT_STATUS[c.status]}
                        </Badge>
                        {c.status === 2 && dLeft >= 0 && dLeft <= 30 && (
                          <div className="text-xs text-warning-foreground mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Còn {dLeft} ngày
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {q.data && q.data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </Button>
          <span className="text-sm px-3">
            Trang {page}/{q.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= q.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}
