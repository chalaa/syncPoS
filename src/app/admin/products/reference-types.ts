import type { ReactNode } from "react";

import type { CatalogReferenceKind, CatalogReferenceRecord } from "@/server/catalog/types";

export type ReferenceMutation = (formData: FormData) => Promise<void>;

export type ReferenceManagerConfig = {
  kind: CatalogReferenceKind;
  eyebrow: string;
  title: string;
  description: string;
  createLabel: string;
  showPrecision: boolean;
  showSpecifications?: boolean;
  basePath: string;
  createAction: ReferenceMutation;
  updateAction: ReferenceMutation;
  softDeleteAction: ReferenceMutation;
  restoreAction: ReferenceMutation;
};

export type ReferenceManagerProps = ReferenceManagerConfig & {
  records: CatalogReferenceRecord[];
  query: string;
  showDeleted: boolean;
  notice?: string;
  error?: string;
  returnPath: string;
  afterContent?: ReactNode;
};
