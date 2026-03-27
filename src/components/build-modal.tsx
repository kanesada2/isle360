import React, { useState } from 'react';

import { CatalogModal } from '@/components/catalog-modal';
import { FACILITY_CATALOG, type FacilityCatalogEntry } from '@/domain/facility-catalog';

type Props = {
  visible: boolean;
  onClose: () => void;
  onBuild: (entry: FacilityCatalogEntry) => void;
  availableFacilityKeys: Set<string>;
  /** 現在建設不可の施設キー（資金・解放条件とは別の理由で無効化したいもの） */
  blockedFacilityKeys?: Set<string>;
  funds: number;
  discountRate: number;
  actionDisabled?: boolean;
};

export function BuildModal({ visible, onClose, onBuild, availableFacilityKeys, blockedFacilityKeys, funds, discountRate, actionDisabled = false }: Props) {
  const firstAvailableKey =
    FACILITY_CATALOG.find((e) => availableFacilityKeys.has(e.key))?.key ?? FACILITY_CATALOG[0].key;
  const [selectedKey, setSelectedKey] = useState<string>(firstAvailableKey);
  const selected = FACILITY_CATALOG.find((e) => e.key === selectedKey) ?? FACILITY_CATALOG[0];

  const actualCost = (buildCost: number) => Math.round(buildCost * (1 - discountRate));

  const items = FACILITY_CATALOG.map((e) => ({
    key: e.key,
    name: e.name,
    costLabel: `${actualCost(e.buildCost).toLocaleString()} G`,
    disabled:
      !availableFacilityKeys.has(e.key) ||
      actualCost(e.buildCost) > funds ||
      (blockedFacilityKeys?.has(e.key) ?? false),
  }));

  return (
    <CatalogModal
      visible={visible}
      onClose={onClose}
      items={items}
      selectedKey={selectedKey}
      onSelectKey={setSelectedKey}
      descriptionTitle={selected.name}
      descriptionText={selected.description}
      actionLabel={`建設する（${actualCost(selected.buildCost).toLocaleString()} G）`}
      actionForceDisabled={actionDisabled}
      onAction={() => {
        onBuild(selected);
        onClose();
      }}
    />
  );
}
