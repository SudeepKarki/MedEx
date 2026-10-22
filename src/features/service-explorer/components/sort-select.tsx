"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_KEYS, SORT_LABELS, type SortKey } from "../domain/filters";

export function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (sort: SortKey) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="shrink-0 text-sm text-muted-foreground">
        Sort by
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as SortKey)}>
        <SelectTrigger id={id} className="w-44 pointer-coarse:h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {SORT_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {SORT_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
