"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Barcode,
  Boxes,
  CalendarClock,
  Check,
  CheckCircle2,
  Coins,
  ExternalLink,
  FileCheck,
  FileText,
  Layers,
  LoaderCircleIcon,
  PackagePlus,
  Receipt,
  SlidersHorizontal,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import {
  checkDuplicateProductAction,
  createProductModalAction,
  createCategoryModalAction,
  createBrandModalAction,
  createUnitModalAction,
} from "@/app/admin/products/actions";
import type { DuplicateMatch } from "@/server/catalog/duplicate-detection";
import {
  bestMatchingCategory,
  bestMatchingOption,
  brandCountryFallbacks,
  extractModel,
  extractSpecificationValue,
} from "@/app/admin/products/product-autofill";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountrySelectField } from "@/components/ui/country-select-field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ManyToManyTags, type ManyToManyTagOption } from "@/components/ui/many-to-many-tags";
import { RelatedModelSelect } from "@/components/ui/related-model-select";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";
import type {
  CategorySelectOption,
  SelectOption,
  TrackingModeOption,
} from "@/server/catalog/types";

export type NewProductModalProps = {
  categories: CategorySelectOption[];
  brands: SelectOption[];
  units: SelectOption[];
  taxes: { id: string; label: string; scope: "purchase" | "sale" | "both" }[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialOpen?: boolean;
  initialProductName?: string;
  trigger?: React.ReactNode;
  onSuccess?: (product: {
    id: string;
    sku: string;
    name: string;
    standardCostMinor?: number;
    listPriceMinor?: number;
    saleTaxIds?: string[];
    purchaseTaxIds?: string[];
  }) => void;
};

import type { TranslationKey } from "@/lib/i18n/translations";

const trackingModes: {
  id: TrackingModeOption;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  descriptionKey: TranslationKey;
  badgeKey: TranslationKey;
  icon: typeof Boxes;
}[] = [
  {
    id: "none",
    titleKey: "tracking.mode.none.title",
    subtitleKey: "tracking.mode.none.subtitle",
    descriptionKey: "tracking.mode.none.description",
    badgeKey: "tracking.mode.none.badge",
    icon: Boxes,
  },
  {
    id: "serial",
    titleKey: "tracking.mode.serial.title",
    subtitleKey: "tracking.mode.serial.subtitle",
    descriptionKey: "tracking.mode.serial.description",
    badgeKey: "tracking.mode.serial.badge",
    icon: Barcode,
  },
  {
    id: "lot",
    titleKey: "tracking.mode.lot.title",
    subtitleKey: "tracking.mode.lot.subtitle",
    descriptionKey: "tracking.mode.lot.description",
    badgeKey: "tracking.mode.lot.badge",
    icon: CalendarClock,
  },
];

type StepId = 1 | 2 | 3;

const steps: { id: StepId; titleKey: TranslationKey; subtitleKey: TranslationKey; icon: typeof Tag }[] = [
  { id: 1, titleKey: "modal.newProduct.step1Title", subtitleKey: "modal.newProduct.step1Subtitle", icon: Tag },
  { id: 2, titleKey: "modal.newProduct.step2Title", subtitleKey: "modal.newProduct.step2Subtitle", icon: Coins },
  { id: 3, titleKey: "modal.newProduct.step3Title", subtitleKey: "modal.newProduct.step3Subtitle", icon: SlidersHorizontal },
];

export function NewProductModal({
  categories,
  brands,
  units,
  taxes,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  initialOpen = false,
  initialProductName = "",
  trigger,
  onSuccess,
}: NewProductModalProps) {
  const router = useRouter();
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(initialOpen);
  const open = isControlled ? openProp : internalOpen;
  const [step, setStep] = useState<StepId>(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [localCategories, setLocalCategories] = useState<CategorySelectOption[]>(categories);
  const [localBrands, setLocalBrands] = useState<SelectOption[]>(brands);
  const [localUnits, setLocalUnits] = useState<SelectOption[]>(units);

  useEffect(() => { setLocalCategories(categories); }, [categories]);
  useEffect(() => { setLocalBrands(brands); }, [brands]);
  useEffect(() => { setLocalUnits(units); }, [units]);

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [quickBrandName, setQuickBrandName] = useState("");
  const [quickUnitName, setQuickUnitName] = useState("");

  const initialBrand = bestMatchingOption(localBrands, initialProductName);
  const initialCategory = bestMatchingCategory(localCategories, initialProductName);
  const initialModel = extractModel(initialProductName, initialBrand, initialCategory);

  const [productName, setProductName] = useState(initialProductName);
  const [categoryId, setCategoryId] = useState(initialCategory?.id ?? "");
  const [brandId, setBrandId] = useState(initialBrand?.id ?? "");
  const [country, setCountry] = useState(
    initialBrand?.country ?? brandCountryFallbacks[initialBrand?.name.toLowerCase() ?? ""] ?? "",
  );
  const [model, setModel] = useState(initialModel);
  const [trackingMode, setTrackingMode] = useState<TrackingModeOption>("none");
  const [listPrice, setListPrice] = useState("");
  const [standardCost, setStandardCost] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [customSku, setCustomSku] = useState("");
  const [description, setDescription] = useState("");
  const [saleTaxIds, setSaleTaxIds] = useState<string[]>([]);
  const [purchaseTaxIds, setPurchaseTaxIds] = useState<string[]>([]);
  const [specificationValues, setSpecificationValues] = useState<Record<string, string>>({});
  const [manualSpecificationKeys, setManualSpecificationKeys] = useState<Set<string>>(new Set());

  const [manualFields, setManualFields] = useState({
    brand: false,
    category: false,
    country: false,
    model: false,
  });

  const selectedCategory = useMemo(
    () => localCategories.find((cat) => cat.id === categoryId),
    [localCategories, categoryId],
  );
  const selectedBrand = useMemo(
    () => localBrands.find((brand) => brand.id === brandId),
    [localBrands, brandId],
  );
  const selectedUnit = useMemo(
    () => localUnits.find((unit) => unit.id === unitId),
    [localUnits, unitId],
  );
  const specificationFields = useMemo(
    () => selectedCategory?.specificationSchema ?? [],
    [selectedCategory?.specificationSchema],
  );

  const generatedStandardName = useMemo(() => {
    const parts = [
      selectedBrand?.name,
      model.trim(),
      selectedCategory?.name,
      ...specificationFields.map((field) => specificationValues[field.key]?.trim()).filter(Boolean),
    ].filter(Boolean);

    return parts.join(" ");
  }, [model, selectedBrand?.name, selectedCategory?.name, specificationFields, specificationValues]);

  const standardName = generatedStandardName || "";

  // Duplicate Detection State
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const { t } = useTranslation();
  const [liveDuplicate, setLiveDuplicate] = useState<DuplicateMatch | null>(null);

  // Debounced live duplicate detection on Step 1
  useEffect(() => {
    if (!productName || productName.trim().length < 4) {
      setLiveDuplicate(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await checkDuplicateProductAction({
          name: productName,
          brandId: brandId || null,
          categoryId: categoryId || null,
          model: model || null,
          standardName: standardName || null,
        });
        if (res.duplicates && res.duplicates.length > 0) {
          setLiveDuplicate(res.duplicates[0]);
          setDuplicateMatches(res.duplicates);
        } else {
          setLiveDuplicate(null);
        }
      } catch {
        // silent fallback
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [productName, brandId, categoryId, model, standardName]);

  // Live Commercial Profitability Calculation
  const priceNum = parseFloat(listPrice) || 0;
  const costNum = parseFloat(standardCost) || 0;
  const profit = priceNum - costNum;
  const marginPercent = priceNum > 0 ? (profit / priceNum) * 100 : 0;

  const saleTaxOptions: ManyToManyTagOption[] = useMemo(
    () =>
      taxes
        .filter((tax) => tax.scope === "sale" || tax.scope === "both")
        .map((tax) => ({ id: tax.id, label: tax.label })),
    [taxes],
  );

  const purchaseTaxOptions: ManyToManyTagOption[] = useMemo(
    () =>
      taxes
        .filter((tax) => tax.scope === "purchase" || tax.scope === "both")
        .map((tax) => ({ id: tax.id, label: tax.label })),
    [taxes],
  );

  const detectedSpecsList = useMemo(() => {
    return specificationFields
      .map((field) => ({
        key: field.key,
        label: field.label,
        value: specificationValues[field.key] ?? "",
      }))
      .filter((item) => item.value.trim().length > 0);
  }, [specificationFields, specificationValues]);

  const hasSmartDetections = Boolean(
    selectedBrand || selectedCategory || model || country || detectedSpecsList.length > 0,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const stepChangedAt = useRef<number>(0);

  function resetForm() {
    setStep(1);
    stepChangedAt.current = 0;
    setProductName("");
    setCategoryId("");
    setBrandId("");
    setCountry("");
    setModel("");
    setTrackingMode("none");
    setListPrice("");
    setStandardCost("");
    setUnitId(units[0]?.id ?? "");
    setCustomSku("");
    setDescription("");
    setSaleTaxIds([]);
    setPurchaseTaxIds([]);
    setSpecificationValues({});
    setManualSpecificationKeys(new Set());
    setManualFields({
      brand: false,
      category: false,
      country: false,
      model: false,
    });
    setError(null);
    setDuplicateMatches([]);
    setShowDuplicateWarning(false);
    setIsCheckingDuplicates(false);
    setLiveDuplicate(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChangeProp?.(nextOpen);
    if (!nextOpen) {
      setError(null);
      setShowDuplicateWarning(false);
      setIsCheckingDuplicates(false);
    }
  }

  function changeBrand(nextBrandId: string) {
    setBrandId(nextBrandId);
    setManualFields((current) => ({ ...current, brand: true }));
    const brand = localBrands.find((item) => item.id === nextBrandId);

    if (brand?.country) {
      setCountry(brand.country);
    } else if (brand?.name) {
      const fallback = brandCountryFallbacks[brand.name.toLowerCase() ?? ""];
      if (fallback) setCountry(fallback);
    }

    if (productName.trim() && (!manualFields.model || !model)) {
      const extractedModel = extractModel(productName, brand, selectedCategory);
      if (extractedModel) {
        setModel(extractedModel);
      }
    }
  }

  function changeCategory(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    setManualFields((current) => ({ ...current, category: true }));

    const category = localCategories.find((item) => item.id === nextCategoryId);
    if (category?.specificationSchema && category.specificationSchema.length > 0 && productName.trim()) {
      setSpecificationValues((current) => {
        const next = { ...current };
        category.specificationSchema.forEach((field) => {
          if (manualSpecificationKeys.has(field.key)) {
            return;
          }
          const val = extractSpecificationValue(field, productName);
          if (val) {
            next[field.key] = val;
          }
        });
        return next;
      });
    }

    // Also re-evaluate model if not manually set, using the new category context
    if (productName.trim() && (!manualFields.model || !model)) {
      const extractedModel = extractModel(productName, selectedBrand, category);
      if (extractedModel) {
        setModel(extractedModel);
      }
    }
  }

  function handleReAutofillSpecifications() {
    if (!productName.trim() || specificationFields.length === 0) return;
    setSpecificationValues((current) => {
      const next = { ...current };
      specificationFields.forEach((field) => {
        const val = extractSpecificationValue(field, productName);
        if (val) {
          next[field.key] = val;
        }
      });
      return next;
    });
  }

  function applyProductNameSuggestions(nextProductName: string) {
    const matchedBrand = bestMatchingOption(brands, nextProductName);
    const nextBrand = matchedBrand ?? selectedBrand;
    const matchedCategory = bestMatchingCategory(categories, nextProductName);
    const nextCategory = matchedCategory ?? selectedCategory;

    if (matchedBrand && (!manualFields.brand || !brandId)) {
      setBrandId(matchedBrand.id);
    }

    if (matchedCategory && (!manualFields.category || !categoryId)) {
      setCategoryId(matchedCategory.id);
    }

    const nextCountry =
      nextBrand?.country || (brandCountryFallbacks[nextBrand?.name.toLowerCase() ?? ""] ?? "");
    if (nextCountry && (!manualFields.country || !country)) {
      setCountry(nextCountry);
    }

    const nextModel = extractModel(nextProductName, nextBrand, nextCategory);
    if (nextModel && (!manualFields.model || !model)) {
      setModel(nextModel);
    }

    const activeCat = matchedCategory && (!manualFields.category || !categoryId) ? matchedCategory : selectedCategory;
    const fields = activeCat?.specificationSchema ?? specificationFields;
    if (fields.length > 0) {
      setSpecificationValues((current) => {
        const next = { ...current };

        fields.forEach((field) => {
          if (manualSpecificationKeys.has(field.key)) {
            return;
          }

          const value = extractSpecificationValue(field, nextProductName);

          if (value) {
            next[field.key] = value;
          }
        });

        return next;
      });
    }
  }

  function changeProductName(nextProductName: string) {
    setProductName(nextProductName);
    applyProductNameSuggestions(nextProductName);
  }

  function goToStep(nextStep: StepId) {
    if (nextStep > 1 && !productName.trim()) {
      setError(t("validation.productNameRequired"));
      return;
    }
    setError(null);
    stepChangedAt.current = Date.now();

    // If advancing to Step 3, auto-extract any missing specs from the current product name
    if (nextStep === 3 && productName.trim() && specificationFields.length > 0) {
      setSpecificationValues((current) => {
        let changed = false;
        const next = { ...current };
        specificationFields.forEach((field) => {
          if (!manualSpecificationKeys.has(field.key) && !next[field.key]) {
            const val = extractSpecificationValue(field, productName);
            if (val) {
              next[field.key] = val;
              changed = true;
            }
          }
        });
        return changed ? next : current;
      });
    }

    setStep(nextStep);
  }

  function handleFinalSubmit(allowDuplicate: boolean = false) {
    if (step !== 3 && !allowDuplicate) {
      return;
    }

    // Cooldown guard: if step 3 was entered less than 600ms ago, ignore click
    if (Date.now() - stepChangedAt.current < 600 && !allowDuplicate) {
      return;
    }

    if (!productName.trim()) {
      setStep(1);
      setError(t("validation.productNameRequiredShort"));
      return;
    }

    if (!formRef.current) {
      return;
    }

    setError(null);

    // If duplicate has not been explicitly allowed yet, check duplicates first before adding to DB!
    if (!allowDuplicate) {
      setIsCheckingDuplicates(true);
      startTransition(async () => {
        try {
          const checkRes = await checkDuplicateProductAction({
            name: productName,
            brandId: brandId || null,
            categoryId: categoryId || null,
            model: model || null,
            standardName: standardName || null,
          });

          setIsCheckingDuplicates(false);

          if (checkRes.duplicates && checkRes.duplicates.length > 0) {
            setDuplicateMatches(checkRes.duplicates);
            setShowDuplicateWarning(true);
            return;
          }

          // No duplicates detected, execute creation immediately
          executeProductCreation(false);
        } catch {
          setIsCheckingDuplicates(false);
          // If check fails unexpectedly, continue to create where server-side check is also enforced
          executeProductCreation(false);
        }
      });
      return;
    }

    // User confirmed to create anyway
    executeProductCreation(true);
  }

  function executeProductCreation(allowDuplicate: boolean) {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    if (allowDuplicate) {
      formData.set("allowDuplicate", "true");
    }

    startTransition(async () => {
      const result = await createProductModalAction(formData);

      if (!result.success) {
        if (result.duplicateDetected && result.duplicates && result.duplicates.length > 0) {
          setDuplicateMatches(result.duplicates);
          setShowDuplicateWarning(true);
          return;
        }
        setError(result.error ?? t("validation.productCreateError"));
        return;
      }

      setShowDuplicateWarning(false);
      handleOpenChange(false);
      resetForm();

      if (onSuccess && result.product) {
        onSuccess(result.product);
      }

      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Stop propagation to prevent React's synthetic event system from bubbling
    // this submit event up through portals into a parent form (e.g. purchase/sales order form).
    event.stopPropagation();
    if (step < 3) {
      goToStep((step + 1) as StepId);
    }
    // Note: Do not automatically submit on Enter when on step 3 so users can freely type specifications.
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !isControlled ? (
        <DialogTrigger asChild>
          <Button className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 transition-all hover:brightness-110 active:scale-[0.99]">
            <PackagePlus className="size-4 text-emerald-200" />
            {t("action.newProduct")}
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1rem)] sm:w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] p-0 overflow-y-auto flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl z-[60] outline-none"
        overlayClassName="z-[60]"
        showCloseButton={false}
      >
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col min-h-0">
          {/* Top Brand Accent Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441]" />

          {/* Modal Header */}
          <DialogHeader className="border-b border-border/70 bg-background/95 px-4 sm:px-6 py-4 backdrop-blur-md flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/20">
                <PackagePlus className="h-5 w-5 text-emerald-200" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                    {t("modal.newProduct.title")}
                  </DialogTitle>
                  <Badge variant="accent" size="sm" className="hidden sm:inline-flex text-[10px]">
                    {t("modal.newProduct.stepOfCount").replace("{step}", String(step))}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {step === 1 && t("modal.newProduct.step1Desc")}
                  {step === 2 && t("modal.newProduct.step2Desc")}
                  {step === 3 && t("modal.newProduct.step3Desc")}
                </p>
              </div>
            </div>

            <DialogClose
              type="button"
              className="rounded-lg p-1.5 sm:p-2 bg-red-500 text-white hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 shadow-2xs"
              aria-label={t("product.close")}
            >
              <X className="size-4.5" />
            </DialogClose>
          </DialogHeader>

          {/* Stepper Navigation Bar */}
          <div className="border-b border-border/70 bg-secondary/30 px-4 sm:px-6 py-2.5 overflow-x-auto no-scrollbar">
            <div className="grid grid-cols-3 gap-2 min-w-[320px] sm:min-w-0">
              {steps.map((s) => {
                const isCurrent = step === s.id;
                const isCompleted = step > s.id;
                const StepIcon = s.icon;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToStep(s.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-all",
                      isCurrent
                        ? "bg-card border border-[#0B5D4B]/30 shadow-2xs"
                        : isCompleted
                          ? "hover:bg-card/60 cursor-pointer"
                          : "opacity-60 cursor-default",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                        isCurrent
                          ? "bg-[#0B5D4B] text-white ring-2 ring-[#0B5D4B]/20"
                          : isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {isCompleted ? <Check className="size-3.5" /> : s.id}
                    </div>
                    <div className="hidden sm:block min-w-0">
                      <p
                        className={cn(
                          "text-xs font-bold truncate leading-tight",
                          isCurrent
                            ? "text-[#0B5D4B]"
                            : isCompleted
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {t(s.titleKey)}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate leading-tight">
                        {t(s.subtitleKey)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Content Body */}
          <div className="p-4 sm:p-6 space-y-4">
            {error ? <Alert kind="error">{error}</Alert> : null}

            {units.length === 0 ? (
              <Alert kind="warning">
                {t("product.createUnitWarning")}
              </Alert>
            ) : null}

            {/* Hidden Fields to Ensure Full Form Compatibility Across All Steps */}
            <input type="hidden" name="isActive" value="on" />
            <input type="hidden" name="name" value={productName} />
            <input type="hidden" name="standardName" value={standardName} />
            <input type="hidden" name="categoryId" value={categoryId} />
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="model" value={model} />
            <input type="hidden" name="unitId" value={unitId} />
            <input type="hidden" name="country" value={country} />
            <input type="hidden" name="listPrice" value={listPrice} />
            <input type="hidden" name="standardCost" value={standardCost} />
            <input type="hidden" name="trackingMode" value={trackingMode} />
            <input type="hidden" name="sku" value={customSku} />
            <input type="hidden" name="description" value={description} />
            <input type="hidden" name="saleTaxIds" value={saleTaxIds.join(",")} />
            <input type="hidden" name="purchaseTaxIds" value={purchaseTaxIds.join(",")} />

            {/* Specification hidden inputs */}
            {specificationFields.map((field) => (
              <span key={field.key} className="hidden">
                <input type="hidden" name="specificationKey" value={field.key} />
                <input
                  type="hidden"
                  name={`specificationValue:${field.key}`}
                  value={specificationValues[field.key] ?? ""}
                />
              </span>
            ))}

            {/* STEP 1: IDENTITY & CLASSIFICATION */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                {/* Hero Title Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="step1-product-name"
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      <span>{t("field.productTitleDesc")}</span>
                      <span className="text-destructive">*</span>
                    </label>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0B5D4B]">
                      <Sparkles className="size-3 text-[#D9A441]" />
                      {t("product.autoDetectionActive")}
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <div className="pointer-events-none absolute left-3.5 flex items-center text-[#D9A441]">
                      <Sparkles className="size-4.5" />
                    </div>
                    <input
                      id="step1-product-name"
                      value={productName}
                      onChange={(event) => changeProductName(event.target.value)}
                      placeholder={t("field.productTitlePlaceholder")}
                      maxLength={200}
                      required
                      autoFocus
                      className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-9 text-base font-medium text-foreground shadow-2xs outline-none transition-all placeholder:text-muted-foreground/60 focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20"
                    />
                    {productName ? (
                      <button
                        type="button"
                        onClick={() => changeProductName("")}
                        className="absolute right-3 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title={t("action.clearTitle")}
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </div>

                  {/* Live Potential Duplicate Alert */}
                  {liveDuplicate && (
                    <div className="flex items-center justify-between gap-2.5 rounded-xl border border-amber-400/80 bg-amber-50/95 px-3.5 py-2.5 text-xs text-amber-950 animate-in fade-in-50 duration-200 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="size-3.5" />
                        </div>
                        <div className="truncate text-amber-950">
                          <span className="font-bold text-amber-950">{t("product.possibleDuplicate")}</span>{" "}
                          <span className="font-mono font-bold text-amber-950">{liveDuplicate.sku}</span> — <span className="font-medium text-amber-900">{liveDuplicate.name}</span>{" "}
                          <span className="inline-block rounded-full bg-amber-200/90 px-2 py-0.5 text-[10px] font-bold text-amber-950 border border-amber-300">
                            {liveDuplicate.similarityScore}% {t("product.match")}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDuplicateWarning(true)}
                        className="shrink-0 rounded-md bg-amber-200/90 hover:bg-amber-300 px-2.5 py-1 font-bold text-amber-950 text-[11px] transition-colors border border-amber-300"
                      >
                        {t("action.reviewExisting")}
                      </button>
                    </div>
                  )}

                  {/* Smart Detection Banner */}
                  {hasSmartDetections && productName.trim().length > 0 && (
                    <div className="rounded-lg border border-[#0B5D4B]/25 bg-secondary/20 p-2.5 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#0B5D4B] text-[11px] mr-1">
                          <Sparkles className="size-3 text-[#D9A441]" />
                          {t("product.matched")}
                        </span>
                        {selectedBrand && (
                          <span className="inline-flex items-center gap-1 rounded bg-card px-2 py-0.5 text-xs font-semibold text-[#0B5D4B] border border-border/60">
                            {t("field.brand")}: {selectedBrand.name} <Check className="size-3" />
                          </span>
                        )}
                        {selectedCategory && (
                          <span className="inline-flex items-center gap-1 rounded bg-card px-2 py-0.5 text-xs font-semibold text-foreground border border-border/60">
                            {t("field.category")}: {selectedCategory.name} <Check className="size-3 text-[#0B5D4B]" />
                          </span>
                        )}
                        {model && (
                          <span className="rounded bg-card px-2 py-0.5 text-xs font-mono text-foreground border border-border/60">
                            {t("field.model")}: {model}
                          </span>
                        )}
                        {country && (
                          <span className="rounded bg-card px-2 py-0.5 text-xs text-foreground border border-border/60">
                            {t("product.origin")}: {country}
                          </span>
                        )}
                        {detectedSpecsList.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#0B5D4B]/10 px-2 py-0.5 text-xs font-semibold text-[#0B5D4B] border border-[#0B5D4B]/30">
                            {detectedSpecsList.length} {t("product.specsDetected")} <Sparkles className="size-3 text-[#D9A441]" />
                          </span>
                        )}
                      </div>
                      {standardName && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                          <span className="font-semibold uppercase tracking-wider text-[10px]">{t("product.standardDisplay")}</span>
                          <span className="font-bold text-[#0B5D4B] truncate">{standardName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Classification Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <RelatedModelSelect
                    label={t("field.category")}
                    options={localCategories}
                    value={categoryId}
                    onValueChange={changeCategory}
                    placeholder={t("field.selectCategory")}
                    emptyLabel={t("field.noCategoriesFound")}
                    createLabel={t("action.addCategoryQuick")}
                    onCreateAndEdit={(query) => {
                      setQuickCategoryName(query);
                      setIsAddCategoryOpen(true);
                    }}
                  />

                  <RelatedModelSelect
                    label={t("field.brand")}
                    options={localBrands}
                    value={brandId}
                    onValueChange={changeBrand}
                    placeholder={t("field.selectBrand")}
                    emptyLabel={t("field.noBrandsFound")}
                    createLabel={t("action.addBrandQuick")}
                    onCreateAndEdit={(query) => {
                      setQuickBrandName(query);
                      setIsAddBrandOpen(true);
                    }}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-xs font-semibold text-foreground">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{t("field.model")}</span>
                      <input
                        value={model}
                        onChange={(event) => {
                          setModel(event.target.value);
                          setManualFields((current) => ({ ...current, model: true }));
                        }}
                        placeholder={t("field.modelPlaceholder")}
                        maxLength={100}
                        className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-[#0B5D4B] focus:ring-1 focus:ring-[#0B5D4B]"
                      />
                    </label>

                    <RelatedModelSelect
                      label={t("field.unit")}
                      options={localUnits}
                      value={unitId}
                      onValueChange={setUnitId}
                      required
                      placeholder={t("field.selectUnit")}
                      emptyLabel={t("field.noUnitsFound")}
                      createLabel={t("action.addUnitQuick")}
                      onCreateAndEdit={(query) => {
                        setQuickUnitName(query);
                        setIsAddUnitOpen(true);
                      }}
                    />
                  </div>

                  <CountrySelectField
                    name="_unused_country"
                    label={t("field.countryOfOrigin")}
                    value={country}
                    onValueChange={(nextCountry) => {
                      setCountry(nextCountry);
                      setManualFields((current) => ({ ...current, country: true }));
                    }}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: PRICING & INVENTORY POLICY */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                {/* Pricing Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                    <span className="text-muted-foreground uppercase tracking-wider text-[11px]">
                      {t("product.salesPriceEtb")}
                    </span>
                    <div className="relative flex items-center">
                      <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground">
                        ETB
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={listPrice}
                        onChange={(e) => setListPrice(e.target.value)}
                        placeholder="0.00"
                        className="h-11 w-full rounded-lg border border-input bg-background pl-12 pr-3 text-base font-bold text-foreground outline-none transition-colors focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20"
                      />
                    </div>
                  </label>

                  <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                    <span className="text-muted-foreground uppercase tracking-wider text-[11px]">
                      {t("product.purchaseCostEtb")}
                    </span>
                    <div className="relative flex items-center">
                      <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground">
                        ETB
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={standardCost}
                        onChange={(e) => setStandardCost(e.target.value)}
                        placeholder="0.00"
                        className="h-11 w-full rounded-lg border border-input bg-background pl-12 pr-3 text-base font-bold text-foreground outline-none transition-colors focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20"
                      />
                    </div>
                  </label>
                </div>

                {/* Live Margin Calculation Card */}
                <div className="rounded-xl border border-border/80 bg-gradient-to-r from-secondary/40 via-card to-secondary/30 p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("product.expectedProfitPerUnit")}
                    </span>
                    {priceNum > 0 ? (
                      profit >= 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                          <TrendingUp className="size-3.5 text-emerald-600" />
                          {marginPercent >= 20 ? t("product.healthyMargin") : t("product.lowMargin")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-destructive">
                          <AlertTriangle className="size-3.5" />
                          {t("product.sellingBelowCost")}
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{t("product.enterPricesCalcMargin")}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-black text-foreground">
                        {profit >= 0 ? "+" : ""}
                        {profit.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">{t("product.etbProfit")}</span>
                    </div>

                    <Badge
                      variant={
                        priceNum === 0
                          ? "muted"
                          : profit < 0
                            ? "destructive"
                            : marginPercent >= 20
                              ? "accent"
                              : "secondary"
                      }
                      size="lg"
                      className="font-bold font-mono text-sm px-3"
                    >
                      {priceNum > 0 ? `${marginPercent.toFixed(1)}% ${t("product.marginLabel")}` : `0.0% ${t("product.marginLabel")}`}
                    </Badge>
                  </div>
                </div>

                {/* Tracking Mode 3 Interactive Cards */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("field.tracking")}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {trackingModes.map((modeOption) => {
                      const isSelected = trackingMode === modeOption.id;
                      const ModeIcon = modeOption.icon;

                      return (
                        <button
                          key={modeOption.id}
                          type="button"
                          onClick={() => setTrackingMode(modeOption.id)}
                          className={cn(
                            "relative flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                            isSelected
                              ? "border-[#0B5D4B] bg-[#0B5D4B]/5 ring-2 ring-[#0B5D4B]/20 shadow-2xs"
                              : "border-border/80 bg-background hover:bg-secondary/40 hover:border-border",
                          )}
                        >
                          <div className="flex items-center justify-between w-full mb-1.5">
                            <div
                              className={cn(
                                "flex size-7 items-center justify-center rounded-lg",
                                isSelected
                                  ? "bg-[#0B5D4B] text-white"
                                  : "bg-secondary text-muted-foreground",
                              )}
                            >
                              <ModeIcon className="size-4" />
                            </div>
                            {isSelected ? (
                              <CheckCircle2 className="size-4 text-[#0B5D4B]" />
                            ) : null}
                          </div>
                          <span className="text-xs font-bold text-foreground">{t(modeOption.titleKey)}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2 mt-0.5">
                            {t(modeOption.descriptionKey)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SPECIFICATIONS, TAXES & CONFIRMATION */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                {/* Dynamic Category Specifications */}
                {specificationFields.length > 0 ? (
                  <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="size-4 text-[#0B5D4B]" />
                        <span className="text-xs font-bold text-foreground">
                          {t("product.techSpecs")}{selectedCategory ? ` (${selectedCategory.name})` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleReAutofillSpecifications}
                          className="h-7 text-[11px] gap-1 px-2.5 text-[#0B5D4B] border-[#0B5D4B]/30 hover:bg-[#0B5D4B]/10 hover:text-[#0B5D4B] transition-colors"
                          title={t("product.autofillTooltip")}
                        >
                          <Sparkles className="size-3 text-[#D9A441]" />
                          <span>{t("action.autofillFromTitle")}</span>
                        </Button>
                        <Badge variant="primary" size="sm" className="text-[10px]">
                          {specificationFields.length} {t("product.attributes")}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {specificationFields.map((field) => {
                        const isAutoDetected = Boolean(
                          specificationValues[field.key] && !manualSpecificationKeys.has(field.key),
                        );

                        return (
                          <label key={field.key} className="grid gap-1 text-xs font-medium">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground truncate">{field.label}</span>
                              {isAutoDetected && (
                                <span className="text-[10px] text-[#0B5D4B] font-semibold">✨ {t("product.auto")}</span>
                              )}
                            </div>
                            <input
                              value={specificationValues[field.key] ?? ""}
                              onChange={(event) => {
                                setManualSpecificationKeys(
                                  (current) => new Set(current).add(field.key),
                                );
                                setSpecificationValues((current) => ({
                                  ...current,
                                  [field.key]: event.target.value,
                                }));
                              }}
                              placeholder={`e.g. ${field.label}`}
                              className={cn(
                                "h-9 rounded-lg border bg-background px-2.5 text-xs font-medium text-foreground outline-none transition-colors focus:border-[#0B5D4B] focus:ring-1 focus:ring-[#0B5D4B]",
                                isAutoDetected ? "border-[#0B5D4B]/40 bg-[#0B5D4B]/5" : "border-input",
                              )}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/80 p-3 text-center text-xs text-muted-foreground">
                    {t("catalog.noCategorySpecs")}
                  </div>
                )}

                {/* Taxes Grid */}
                {saleTaxOptions.length > 0 || purchaseTaxOptions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {saleTaxOptions.length > 0 ? (
                      <label className="grid gap-1 text-xs font-semibold text-foreground">
                        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                          {t("product.customerSalesTaxes")}
                        </span>
                        <ManyToManyTags
                          options={saleTaxOptions}
                          value={saleTaxIds}
                          onChange={setSaleTaxIds}
                          placeholder={t("product.customerSalesTaxesPlaceholder")}
                        />
                      </label>
                    ) : null}

                    {purchaseTaxOptions.length > 0 ? (
                      <label className="grid gap-1 text-xs font-semibold text-foreground">
                        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
                          {t("product.vendorPurchaseTaxes")}
                        </span>
                        <ManyToManyTags
                          options={purchaseTaxOptions}
                          value={purchaseTaxIds}
                          onChange={setPurchaseTaxIds}
                          placeholder={t("product.vendorPurchaseTaxesPlaceholder")}
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}

                {/* Catalog Summary Strip */}
                <div className="rounded-xl border border-[#0B5D4B]/30 bg-gradient-to-r from-[#0B5D4B]/5 to-transparent p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0B5D4B] flex items-center gap-1.5">
                      <FileCheck className="size-4" /> {t("product.readyToRegister")}
                    </span>
                    <Badge variant="accent" size="sm">
                      {trackingMode === "serial" ? t("product.serialTracked") : trackingMode === "lot" ? t("product.lotTracked") : t("product.bulkStock")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{t("product.summaryTitle")}</strong> {productName || t("product.unnamed")}
                    </span>
                    {selectedCategory && (
                      <span>
                        <strong className="text-foreground">{t("field.category")}:</strong> {selectedCategory.name}
                      </span>
                    )}
                    {selectedBrand && (
                      <span>
                        <strong className="text-foreground">{t("field.brand")}:</strong> {selectedBrand.name}
                      </span>
                    )}
                    <span>
                      <strong className="text-foreground">{t("product.price")}:</strong> ETB {listPrice}
                    </span>
                    <span>
                      <strong className="text-foreground">{t("product.cost")}:</strong> ETB {standardCost}
                    </span>
                    <span>
                      <strong className="text-foreground">{t("product.margin")}:</strong> {marginPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Wizard Footer */}
          <DialogFooter className="shrink-0 border-t border-border/80 bg-background/95 px-6 py-3.5 backdrop-blur-md flex flex-row items-center justify-between gap-3">
            <div>
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goToStep((step - 1) as StepId)}
                  disabled={isPending}
                  className="h-10 gap-1.5 px-4 font-medium"
                >
                  <ArrowLeft className="size-4" /> {t("action.back")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isPending}
                  className="h-10 px-4"
                >
                  {t("action.cancel")}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs text-muted-foreground mr-2 font-medium">
                {t("modal.newProduct.stepOfCount").replace("{step}", String(step))}
              </span>

              {step < 3 ? (
                <Button
                  key="wizard-next-step-btn"
                  type="button"
                  onClick={() => goToStep((step + 1) as StepId)}
                  disabled={isPending || (step === 1 && !productName.trim())}
                  className="h-10 gap-1.5 bg-[#0B5D4B] hover:bg-[#073B35] px-5 font-semibold text-white shadow-md shadow-[#0B5D4B]/20 transition-all"
                >
                  <span>{t("action.next")}</span>
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  key="wizard-submit-btn"
                  type="button"
                  onClick={() => handleFinalSubmit(false)}
                  disabled={isPending || isCheckingDuplicates || units.length === 0 || !productName.trim()}
                  className="h-10 gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] px-6 font-semibold text-white shadow-md shadow-[#0B5D4B]/20 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                >
                  {isPending || isCheckingDuplicates ? (
                    <>
                      <LoaderCircleIcon className="size-4 animate-spin" />
                      <span>{isCheckingDuplicates ? t("action.checkingDuplicates") : t("action.registering")}</span>
                    </>
                  ) : (
                    <>
                      <PackagePlus className="size-4 text-emerald-200" />
                      <span>{t("action.submit")}</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>

        {/* DUPLICATE PRODUCT WARNING OVERLAY */}
        {showDuplicateWarning && (
          <div className="absolute inset-0 z-50 flex flex-col bg-card rounded-2xl overflow-hidden shadow-2xl animate-in fade-in-50 duration-200">
            {/* Warning Top Accent Bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 shrink-0" />

            {/* Warning Header */}
            <div className="shrink-0 border-b border-border/70 bg-background/95 px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-md flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 border border-amber-300">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-1 sm:space-y-0">
                  <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                    {t("product.duplicateWarningTitle")}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {duplicateMatches.length} {t("product.duplicateWarningSubtitle")}
                  </p>
                  <div className="pt-1 sm:hidden">
                    <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900 font-bold px-2.5 py-0.5 text-[11px]">
                      {step === 3 ? t("product.confirmationRequired") : t("product.catalogReview")}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Badge variant="outline" className="hidden sm:inline-flex border-amber-400 bg-amber-50 text-amber-900 font-bold px-2.5 py-1">
                  {step === 3 ? t("product.confirmationRequired") : t("product.catalogReview")}
                </Badge>
                <button
                  type="button"
                  onClick={() => setShowDuplicateWarning(false)}
                  className="rounded-lg p-1.5 sm:p-2 bg-red-500 text-white hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 shadow-2xs"
                  aria-label={t("product.close")}
                >
                  <X className="size-4 sm:size-4.5" />
                </button>
              </div>
            </div>

            {/* Warning Body */}
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
              <div className="rounded-xl border-2 border-amber-300/90 bg-amber-50/95 p-3.5 text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 border border-amber-300/70 mt-0.5">
                  <AlertTriangle className="size-4" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-sm text-amber-950">{t("product.duplicateBoxTitle")}</span>
                  <p className="text-xs text-amber-900 leading-relaxed font-medium">
                    {t("product.duplicateBoxDesc")}
                  </p>
                </div>
              </div>

              {/* Product Candidate Being Added */}
              <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>{t("product.addingDraftTitle")}</span>
                  <Badge variant="outline" size="sm" className="font-semibold text-[10px]">
                    {t("product.draftEntry")}
                  </Badge>
                </div>
                <div className="font-semibold text-sm text-foreground">
                  {productName}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                  {selectedCategory && <span>{t("field.category")}: <strong className="text-foreground">{selectedCategory.name}</strong></span>}
                  {selectedBrand && <span>{t("field.brand")}: <strong className="text-foreground">{selectedBrand.name}</strong></span>}
                  {model && <span>{t("field.model")}: <strong className="text-foreground font-mono">{model}</strong></span>}
                </div>
              </div>

              {/* Existing Catalog Matches */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>{t("product.existingInCatalog")}</span>
                  <span className="text-[11px] font-bold text-amber-800">
                    {duplicateMatches.length} {t("product.matchesDetected")}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                  {duplicateMatches.map((dup) => (
                    <div
                      key={dup.id}
                      className="rounded-xl border border-amber-300/80 bg-amber-50/50 p-3.5 space-y-2.5 transition-all hover:border-amber-400"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-foreground bg-secondary/80 px-2 py-0.5 rounded border border-border/60">
                              {dup.sku}
                            </span>
                            <span className="font-bold text-sm text-foreground">
                              {dup.name}
                            </span>
                          </div>
                          {dup.standardName && dup.standardName !== dup.name && (
                            <div className="text-[11px] text-muted-foreground">
                              {t("product.standard")} <span className="font-medium text-foreground">{dup.standardName}</span>
                            </div>
                          )}
                        </div>

                        <span
                          className={cn(
                            "text-xs font-bold px-2.5 py-0.5 rounded-full border shrink-0",
                            dup.similarityScore >= 90
                              ? "bg-red-500/15 text-red-600 border-red-500/30"
                              : "bg-amber-100 text-amber-900 border-amber-300"
                          )}
                        >
                          {dup.similarityScore}% {t("product.match")}
                        </span>
                      </div>

                      {/* Match Reason Callout */}
                      <div className="text-[11px] font-semibold text-amber-950 bg-amber-100/90 border border-amber-200/80 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-700 shrink-0" />
                        <span>{dup.matchReason}</span>
                      </div>

                      {/* Details & Catalog Link */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1.5 border-t border-border/50 gap-2">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {dup.brandName && <span>{t("field.brand")}: <strong className="text-foreground">{dup.brandName}</strong></span>}
                          {dup.categoryName && <span>{t("field.category")}: <strong className="text-foreground">{dup.categoryName}</strong></span>}
                          {dup.model && <span>{t("field.model")}: <strong className="text-foreground font-mono">{dup.model}</strong></span>}
                          <span>{t("product.price")}: <strong className="text-foreground">ETB {dup.listPrice}</strong></span>
                          <span>{t("product.cost")}: <strong className="text-foreground">ETB {dup.standardCost}</strong></span>
                        </div>

                        <a
                          href={`/admin/products?query=${encodeURIComponent(dup.sku)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B5D4B] dark:text-emerald-400 hover:underline"
                        >
                          {t("product.viewInCatalog")} <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Warning Confirmation Footer */}
            <div className="shrink-0 border-t border-border/80 bg-background/95 px-4 sm:px-6 py-3 sm:py-3.5 backdrop-blur-md flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDuplicateWarning(false);
                }}
                disabled={isPending}
                className="h-10 w-full sm:w-auto gap-2 px-4 text-xs sm:text-sm font-medium justify-center"
              >
                <ArrowLeft className="size-4" />
                <span>{t("action.closeAndEdit")}</span>
              </Button>

              {step === 3 ? (
                <Button
                  type="button"
                  onClick={() => handleFinalSubmit(true)}
                  disabled={isPending}
                  className="h-10 w-full sm:w-auto gap-2 px-4 text-xs sm:text-sm bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold shadow-md shadow-amber-600/20 transition-all justify-center"
                >
                  {isPending ? (
                    <>
                      <LoaderCircleIcon className="size-4 animate-spin" />
                      <span>{t("action.registeringProduct")}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 text-amber-100" />
                      <span>{t("action.confirmAndRegisterAnyway")}</span>
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>

      <QuickAddCategoryDialog
        open={isAddCategoryOpen}
        onOpenChange={setIsAddCategoryOpen}
        initialName={quickCategoryName}
        onCreated={(newCategory) => {
          setLocalCategories((prev) => [...prev, newCategory]);
          changeCategory(newCategory.id);
        }}
      />

      <QuickAddBrandDialog
        open={isAddBrandOpen}
        onOpenChange={setIsAddBrandOpen}
        initialName={quickBrandName}
        onCreated={(newBrand) => {
          setLocalBrands((prev) => [...prev, newBrand]);
          changeBrand(newBrand.id);
          if (newBrand.country) {
            setCountry(newBrand.country);
            setManualFields((current) => ({ ...current, country: true }));
          }
        }}
      />

      <QuickAddUnitDialog
        open={isAddUnitOpen}
        onOpenChange={setIsAddUnitOpen}
        initialName={quickUnitName}
        onCreated={(newUnit) => {
          setLocalUnits((prev) => [...prev, newUnit]);
          setUnitId(newUnit.id);
        }}
      />
    </Dialog>
  );
}

function QuickAddCategoryDialog({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onCreated: (category: CategorySelectOption) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription("");
      setError(null);
    }
  }, [open, initialName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("validation.categoryNameRequired"));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await createCategoryModalAction({ name: name.trim(), description: description.trim() });
      onCreated({
        id: res.id,
        name: res.name,
        code: res.code,
        specificationSchema: (res.specificationSchema as any) ?? [],
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || t("validation.categoryCreateError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[70]" className="z-[75] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{t("modal.quickCategory.title")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("modal.quickCategory.desc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>{t("field.categoryName")}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("field.categoryNamePlaceholder")}
              required
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none focus:border-[#0B5D4B] focus:ring-1 focus:ring-[#0B5D4B]"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>{t("field.descriptionOptional")}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("field.descriptionPlaceholder")}
              rows={2}
              className="rounded-lg border border-input bg-background p-2.5 text-sm font-medium outline-none focus:border-[#0B5D4B] focus:ring-1 focus:ring-[#0B5D4B]"
            />
          </label>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 text-xs"
            >
              {t("action.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 bg-[#0B5D4B] hover:bg-[#0B5D4B]/90 text-white text-xs font-semibold"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircleIcon className="mr-1.5 size-3.5 animate-spin" />
                  {t("action.creating")}
                </>
              ) : (
                t("action.saveCategory")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickAddBrandDialog({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onCreated: (brand: SelectOption & { country?: string | null }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setCountry("");
      setDescription("");
      setError(null);
    }
  }, [open, initialName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("validation.brandNameRequired"));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await createBrandModalAction({
        name: name.trim(),
        country: country.trim() || undefined,
        description: description.trim() || undefined,
      });
      onCreated({
        id: res.id,
        name: res.name,
        code: res.code,
        country: res.country,
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || t("validation.brandCreateError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[70]" className="z-[75] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{t("modal.quickBrand.title")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("modal.quickBrand.desc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>{t("field.brandName")}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("field.brandNamePlaceholder")}
              required
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none focus:border-[#0B5D4B] focus:ring-1 focus:ring-[#0B5D4B]"
            />
          </label>
          <CountrySelectField
            name="_unused_quick_brand_country"
            label={t("field.countryOfOriginOptional")}
            value={country}
            onValueChange={setCountry}
          />
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>{t("field.descriptionOptional")}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("field.brandDescriptionPlaceholder")}
              rows={2}
              className="rounded-lg border border-input bg-background p-2.5 text-sm font-medium outline-none focus:border-[#0B5D4B] focus:ring-1 focus:ring-[#0B5D4B]"
            />
          </label>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 text-xs"
            >
              {t("action.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 bg-[#0B5D4B] hover:bg-[#0B5D4B]/90 text-white text-xs font-semibold"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircleIcon className="mr-1.5 size-3.5 animate-spin" />
                  {t("action.creating")}
                </>
              ) : (
                t("action.saveBrand")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickAddUnitDialog({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onCreated: (unit: SelectOption) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [precision, setPrecision] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setPrecision("0");
      setError(null);
    }
  }, [open, initialName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("validation.unitNameRequired"));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await createUnitModalAction({
        name: name.trim(),
        precision: Number(precision) || 0,
      });
      onCreated({
        id: res.id,
        name: res.name,
        code: res.code,
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || t("validation.unitCreateError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[70]" className="z-[75] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{t("modal.quickUnit.title")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("modal.quickUnit.desc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>{t("field.unitName")}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("field.unitNamePlaceholder")}
              required
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none focus:border-[#0B5D4B] focus:ring-1 focus:ring-[#0B5D4B]"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>{t("field.decimalPrecision")}</span>
            <input
              type="number"
              min="0"
              max="4"
              value={precision}
              onChange={(e) => setPrecision(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none focus:border-[#0B5D4B] focus:ring-1 focus:ring-[#0B5D4B]"
            />
            <span className="text-[10px] text-muted-foreground font-normal">
              {t("field.decimalPrecisionHint")}
            </span>
          </label>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 text-xs"
            >
              {t("action.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 bg-[#0B5D4B] hover:bg-[#0B5D4B]/90 text-white text-xs font-semibold"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircleIcon className="mr-1.5 size-3.5 animate-spin" />
                  {t("action.creating")}
                </>
              ) : (
                t("action.saveUnit")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
