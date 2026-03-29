import React, { useState } from 'react';

import { CatalogModal } from '@/components/catalog-modal';
import { getResearchCost } from '@/domain/facility-actions';
import { RESEARCH_CATALOG, type ResearchCatalogEntry } from '@/domain/research-catalog';
import type { Facility, FacilityId, ResearchId } from '@/domain/types';
import { getAvailableResearch, isResearchAvailable } from '@/domain/research-unlock';

type Props = {
  visible: boolean;
  onClose: () => void;
  onResearch: (entry: ResearchCatalogEntry) => void;
  completedResearch: Map<ResearchId, number>;
  facilities: Map<FacilityId, Facility>;
  now: number;
  funds: number;
  onDemolish?: () => void;
  demolishDisabled?: boolean;
  labProcessing?: boolean;
  actionDisabled?: boolean;
};

export function ResearchModal({ visible, onClose, onResearch, completedResearch, facilities, now, funds, onDemolish, demolishDisabled, labProcessing, actionDisabled }: Props) {
  const [selectedKey, setSelectedKey] = useState<string>(RESEARCH_CATALOG[0].key);
  const selected = RESEARCH_CATALOG.find((e) => e.key === selectedKey) ?? RESEARCH_CATALOG[0];

  const items = getAvailableResearch(completedResearch).map((e) => {
    const cost = getResearchCost(e, completedResearch);
    const nextLevel = (completedResearch.get(e.key as ResearchId) ?? 0) + 1;
    const activeLab = [...facilities.values()].find(
      (f) => f.kind === 'laboratory' && f.state === 'processing' && f.activeResearchId === e.key,
    );
    const progress = activeLab?.currentJob
      ? Math.min(1, (now - activeLab.currentJob.startedAt) / activeLab.currentJob.durationMs)
      : undefined;
    return {
      key: e.key,
      name: e.repeatable ? `${e.name} Lv.${nextLevel}` : e.name,
      costLabel: e.repeatable ? `${cost.toLocaleString()} G〜` : `${cost.toLocaleString()} G`,
      disabled: !isResearchAvailable(e, completedResearch, funds, facilities),
      special: e.special ?? false,
      progress,
    };
  });

  const selectedIsActive = [...facilities.values()].some(
    (f) => f.kind === 'laboratory' && f.state === 'processing' && f.activeResearchId === selected.key,
  );

  return (
    <CatalogModal
      visible={visible}
      onClose={onClose}
      items={items}
      selectedKey={selectedKey}
      onSelectKey={setSelectedKey}
      descriptionTitle={selected.name}
      descriptionText={selected.description}
      actionLabel={`研究する（${getResearchCost(selected, completedResearch).toLocaleString()} G）`}
      onAction={() => {
        onResearch(selected);
        onClose();
      }}
      onDemolish={onDemolish}
      demolishDisabled={demolishDisabled}
      actionForceDisabled={labProcessing || selectedIsActive || actionDisabled}
    />
  );
}
