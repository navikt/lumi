import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@navikt/aksel-icons";
import {
  Button,
  DatePicker,
  Detail,
  HGrid,
  Hide,
  HStack,
  Label,
  Modal,
  Popover,
  Show,
  useDatepicker,
  VStack,
} from "@navikt/ds-react";
import dayjs from "dayjs";
import { useId, useRef, useState } from "react";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import { useSearchParams } from "~/hooks/useSearchParams";
import { todayInOslo } from "~/utils/dashboardPeriod";
import styles from "./PeriodSelector.module.css";

function CustomPeriodInputs({
  onApply,
  fromDate,
  toDate,
}: {
  onApply: (from: Date, to: Date) => void;
  fromDate?: string;
  toDate?: string;
}) {
  const [tempFrom, setTempFrom] = useState<Date | undefined>(
    fromDate ? dayjs(fromDate).toDate() : undefined,
  );
  const [tempTo, setTempTo] = useState<Date | undefined>(
    toDate ? dayjs(toDate).toDate() : undefined,
  );

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
          <DatePicker.Input
            {...toInputProps}
            label="Til"
            size="small"
            error={
              tempFrom && tempTo && tempTo < tempFrom
                ? "Til-dato må være samme dag som eller etter fra-dato."
                : undefined
            }
          />
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
        disabled={!tempFrom || !tempTo || tempTo < tempFrom}
      >
        Velg periode
      </Button>
    </VStack>
  );
}

