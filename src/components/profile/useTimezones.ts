import { useEffect, useMemo, useState } from "react";

import timezonesFallback from "@/assets/timezones.json";

import type { TimezoneOption } from "./TimezoneSelect";

const mapToOption = (identifier: string): TimezoneOption => ({
  id: identifier,
  label: identifier.replace(/_/g, " "),
});

const sortOptions = (options: TimezoneOption[]) => {
  return [...options].sort((a, b) => a.label.localeCompare(b.label));
};

export function useTimezones(): TimezoneOption[] {
  const [options, setOptions] = useState<TimezoneOption[]>([]);

  useEffect(() => {
    try {
      if (typeof Intl.supportedValuesOf === "function") {
        const identifiers = Intl.supportedValuesOf("timeZone");
        setOptions(sortOptions(identifiers.map(mapToOption)));
        return;
      }
    } catch (error) {
      console.warn("Failed to obtain system timezones", error);
    }

    setOptions(sortOptions((timezonesFallback as string[]).map(mapToOption)));
  }, []);

  return useMemo(() => options, [options]);
}

