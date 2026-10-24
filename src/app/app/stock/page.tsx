"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Package, Search, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateIdempotencyKey, formatApiError } from "@/lib/confirm-helpers";
import { STRINGS } from "@/lib/strings";

interface ProductItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  stock_qty: number;
  reorder_level: number;
}

function StockContent() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sample data loading state for judges/new accounts
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Quick adjust modal/inline state
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [stockDelta, setStockDelta] = useState<string>("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  const loadProducts = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMsg("Sign in required to view inventory.");
        setIsLoading(false);
        return;
      }

      let { data: shop } = await supabase
        .from("shops")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!shop) {
        // Safe fallback: insert default shop if user has no shop yet
        const { data: newShop } = await supabase
          .from("shops")
          .insert({
            owner_id: user.id,
            name: "My Dukaan",
            language: "hi",
          })
          .select("id")
          .single();
        if (newShop) {
          shop = newShop;
        }
      }

      if (!shop) {
        setErrorMsg("Shop profile not found.");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit, price, stock_qty, reorder_level")
        .eq("shop_id", shop.id)
        .order("name", { ascending: true });

      if (error) throw error;

      const list: ProductItem[] = (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit || "unit",
        price: Number(p.price || 0),
        stock_qty: Number(p.stock_qty || 0),
        reorder_level: Number(p.reorder_level || 5),
      }));

      setProducts(list);
    } catch (err: unknown) {
      console.error("Products load error:", err);
      setErrorMsg("Failed to load inventory data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!ignore) {
        await loadProducts(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [loadProducts]);

  const handleLoadSampleData = async () => {
    setIsLoadingSample(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("load_sample_data");

      if (error) {
        setErrorMsg(`Failed to load sample data: ${error.message}`);
      } else {
        setSuccessMsg(STRINGS.stock.sampleDataSuccess);
        await loadProducts(true);
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMsg(`Connection error: ${msg}`);
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !stockDelta.trim()) return;

    const deltaNum = Number(stockDelta.trim());
    if (isNaN(deltaNum) || deltaNum === 0) {
      setErrorMsg("Please enter a valid non-zero quantity change (e.g. +5 or -2).");
      return;
    }

    const targetProduct = products.find((p) => p.id === selectedProductId);
    if (!targetProduct) return;

    if (targetProduct.stock_qty + deltaNum < 0) {
      setErrorMsg(
        `Invalid quantity: Current stock is only ${targetProduct.stock_qty} ${targetProduct.unit}. Stock cannot become negative.`
      );
      return;
    }

    setIsSubmittingAdjust(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = generateIdempotencyKey();
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          action: "adjust_stock",
          data: {
            product: targetProduct.name,
            qty_change: deltaNum,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(formatApiError(json));
      } else {
        const deltaFormatted = deltaNum > 0 ? `+${deltaNum}` : `${deltaNum}`;
        setSuccessMsg(
          `${targetProduct.name} stock updated (${deltaFormatted} ${targetProduct.unit}).`
        );
        setSelectedProductId(null);
        setStockDelta("");
        await loadProducts(false);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: unknown) {
      setErrorMsg(formatApiError(err));
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stock_qty <= p.reorder_level).length;
  }, [products]);

  return (
    <main className="w-full px-4 py-5 animate-in fade-in duration-200">
      <div className="flex flex-col gap-5 max-w-[1200px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground leading-tight flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              <span>{STRINGS.stock.title}</span>
            </h1>
            <span className="text-xs text-muted-foreground leading-tight">
              {STRINGS.stock.subtitle}
            </span>
          </div>

          <Link
            href="/app"
            className="self-start sm:self-auto text-xs font-semibold text-primary hover:underline min-h-[44px] flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{STRINGS.common.backToHome}</span>
          </Link>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-800 dark:text-emerald-300 hover:opacity-75 font-bold ml-2 text-sm cursor-pointer"
              aria-label={STRINGS.common.close}
            >
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-destructive flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="underline font-bold text-xs hover:text-destructive/80 cursor-pointer min-h-[36px] flex items-center"
              aria-label={STRINGS.common.close}
            >
              ✕
            </button>
          </div>
        )}

        {/* Aggregate Overview Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card border border-border p-3.5 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold text-foreground">
              {STRINGS.stock.totalProducts}
            </span>
            <span className="text-2xl font-extrabold text-foreground tabular-nums mt-1">
              {products.length}
            </span>
          </div>

          <div
            className={`rounded-2xl border p-3.5 flex flex-col items-center justify-center text-center ${
              lowStockCount > 0
                ? "bg-destructive/10 border-destructive/25 text-destructive"
                : "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400"
            }`}
          >
            <span className="text-xs font-bold">
              {STRINGS.stock.lowStockAlerts}
            </span>
            <span className="text-2xl font-extrabold tabular-nums mt-1">
              {lowStockCount}
            </span>
          </div>
        </div>

        {/* Adjust Stock Form (Modal/Inline) */}
        {selectedProductId && (
          <form
            id="form-adjust-stock"
            onSubmit={handleAdjustSubmit}
            className="p-4 rounded-2xl bg-card border border-primary/40 shadow-lg flex flex-col gap-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <span>
                  {STRINGS.stock.adjustStockTitle}: {products.find((p) => p.id === selectedProductId)?.name}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedProductId(null);
                  setStockDelta("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1"
                aria-label={STRINGS.common.close}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex flex-col gap-1 w-full sm:flex-1">
                <label
                  htmlFor="stock-delta-input"
                  className="text-[11px] font-semibold text-muted-foreground"
                >
                  {STRINGS.stock.adjustQtyChange}
                </label>
                <input
                  id="stock-delta-input"
                  type="number"
                  step="1"
                  required
                  value={stockDelta}
                  onChange={(e) => setStockDelta(e.target.value)}
                  placeholder={STRINGS.stock.adjustQtyPlaceholder}
                  className="px-3.5 py-2.5 text-sm rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-bold tabular-nums min-h-[48px]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductId(null);
                    setStockDelta("");
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted min-h-[48px] cursor-pointer"
                >
                  {STRINGS.common.cancel}
                </button>
                <button
                  type="submit"
                  id="btn-submit-stock-adjust"
                  disabled={isSubmittingAdjust}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 min-h-[48px] cursor-pointer shadow-xs"
                >
                  {isSubmittingAdjust ? STRINGS.common.saving : STRINGS.common.save}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Search Bar */}
        {products.length > 0 && (
          <div className="relative w-full">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="search"
              id="search-products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={STRINGS.stock.searchPlaceholder}
              className="w-full pl-10 pr-10 py-3 text-sm rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none transition-shadow min-h-[48px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer"
                aria-label={STRINGS.stock.clearSearch}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Content: Skeletons / Empty State / Products List */}
        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-muted/40 animate-pulse border border-border/40"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card/40 flex flex-col items-center gap-3">
            <span className="text-3xl">📦 ✨</span>
            <div className="flex flex-col gap-1 max-w-md">
              <p className="font-bold text-foreground text-base">
                {STRINGS.stock.noProductsTitle}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Say your first sale to get started:</strong>{" "}
                {STRINGS.stock.noProductsSubtitle}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                id="btn-load-sample-data-stock"
                onClick={handleLoadSampleData}
                disabled={isLoadingSample}
                className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px] cursor-pointer active:scale-[0.98] transition-all"
              >
                {isLoadingSample ? (
                  <span>{STRINGS.stock.loadingSampleData}</span>
                ) : (
                  <>
                    <span>✨</span>
                    <span>{STRINGS.stock.loadSampleData}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground bg-card/40">
            No products match &quot;{searchQuery}&quot;.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredProducts.map((product) => {
              const isLow = product.stock_qty <= product.reorder_level;
              const isSelected = selectedProductId === product.id;

              return (
                <div
                  key={product.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 shadow-xs min-h-[56px] ${
                    isSelected
                      ? "bg-primary/5 border-primary shadow-xs"
                      : "bg-card border-border hover:border-border/80"
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground truncate">
                        {product.name}
                      </span>
                      {isLow ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-destructive/15 text-destructive border border-destructive/25 uppercase tracking-wider">
                          {STRINGS.stock.lowBadge}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          {STRINGS.stock.inStockBadge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>Rs. {product.price.toLocaleString("en-IN")} / {product.unit}</span>
                      <span>•</span>
                      <span>Reorder: {product.reorder_level} {product.unit}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end">
                      <span
                        className={`text-base font-extrabold tabular-nums ${
                          isLow
                            ? "text-destructive"
                            : "text-foreground"
                        }`}
                      >
                        {product.stock_qty} {product.unit}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {STRINGS.stock.currentStock}
                      </span>
                    </div>

                    <button
                      type="button"
                      id={`btn-adjust-${product.id}`}
                      onClick={() => {
                        setSelectedProductId(product.id);
                        setStockDelta("");
                      }}
                      className="px-3 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground min-h-[44px] cursor-pointer transition-colors shadow-2xs"
                    >
                      {STRINGS.stock.adjustStock}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function StockPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 p-4 max-w-[1200px] mx-auto w-full">
          <div className="h-12 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          <div className="h-32 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
        </div>
      }
    >
      <StockContent />
    </Suspense>
  );
}
