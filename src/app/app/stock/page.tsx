"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateIdempotencyKey, formatApiError } from "@/lib/confirm-helpers";

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

  // Sample data loading state
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
        setErrorMsg("लॉगिन आवश्यक है (Sign in required).");
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
            name: "मेरी दुकान / My Dukaan",
            language: "hi",
          })
          .select("id")
          .single();
        if (newShop) {
          shop = newShop;
        }
      }

      if (!shop) {
        setErrorMsg("दुकान प्रोफ़ाइल लोड करने में विफल (Shop not found).");
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
        unit: p.unit || "kg",
        price: Number(p.price || 0),
        stock_qty: Number(p.stock_qty || 0),
        reorder_level: Number(p.reorder_level || 5),
      }));

      setProducts(list);
    } catch (err: unknown) {
      console.error("Products load error:", err);
      setErrorMsg("स्टॉक डेटा लोड करने में विफल (Failed to load inventory).");
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
        setErrorMsg(`नमूना डेटा लोड त्रुटि: ${error.message}`);
      } else {
        setSuccessMsg("नमूना किराना सामान एवं ग्राहक लोड हो गए!");
        await loadProducts(true);
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMsg(`कनेक्शन त्रुटि: ${msg}`);
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !stockDelta.trim()) return;

    const deltaNum = Number(stockDelta.trim());
    if (isNaN(deltaNum) || deltaNum === 0) {
      setErrorMsg("कृपया वैध मात्रा परिवर्तन दर्ज करें (उदा: +5 या -2)");
      return;
    }

    const targetProduct = products.find((p) => p.id === selectedProductId);
    if (!targetProduct) return;

    if (targetProduct.stock_qty + deltaNum < 0) {
      setErrorMsg(
        `अमान्य मात्रा: वर्तमान स्टॉक केवल ${targetProduct.stock_qty} ${targetProduct.unit} है।`
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
        setSuccessMsg(
          `${targetProduct.name} का स्टॉक अपडेट हो गया (${deltaNum > 0 ? "+" : ""}${deltaNum} ${targetProduct.unit})`
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
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground leading-tight">
              स्टॉक प्रबंधन (Inventory & Stock)
            </h1>
            <span className="text-xs text-muted-foreground leading-tight">
              सामान की मात्रा, मूल्य व कम स्टॉक चेतावनी
            </span>
          </div>

          <Link
            href="/app"
            className="self-start sm:self-auto text-xs font-semibold text-primary hover:underline min-h-[44px] flex items-center"
          >
            ← होम डैशबोर्ड पर जाएं (Home)
          </Link>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-800 dark:text-green-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
            <span>{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-green-800 dark:text-green-300 hover:opacity-75 font-bold ml-2 text-sm cursor-pointer"
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="underline font-bold text-xs hover:text-destructive/80 cursor-pointer min-h-[36px] flex items-center"
            >
              ✕
            </button>
          </div>
        )}

        {/* Aggregate Overview Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card border border-border p-3.5 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold text-foreground">कुल उत्पाद</span>
            <span className="text-[10px] text-muted-foreground">Total Products</span>
            <span className="text-xl font-extrabold text-foreground tabular-nums mt-0.5">
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
            <span className="text-xs font-bold">कम स्टॉक चेतावनी</span>
            <span className="text-[10px] opacity-80">Low Stock Alerts</span>
            <span className="text-xl font-extrabold tabular-nums mt-0.5">
              {lowStockCount}
            </span>
          </div>
        </div>

        {/* Adjust Stock Form Modal/Inline */}
        {selectedProductId && (
          <form
            onSubmit={handleAdjustSubmit}
            className="p-4 rounded-2xl bg-card border border-primary/30 shadow-md flex flex-col gap-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                📦 {products.find((p) => p.id === selectedProductId)?.name} — स्टॉक बदलें
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedProductId(null);
                  setStockDelta("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex flex-col gap-1 w-full sm:flex-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  मात्रा परिवर्तन (+ या - लिखें, e.g. +10 या -3)
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={stockDelta}
                  onChange={(e) => setStockDelta(e.target.value)}
                  placeholder="उदा: +5"
                  className="px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-bold tabular-nums min-h-[44px]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductId(null);
                    setStockDelta("");
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted min-h-[44px] cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 min-h-[44px] cursor-pointer shadow-xs"
                >
                  {isSubmittingAdjust ? "अपडेट हो रहा..." : "सहेजें (Save)"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Search Bar */}
        {products.length > 0 && (
          <div className="relative w-full">
            <input
              type="search"
              id="search-products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="सामान का नाम खोजें (Search products)..."
              className="w-full px-4 py-3 text-sm rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none transition-shadow min-h-[48px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer"
                aria-label="Clear product search"
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
          /* Brand-new user empty state with hint and Load sample data button */
          <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card/40 flex flex-col items-center gap-3">
            <span className="text-3xl">📦 ✨</span>
            <div className="flex flex-col gap-1 max-w-md">
              <p className="font-bold text-foreground text-base">
                दुकान में अभी कोई सामान नहीं है (No products in inventory yet)
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">
                  Say your first sale to get started:
                </strong>{" "}
                होम स्क्रीन पर बोलकर बिक्री दर्ज करें, या सीधे नीचे दिए बटन से नमूना किराना सामान लोड करें।
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
                  <span>डेटा लोड हो रहा है...</span>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Load sample data / नमूना डेटा लोड करें</span>
                  </>
                )}
              </button>

              <Link
                href="/app"
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted min-h-[48px] flex items-center"
              >
                🎙️ बिक्री बोलें (Record Sale)
              </Link>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground bg-card/40 flex flex-col items-center gap-2">
            <span className="text-2xl">🔍</span>
            <p className="font-semibold text-foreground text-sm">
              कोई सामान नहीं मिला (No Products Match)
            </p>
            <p className="text-[11px] max-w-[240px]">
              &quot;{searchQuery}&quot; से मेल खाता कोई उत्पाद नहीं है।
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredProducts.map((product) => {
              const isLow = product.stock_qty <= product.reorder_level;
              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border/80 hover:border-primary/40 transition-colors shadow-xs min-h-[60px]"
                >
                  <div className="flex flex-col min-w-0 pr-3">
                    <span className="text-sm sm:text-base font-bold text-foreground truncate">
                      {product.name}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="tabular-nums font-semibold">
                        ₹{product.price.toLocaleString("en-IN")} / {product.unit}
                      </span>
                      <span>•</span>
                      <span className="text-[11px]">
                        री-ऑर्डर: {product.reorder_level} {product.unit}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end">
                      <span
                        className={`text-sm sm:text-base font-extrabold px-2.5 py-0.5 rounded-lg tabular-nums border ${
                          isLow
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-muted/80 text-foreground border-border"
                        }`}
                      >
                        {product.stock_qty} {product.unit}
                      </span>
                      {isLow && (
                        <span className="text-[10px] text-destructive font-semibold mt-0.5">
                          ⚠️ स्टॉक कम है
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId(product.id);
                        setStockDelta("");
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-foreground min-h-[40px] cursor-pointer"
                    >
                      बदलें
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
        <div className="flex flex-col gap-4 p-4">
          <div className="h-12 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          <div className="h-32 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
        </div>
      }
    >
      <StockContent />
    </Suspense>
  );
}
