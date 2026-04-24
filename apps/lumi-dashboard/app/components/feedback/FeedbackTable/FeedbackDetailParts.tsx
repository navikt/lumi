import { BodyShort, Detail, HGrid, HStack, VStack } from "@navikt/ds-react";
import type { ReactNode } from "react";
import type { FeedbackDto } from "~/types/api";
import styles from "./styles.module.css";
import { deviceToIcon, formatMetadataKey, formatMetadataValue } from "./utils";

/**
 * Reusable section wrapper with label.
 * Used in both desktop expanded view and mobile card.
 */
export function ExpandedSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <VStack gap="space-8">
      {icon ? (
        <HStack gap="space-4" align="center">
          {icon}
          <Detail className={styles.expandedSectionLabel}>{label}</Detail>
        </HStack>
      ) : (
        <Detail className={styles.expandedSectionLabel}>{label}</Detail>
      )}
      {children}
    </VStack>
  );
}

/**
 * Single item in the context grid.
 * Displays an icon, label, and value for a context property.
 */
export function ContextItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.contextItem}>
      <span className={styles.contextIcon}>{icon}</span>
      <VStack gap="space-2">
        <Detail className={styles.contextLabel} textColor="subtle">
          {label}
        </Detail>
        <BodyShort className={styles.contextValue}>{value}</BodyShort>
      </VStack>
    </div>
  );
}

/**
 * Displays submission context (pathname, device, viewport).
 * Used in the desktop expanded view.
 */
export function ContextGrid({
  context,
}: {
  context: NonNullable<FeedbackDto["context"]>;
}) {
  return (
    <HGrid columns="repeat(auto-fit, minmax(180px, 1fr))" gap="space-12">
      {context.pathname && (
        <ContextItem icon="📍" label="Side" value={context.pathname} />
      )}
      {context.deviceType && (
        <ContextItem
          icon={deviceToIcon(context.deviceType)}
          label="Enhet"
          value={context.deviceType}
        />
      )}
      {(context.viewportWidth || context.viewportHeight) && (
        <ContextItem
          icon="🖼️"
          label="Viewport"
          value={`${context.viewportWidth || "?"}×${context.viewportHeight || "?"} `}
        />
      )}
    </HGrid>
  );
}

/**
 * Displays key-value pairs in a grid layout.
 * Used for segment tags and custom metadata.
 */
export function MetadataGrid({
  metadata,
}: {
  metadata: Record<string, string>;
}) {
  return (
    <HGrid columns="repeat(auto-fit, minmax(180px, 1fr))" gap="space-12">
      {Object.entries(metadata).map(([key, value]) => (
        <div key={key} className={styles.contextItem}>
          <VStack gap="space-2">
            <Detail className={styles.contextLabel} textColor="subtle">
              {formatMetadataKey(key)}
            </Detail>
            <BodyShort className={styles.contextValue}>
              {formatMetadataValue(value)}
            </BodyShort>
          </VStack>
        </div>
      ))}
    </HGrid>
  );
}
