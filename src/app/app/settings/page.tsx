"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Package, Edit2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getMissingDemoProducts,
  validateShopName,
  validateGstin,
} from "@/lib/demo-stock";
import { STRINGS } from "@/lib/strings";

interface ShopInfo {
  id?: string;
  name: string;
  gstin: string | null;
  language: string;
}

export default function SettingsPage() {
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [productCount, setProductCount] = useState<number>(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Shop Profile Edit State
  const [isEditingShop, setIsEditingShop] = useState(false);
  const [editShopName, setEditShopName] = useState("");
  const [editShopGstin, setEditShopGstin] = useState("");
  const [isSavingShop, setIsSavingShop] = useState(false);
  const [shopFormError, setShopFormError] = useState<string | null>(null);
  const [shopFormSuccess, setShopFormSuccess] = useState<string | null>(null);

  // Demo Stock Action State
  const [isAddingDemoStock, setIsAddingDemoStock] = useState(false);
  const [demoStockMsg, setDemoStockMsg] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserEmail(user.email ?? null);
          setUserId(user.id);

          const { data: shopRecord } = await supabase
            .from("shops")
            .select("id, name, gstin, language")
            .eq("owner_id", user.id)
            .maybeSingle();

          if (shopRecord) {
            setShop(shopRecord);
            setEditShopName(shopRecord.name);
            setEditShopGstin(shopRecord.gstin || "");

            // Fetch product count
            const { count } = await supabase
              .from("products")
              .select("id", { count: "exact", head: true })
              .eq("shop_id", shopRecord.id);

            setProductCount(count ?? 0);
          } else {
            // Defaults for when shop is not yet created
            setEditShopName("My Dukaan");
            setEditShopGstin("");
          }
        }
      } catch (err) {
        console.error("Settings load error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  // ---------------------------------------------------------------------------
  // Save Shop Profile (Name & GSTIN)
  // ---------------------------------------------------------------------------
  const handleSaveShopProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopFormError(null);
    setShopFormSuccess(null);

    // Validate shop name
    const nameCheck = validateShopName(editShopName);
    if (!nameCheck.valid) {
      setShopFormError(nameCheck.error || STRINGS.settings.shopNameRequired);
      return;
    }

    // Validate GSTIN
    const gstinCheck = validateGstin(editShopGstin);
    if (!gstinCheck.valid) {
      setShopFormError(gstinCheck.error || STRINGS.settings.gstinInvalid);
      return;
    }

    setIsSavingShop(true);

    try {
      const supabase = createClient();
      let updatedShopId = shop?.id;

      if (updatedShopId) {
        // Update existing shop
        const { error } = await supabase
          .from("shops")
          .update({
            name: editShopName.trim(),
            gstin: gstinCheck.formatted,
          })
          .eq("id", updatedShopId);

        if (error) throw error;
      } else {
        // Insert new shop for current user
        if (!userId) throw new Error("User session not found.");
        const { data: newShop, error } = await supabase
          .from("shops")
          .insert({
            owner_id: userId,
            name: editShopName.trim(),
            gstin: gstinCheck.formatted,
            language: "hi",
          })
          .select("id, name, gstin, language")
          .single();

        if (error) throw error;
        updatedShopId = newShop?.id;
      }

      const newShopState: ShopInfo = {
        id: updatedShopId,
        name: editShopName.trim(),
        gstin: gstinCheck.formatted,
        language: shop?.language || "hi",
      };

      setShop(newShopState);
      setIsEditingShop(false);
      setShopFormSuccess(STRINGS.settings.profileSavedSuccess);
      setTimeout(() => setShopFormSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save shop profile";
      setShopFormError(msg);
    } finally {
      setIsSavingShop(false);
    }
  };

  const handleCancelEditShop = () => {
    setEditShopName(shop?.name || "My Dukaan");
    setEditShopGstin(shop?.gstin || "");
    setShopFormError(null);
    setIsEditingShop(false);
  };

  // ---------------------------------------------------------------------------
  // Add Demo Stock Items to Inventory
  // ---------------------------------------------------------------------------
  const handleAddDemoStock = async () => {
    setIsAddingDemoStock(true);
    setDemoStockMsg(null);

    try {
      const supabase = createClient();
      let activeShopId = shop?.id;

      // Ensure shop exists
      if (!activeShopId) {
        if (!userId) throw new Error("User session not found.");
        const { data: newShop, error: shopErr } = await supabase
          .from("shops")
          .insert({
            owner_id: userId,
            name: shop?.name || "My Dukaan",
            gstin: shop?.gstin || null,
            language: "hi",
          })
          .select("id")
          .single();

        if (shopErr) throw shopErr;
        activeShopId = newShop.id;
        setShop((prev) =>
          prev ? { ...prev, id: activeShopId } : { id: activeShopId, name: "My Dukaan", gstin: null, language: "hi" }
        );
      }

      // Query existing products to prevent duplicates
      const { data: existingProds, error: fetchErr } = await supabase
        .from("products")
        .select("name")
        .eq("shop_id", activeShopId);

      if (fetchErr) throw fetchErr;

      const existingNames = (existingProds || []).map((p) => p.name);
      const missingDemoItems = getMissingDemoProducts(existingNames);

      if (missingDemoItems.length === 0) {
        setDemoStockMsg({
          type: "info",
          text: STRINGS.settings.demoStockAlreadyPresent,
        });
        setTimeout(() => setDemoStockMsg(null), 4000);
        return;
      }

      // Insert missing demo products
      const rowsToInsert = missingDemoItems.map((item) => ({
        ...item,
        shop_id: activeShopId,
      }));

      const { error: insertErr } = await supabase.from("products").insert(rowsToInsert);
      if (insertErr) throw insertErr;

      const newCount = productCount + missingDemoItems.length;
      setProductCount(newCount);

      setDemoStockMsg({
        type: "success",
        text: STRINGS.settings.demoStockSuccess.replace("{count}", String(missingDemoItems.length)),
      });
      setTimeout(() => setDemoStockMsg(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add demo stock";
      setDemoStockMsg({ type: "error", text: msg });
    } finally {
      setIsAddingDemoStock(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Sign Out Handler
  // ---------------------------------------------------------------------------
  const handleSignOut = () => {
    startTransition(async () => {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
        await fetch("/api/auth/signout", { method: "POST" });
        router.push("/");
        router.refresh();
      } catch {
        router.push("/");
      }
    });
  };

  const isDemo = userEmail === "demo@dukaanai.in";

  return (
    <main className="flex flex-col gap-5 px-4 py-5 animate-in fade-in duration-200 max-w-lg mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">
          {STRINGS.settings.title}
        </h1>
        <p className="text-xs text-muted-foreground">
          {STRINGS.settings.subtitle}
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="h-36 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          <div className="h-32 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          <div className="h-28 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
        </div>
      ) : (
        <>
          {/* ── Success banner if profile was saved ── */}
          {shopFormSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{shopFormSuccess}</span>
            </div>
          )}

          {/* ── 1. Shop Info & Edit Card ── */}
          <section className="flex flex-col gap-3.5 rounded-2xl bg-card border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  {STRINGS.settings.shopProfile}
                </h2>
              </div>
              {!isEditingShop && (
                <button
                  type="button"
                  id="btn-edit-shop-profile"
                  onClick={() => {
                    setIsEditingShop(true);
                    setShopFormError(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer min-h-[36px]"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{STRINGS.settings.editProfile}</span>
                </button>
              )}
            </div>

            {isEditingShop ? (
              <form
                id="form-edit-shop-profile"
                onSubmit={handleSaveShopProfile}
                className="flex flex-col gap-3 pt-1"
              >
                {shopFormError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{shopFormError}</span>
                  </div>
                )}

                {/* Shop Name Input */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="input-shop-name"
                    className="text-xs font-semibold text-foreground"
                  >
                    {STRINGS.settings.shopNameLabel}{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="input-shop-name"
                    type="text"
                    required
                    value={editShopName}
                    onChange={(e) => setEditShopName(e.target.value)}
                    placeholder={STRINGS.settings.shopNamePlaceholder}
                    className="px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[48px]"
                  />
                </div>

                {/* GSTIN Input */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="input-shop-gstin"
                    className="text-xs font-semibold text-foreground flex items-center justify-between"
                  >
                    <span>{STRINGS.settings.gstinLabel}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      (Optional)
                    </span>
                  </label>
                  <input
                    id="input-shop-gstin"
                    type="text"
                    maxLength={15}
                    value={editShopGstin}
                    onChange={(e) => setEditShopGstin(e.target.value.toUpperCase())}
                    placeholder={STRINGS.settings.gstinPlaceholder}
                    className="px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm font-mono text-foreground uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[48px]"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {STRINGS.settings.gstinHint}
                  </span>
                </div>

                {/* Save and Cancel Actions */}
                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="submit"
                    id="btn-save-shop-profile"
                    disabled={isSavingShop}
                    className="flex-1 flex items-center justify-center py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer min-h-[48px] disabled:opacity-50"
                  >
                    {isSavingShop
                      ? STRINGS.settings.savingProfile
                      : STRINGS.settings.saveProfile}
                  </button>
                  <button
                    type="button"
                    id="btn-cancel-shop-profile"
                    onClick={handleCancelEditShop}
                    disabled={isSavingShop}
                    className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold transition-all cursor-pointer min-h-[48px]"
                  >
                    {STRINGS.settings.cancel}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">
                    {STRINGS.settings.shopNameLabel}:
                  </span>
                  <span
                    id="display-shop-name"
                    className="font-bold text-foreground text-sm"
                  >
                    {shop?.name || "My Dukaan"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">
                    {STRINGS.settings.gstinLabel}:
                  </span>
                  <span
                    id="display-shop-gstin"
                    className="font-mono font-medium text-foreground"
                  >
                    {shop?.gstin || (
                      <span className="text-muted-foreground italic font-sans font-normal">
                        {STRINGS.settings.notProvided}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">
                    {STRINGS.settings.primaryLanguage}:
                  </span>
                  <span className="font-medium text-foreground">
                    {STRINGS.settings.languageValue}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* ── 2. Inventory & Demo Stock Card ── */}
          <section className="flex flex-col gap-3 rounded-2xl bg-card border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  {STRINGS.settings.demoStockTitle}
                </h2>
              </div>
              <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                {STRINGS.settings.currentProductsCount.replace(
                  "{count}",
                  String(productCount)
                )}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {STRINGS.settings.demoStockDescription}
            </p>

            {/* Demo stock feedback message */}
            {demoStockMsg && (
              <div
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold animate-in fade-in ${
                  demoStockMsg.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                    : demoStockMsg.type === "info"
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}
              >
                {demoStockMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{demoStockMsg.text}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <button
                type="button"
                id="btn-add-demo-stock"
                onClick={handleAddDemoStock}
                disabled={isAddingDemoStock}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-all cursor-pointer min-h-[48px] disabled:opacity-50 active:scale-[0.99]"
              >
                {isAddingDemoStock ? (
                  <span>{STRINGS.settings.addingDemoStock}</span>
                ) : (
                  <>
                    <span>✨</span>
                    <span>{STRINGS.settings.addDemoStockBtn}</span>
                  </>
                )}
              </button>

              <Link
                id="link-view-stock"
                href="/app/stock"
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all min-h-[48px]"
              >
                <span>{STRINGS.settings.viewStockLink}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          {/* ── 3. Account Card ── */}
          <section className="flex flex-col gap-3 rounded-2xl bg-card border border-border p-4 shadow-sm">
            <h2 className="text-sm font-bold text-foreground">
              {STRINGS.settings.accountDetails}
            </h2>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">
                  {STRINGS.settings.signInEmail}:
                </span>
                <span className="font-semibold text-foreground">
                  {userEmail || "demo@dukaanai.in"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">
                  {STRINGS.settings.accountType}:
                </span>
                <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full text-[11px]">
                  {isDemo ? "Demo Account" : "Google Account"}
                </span>
              </div>
            </div>

            <button
              type="button"
              id="btn-settings-signout"
              onClick={handleSignOut}
              disabled={isPending}
              className="mt-2 w-full flex items-center justify-center py-3 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-bold transition-all min-h-[48px] cursor-pointer disabled:opacity-50"
            >
              {isPending
                ? STRINGS.settings.signingOut
                : STRINGS.settings.signOutBtn}
            </button>
          </section>

          {/* ── App Version & Tagline ── */}
          <div className="text-center text-xs text-muted-foreground pt-4 flex flex-col gap-1">
            <p className="font-bold text-foreground">DukaanAI v0.1.0 Beta</p>
            <p className="italic">{STRINGS.settings.tagline}</p>
            <p className="text-[10px] text-muted-foreground/70">
              {STRINGS.settings.hackathonNote}
            </p>
          </div>
        </>
      )}
    </main>
  );
}