export function PeriodSelector({
  completeDays = false,
}: {
  completeDays?: boolean;
} = {}) {
  const { params, setParams } = useSearchParams();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const { isMobile } = useBreakpoint();

  // Parse current params
  const currentFrom = params.fromDate ? dayjs(params.fromDate) : undefined;
  const currentTo = params.toDate ? dayjs(params.toDate) : undefined;

  const closeAndRestoreFocus = () => {
    setOpen(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const handleApply = (from: Date, to: Date) => {
    setParams({
      dateMode: "fixed",
      fromDate: dayjs(from).format("YYYY-MM-DD"),
      toDate: dayjs(to).format("YYYY-MM-DD"),
      ...(completeDays ? { periodPreset: "custom" as const } : {}),
      page: "1",
    });
    closeAndRestoreFocus();
  };

  const handlePreset = (days: number | "year" | "today") => {
    const today = completeDays ? dayjs(todayInOslo()) : dayjs();
    const end =
      completeDays && days !== "today" ? today.subtract(1, "day") : today;
    if (
      completeDays &&
      days === "year" &&
      today.isSame(today.startOf("year"), "day")
    )
      return;
    let start = end;

    if (days === "year") {
      start = start.startOf("year");
    } else if (days === "today") {
      start = start.startOf("day");
    } else {
      start = start.subtract(days - 1, "day");
    }

    setParams({
      dateMode: "fixed",
      fromDate: start.format("YYYY-MM-DD"),
      toDate: end.format("YYYY-MM-DD"),
      ...(completeDays
        ? {
            periodPreset:
              days === "year" ? ("yearToDate" as const) : ("rolling" as const),
          }
        : {}),
      page: "1",
    });
    closeAndRestoreFocus();
  };

  // Determine label text
  const getLabel = () => {
    if (currentFrom && !currentTo) {
      return `Fra ${currentFrom.format(isMobile ? "DD.MM" : "DD.MM.YYYY")}`;
    }
    if (!currentFrom && currentTo) {
      return `Til ${currentTo.format(isMobile ? "DD.MM" : "DD.MM.YYYY")}`;
    }
    if (!currentFrom || !currentTo) return "Velg periode";

    const end = currentTo;
    const start = currentFrom;
    const today = completeDays ? dayjs(todayInOslo()) : dayjs();
    if (start.isSame(today, "day") && end.isSame(today, "day"))
      return isMobile ? "I dag" : "Hittil i dag";
    const isToday = end.isSame(
      completeDays ? today.subtract(1, "day") : today,
      "day",
    );

    // Check presets
    if (isToday) {
      if (
        completeDays &&
        params.periodPreset === "yearToDate" &&
        start.isSame(today.startOf("year"), "day")
      )
        return "Hittil i år (t.o.m. i går)";
      if (start.isSame(today, "day"))
        return isMobile ? "I dag" : "Hittil i dag";

      const diff = end.diff(start, "day") + 1;
      if (diff === 7)
        return completeDays
          ? "Siste 7 hele dager"
          : isMobile
            ? "7 dager"
            : "Siste 7 dager";
      if (diff === 30)
        return completeDays
          ? "Siste 30 hele dager"
          : isMobile
            ? "30 dager"
            : "Siste 30 dager";
      if (diff === 90)
        return completeDays
          ? "Siste 90 hele dager"
          : isMobile
            ? "3 mnd"
            : "Siste 3 måneder";
      if (start.isSame(today.startOf("year"), "day"))
        return completeDays ? "Hittil i år (t.o.m. i går)" : "Hittil i år";
    }

    // Custom - shorter format on mobile
    if (isMobile && !completeDays) {
      return `${start.format("DD.MM")} - ${end.format("DD.MM")}`;
    }
    return `${start.format("DD.MM.YYYY")} - ${end.format("DD.MM.YYYY")}`;
  };

  const periodLabel = getLabel();
  const periodEditor = (
    <VStack gap="space-20">
      <HGrid columns={{ xs: 1, sm: "1fr 1fr" }} gap="space-24">
        <VStack gap="space-8">
          <Label as="span" size="small">
            Hurtigvalg
          </Label>
          <PresetButtons
            onSelect={handlePreset}
            completeDays
            compact={isMobile}
            concise
          />
          <Detail textColor="subtle">
            Hele dager til og med i går, unntatt «I dag».
          </Detail>
        </VStack>
        <CustomPeriodInputs
          onApply={handleApply}
          fromDate={params.fromDate}
          toDate={params.toDate}
        />
      </HGrid>
    </VStack>
  );

  return (
    <>
      <Button
        ref={buttonRef}
        variant="tertiary"
        data-color={completeDays ? "neutral" : undefined}
        size="small"
        onClick={() => setOpen(!open)}
        icon={<CalendarIcon aria-hidden />}
        iconPosition="left"
        className={completeDays ? styles.completeTrigger : styles.triggerButton}
        aria-label={`Periode: ${periodLabel}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={popoverId}
      >
        <span className={styles.triggerLabel}>
          {periodLabel}
          {open ? (
            <ChevronUpIcon aria-hidden />
          ) : (
            <ChevronDownIcon aria-hidden />
          )}
        </span>
      </Button>

      {completeDays && isMobile ? (
        <Modal
          id={popoverId}
          open={open}
          onClose={closeAndRestoreFocus}
          header={{ heading: "Velg periode" }}
          width="small"
        >
          <Modal.Body>{open && periodEditor}</Modal.Body>
        </Modal>
      ) : (
        <Popover
          id={popoverId}
          role="dialog"
          aria-label="Velg periode"
          open={open}
          onClose={() => setOpen(false)}
          anchorEl={buttonRef.current}
          placement={isMobile ? "bottom" : "bottom-start"}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;

            const sourceDialog =
              event.target instanceof Element
                ? event.target.closest('[role="dialog"]')
                : null;
            if (sourceDialog !== event.currentTarget) return;

            event.preventDefault();
            event.stopPropagation();
            closeAndRestoreFocus();
          }}
        >
          <Popover.Content
            className={
              completeDays ? styles.completePopover : styles.popoverContent
            }
          >
            {open &&
              (completeDays ? (
                periodEditor
              ) : (
                <VStack gap="space-16">
                  {/* Desktop: Side by side */}
                  <Show above="md">
                    <HStack gap="space-16" align="start">
                      {/* Presets Column */}
                      <VStack gap="space-8" className={styles.desktopPresets}>
                        <Label size="small">Hurtigvalg</Label>
                        <PresetButtons
                          onSelect={handlePreset}
                          completeDays={completeDays}
                        />
                      </VStack>

                      {/* Divider */}
                      <div className={styles.verticalDivider} />

                      {/* Custom Range Column */}
                      <CustomPeriodInputs
                        onApply={handleApply}
                        fromDate={params.fromDate}
                        toDate={params.toDate}
                      />
                    </HStack>
                  </Show>

                  {/* Mobile: Vertical layout */}
                  <Hide above="md">
                    <VStack gap="space-16">
                      <VStack gap="space-8">
                        <Label size="small">Hurtigvalg</Label>
                        <PresetButtons
                          onSelect={handlePreset}
                          compact
                          completeDays={completeDays}
                        />
                      </VStack>

                      <div className={styles.horizontalDivider} />

                      <CustomPeriodInputs
                        onApply={handleApply}
                        fromDate={params.fromDate}
                        toDate={params.toDate}
                      />
                    </VStack>
                  </Hide>
                </VStack>
              ))}
          </Popover.Content>
        </Popover>
      )}
    </>
  );
}

/**
 * Preset period selection buttons
 */
function PresetButtons({
  onSelect,
  compact = false,
  completeDays = false,
  concise = false,
}: {
  onSelect: (days: number | "year" | "today") => void;
  compact?: boolean;
  completeDays?: boolean;
  concise?: boolean;
}) {
  const presets = [
    { label: compact ? "I dag" : "Hittil i dag", value: "today" as const },
    {
      label: completeDays
        ? "Siste 7 hele dager"
        : compact
          ? "7 dager"
          : "Siste 7 dager",
      value: 7,
    },
    {
      label: completeDays
        ? "Siste 30 hele dager"
        : compact
          ? "30 dager"
          : "Siste 30 dager",
      value: 30,
    },
    {
      label: completeDays
        ? "Siste 90 hele dager"
        : compact
          ? "3 mnd"
          : "Siste 3 måneder",
      value: 90,
    },
    {
      label: completeDays ? "Hittil i år (t.o.m. i går)" : "Hittil i år",
      value: "year" as const,
    },
  ].filter(
    (preset) =>
      !(
        completeDays &&
        preset.value === "year" &&
        todayInOslo().endsWith("-01-01")
      ),
  );

  // On mobile, show in a 2x3 grid for better touch targets
  if (compact) {
    return (
      <div className={styles.mobilePresetGrid}>
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant={concise ? "secondary" : "tertiary"}
            data-color={concise ? "neutral" : undefined}
            aria-label={concise ? preset.label : undefined}
            size="small"
            onClick={() => onSelect(preset.value)}
            className={styles.mobilePresetButton}
          >
            {concise ? concisePresetLabel(preset.value) : preset.label}
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
          className={styles.presetButton}
          data-color={concise ? "neutral" : undefined}
          aria-label={concise ? preset.label : undefined}
        >
          {concise ? concisePresetLabel(preset.value) : preset.label}
        </Button>
      ))}
    </>
  );
}

function concisePresetLabel(value: number | "year" | "today") {
  return value === "year"
    ? "Hittil i år"
    : value === "today"
      ? "I dag"
      : `${value} hele dager`;
}
