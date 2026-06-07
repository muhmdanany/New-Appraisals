import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { countries, getCountryByCode } from "@/lib/countries";
import { useTranslation } from "react-i18next";

interface CountryPickerProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  noResultsText?: string;
  noneLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export function CountryPicker({
  value,
  onChange,
  placeholder,
  noResultsText,
  noneLabel,
  searchPlaceholder,
  disabled,
}: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const selected = getCountryByCode(value);

  const displayName = useMemo(() => {
    if (!selected) return null;
    return isAr ? selected.nameAr : selected.name;
  }, [selected, isAr]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="text-base leading-none">{selected.flag}</span>
              <span className="truncate">{displayName}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 ms-2 shrink-0">
            {value && (
              <span
                role="button"
                className="rounded-sm opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setOpen(false);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(value, search) => {
          const country = countries.find(c => c.code === value);
          if (!country) return 0;
          const s = search.toLowerCase();
          if (country.name.toLowerCase().includes(s)) return 1;
          if (country.nameAr.includes(s)) return 1;
          if (country.code.toLowerCase().includes(s)) return 1;
          return 0;
        }}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{noResultsText}</CommandEmpty>
            <CommandGroup>
              {countries.map((country) => (
                <CommandItem
                  key={country.code}
                  value={country.code}
                  onSelect={(code) => {
                    onChange(code === value ? "" : code.toUpperCase());
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "me-2 h-4 w-4 shrink-0",
                      value?.toUpperCase() === country.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-base leading-none me-2">{country.flag}</span>
                  <span className="truncate">{isAr ? country.nameAr : country.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
