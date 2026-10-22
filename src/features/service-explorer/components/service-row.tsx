import { HomeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { ServiceResult } from "../domain/engine";
import { SERVICE_TYPE_LABELS } from "../domain/labels";
import type { Catalog } from "../domain/types";
import { PriceTag } from "./price-tag";

interface ServiceRowProps {
  result: ServiceResult;
  catalog: Catalog;
  currency: CurrencyCode | null;
  rangeActive: boolean;
}

export function ServiceRow({ result, catalog, currency, rangeActive }: ServiceRowProps) {
  const { service } = result;
  const category = service.categoryKey ? catalog.categoriesByKey.get(service.categoryKey) : null;
  const subcategory = service.subcategoryKey
    ? catalog.subcategoriesByKey.get(service.subcategoryKey)
    : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="leading-snug font-medium text-pretty">{service.title}</p>
        <p className="text-sm text-muted-foreground">
          {SERVICE_TYPE_LABELS[service.type].singular}
          {category && (
            <>
              {" · "}
              {category.title}
              {subcategory && <> › {subcategory.title}</>}
            </>
          )}
        </p>
        {service.homeTest.available && (
          <Badge variant="secondary" className="w-fit gap-1 font-normal">
            <HomeIcon aria-hidden className="size-3" />
            Home test available
            {currency && (
              <span className="text-muted-foreground">
                {service.homeTest.fee
                  ? ` · +${formatMoney(service.homeTest.fee, currency)} visit fee`
                  : " · visit fee set by provider"}
              </span>
            )}
          </Badge>
        )}
      </div>
      <PriceTag result={result} currency={currency} rangeActive={rangeActive} />
    </div>
  );
}
