import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@navikt/aksel-icons";
import {
  Button,
  DatePicker,
  HStack,
  Hide,
  Label,
  Popover,
  Show,
  VStack,
  useDatepicker,
} from "@navikt/ds-react";
import dayjs from "dayjs";
import { useRef, useState } from "react";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import { useSearchParams } from "~/hooks/useSearchParams";

function CustomPeriodInputs({
  onApply,
}: {
  onApply: (from: Date, to: Date) => void;
}) {
  const [tempFrom, setTempFrom] = useState<Date | undefined>();
  const [tempTo, setTempTo] = useState<Date | undefined>();

  const { datepickerProps: fromProps, inputProps: fromInputProps } =
    useDatepicker({
      onDateChange: setTempFrom,
      defaultSelected: tempFrom,
    });

  const { datepickerProps: toProps, inputProps: toInputProps } = useDatepicker({
    onDateChange: setTempTo,
    defaultSelected: tempTo,
  });

  return (
    <VStack gap="space-16">
      <VStack gap="space-8">
        <Label size="small">Egendefinert periode</Label>
        <DatePicker {...fromProps}>
          <DatePicker.Input {...fromInputProps} label="Fra" size="small" />
        </DatePicker>
        <DatePicker {...toProps}>
          <DatePicker.Input {...toInputProps} label="Til" size="small" />
        </DatePicker>
      </VStack>
      <Button
        size="small"
        variant="primary"
        onClick={() => {
          if (tempFrom && tempTo) {
            onApply(tempFrom, tempTo);
          }
        }}
        disabled={!tempFrom || !tempTo}
      >
        Velg periode
      </Button>
    </VStack>
  );
}

export function PeriodSelector() {
  const { params, setParam } = useSearchParams();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { isMobile } = useBreakpoint();

  // Parse current params
  const currentFrom = params.fromDate ? dayjs(params.fromDate) : undefined;
  const currentTo = params.toDate ? dayjs(params.toDate) : undefined;

  const handleApply = (from: Date, to: Date) => {
    setParam("fromDate", dayjs(from).format("YYYY-MM-DD"));
    setParam("toDate", dayjs(to).format("YYYY-MM-DD"));
    setOpen(false);
  };

  const handlePreset = (days: number | "year" | "today") => {
    const end = dayjs();
    let start = dayjs();

    if (days === "year") {
      start = start.startOf("year");
    } else if (days === "today") {
      start = start.startOf("day");
    } else {
      start = start.subtract(days - 1, "day");
    }

    setParam("fromDate", start.format("YYYY-MM-DD"));
    setParam("toDate", end.format("YYYY-MM-DD"));
    setOpen(false);
  };

  // Determine label text
  const getLabel = () => {
    if (!currentFrom || !currentTo) return "Velg periode";

    const end = currentTo;
    const start = currentFrom;
    const today = dayjs();
    const isToday = end.isSame(today, "day");

    // Check presets
    if (isToday) {
      if (start.isSame(today, "day"))
        return isMobile ? "I dag" : "Hittil i dag";

      const diff = end.diff(start, "day") + 1;
      if (diff === 7) return isMobile ? "7 dager" : "Siste 7 dager";
      if (diff === 30) return isMobile ? "30 dager" : "Siste 30 dager";
      if (diff === 90) return isMobile ? "3 mnd" : "Siste 3 måneder";
      if (start.isSame(today.startOf("year"), "day")) return "Hittil i år";
    }

    // Custom - shorter format on mobile
    if (isMobile) {
      return `${start.format("DD.MM")} - ${end.format("DD.MM")}`;
    }
    return `${start.format("DD.MM.YYYY")} - ${end.format("DD.MM.YYYY")}`;
  };

  return (
    <>
      <Button
        ref={buttonRef}
        variant="tertiary"
        size="small"
        onClick={() => setOpen(!open)}
        icon={<CalendarIcon aria-hidden />}
        iconPosition="left"
        style={{ border: "1px solid var(--ax-border-neutral-subtle)" }}
      >
        {getLabel()}
        {open ? <ChevronUpIcon aria-hidden /> : <ChevronDownIcon aria-hidden />}
      </Button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorEl={buttonRef.current}
        placement={isMobile ? "bottom" : "bottom-start"}
      >
        <Popover.Content
          style={{
            maxWidth: isMobile ? "calc(100vw - 2rem)" : "auto",
            overflow: "auto",
          }}
        >
          {/* Mobile: Stack vertically */}
          <Show above="md">
            <HStack gap="space-16" align="start">
              {/* Presets Column */}
              <VStack gap="space-8" style={{ minWidth: "140px" }}>
                <Label size="small">Hurtigvalg</Label>
                <PresetButtons onSelect={handlePreset} />
              </VStack>

              {/* Divider */}
              <div
                style={{
                  width: "1px",
                  backgroundColor: "var(--ax-border-neutral-subtle)",
                  alignSelf: "stretch",
                }}
              />

              {/* Custom Range Column */}
              {open && <CustomPeriodInputs onApply={handleApply} />}
            </HStack>
          </Show>

          {/* Mobile: Vertical layout */}
          <Hide above="md">
            <VStack gap="space-16">
              <VStack gap="space-8">
                <Label size="small">Hurtigvalg</Label>
                <PresetButtons onSelect={handlePreset} compact />
              </VStack>

              <div
                style={{
                  height: "1px",
                  backgroundColor: "var(--ax-border-neutral-subtle)",
                  width: "100%",
                }}
              />

              {open && <CustomPeriodInputs onApply={handleApply} />}
            </VStack>
          </Hide>
        </Popover.Content>
      </Popover>
    </>
  );
}

/**
 * Preset period selection buttons
 */
function PresetButtons({
  onSelect,
  compact = false,
}: {
  onSelect: (days: number | "year" | "today") => void;
  compact?: boolean;
}) {
  const presets = [
    { label: compact ? "I dag" : "Hittil i dag", value: "today" as const },
    { label: compact ? "7 dager" : "Siste 7 dager", value: 7 },
    { label: compact ? "30 dager" : "Siste 30 dager", value: 30 },
    { label: compact ? "3 mnd" : "Siste 3 måneder", value: 90 },
    { label: "Hittil i år", value: "year" as const },
  ];

  // On mobile, show in a 2x3 grid for better touch targets
  if (compact) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="tertiary"
            size="small"
            onClick={() => onSelect(preset.value)}
            style={{ flex: "1 1 45%" }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <>
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant="tertiary"
          size="small"
          onClick={() => onSelect(preset.value)}
          className="justify-start"
        >
          {preset.label}
        </Button>
      ))}
    </>
  );
}
