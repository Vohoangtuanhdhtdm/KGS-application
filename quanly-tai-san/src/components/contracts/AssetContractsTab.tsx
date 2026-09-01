import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { contractsApi } from "@/lib/api/contracts";
import { CONTRACT_DIRECTION, CONTRACT_STATUS, CONTRACT_STATUS_CLASS } from "@/constants/enums";
import { formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus } from "lucide-react";

export function AssetContractsTab({ assetId }: { assetId: string }) {
  const q = useQuery({
    queryKey: ["contracts", { assetId }],
    queryFn: () => contractsApi.list({ assetId, pageSize: 50 }),
  });

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const items = q.data?.items ?? [];

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Chưa có hợp đồng nào cho tài sản này.</p>
          <Button className="mt-4" size="sm" asChild>
            <Link to="/hop-dong/moi" search={{ assetId }}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo hợp đồng
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" asChild>
          <Link to="/hop-dong/moi" search={{ assetId }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo hợp đồng
          </Link>
        </Button>
      </div>
      {items.map((c) => (
        <Link key={c.id} to="/hop-dong/$id" params={{ id: c.id }} className="block">
          <Card className="hover:border-primary/50 transition">
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{CONTRACT_DIRECTION[c.direction]}</Badge>
                  <Badge variant="outline" className={CONTRACT_STATUS_CLASS[c.status]}>
                    {CONTRACT_STATUS[c.status]}
                  </Badge>
                  {c.assetUnitName && (
                    <span className="text-xs text-muted-foreground">{c.assetUnitName}</span>
                  )}
                </div>
                <div className="mt-1 text-sm">{c.counterpartyName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(c.startDate)} → {formatDate(c.endDate)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatCurrency(c.rentAmount)}</div>
                <div className="text-xs text-muted-foreground">/ kỳ</div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
